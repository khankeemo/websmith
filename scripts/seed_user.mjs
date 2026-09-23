#!/usr/bin/env node
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

function getEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found');
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    email: 'digitalwebsmith@gmail.com',
    password: 'Khan@8383',
    name: 'Admin User',
    role: 'admin',
    customId: 'WSD-ADM-001'
  };

  for (const arg of args) {
    if (arg.startsWith('--email=')) options.email = arg.split('=')[1].trim();
    else if (arg.startsWith('--password=')) options.password = arg.split('=')[1];
    else if (arg.startsWith('--name=')) options.name = arg.split('=')[1].trim();
    else if (arg.startsWith('--role=')) options.role = arg.split('=')[1].trim();
    else if (arg.startsWith('--custom-id=')) options.customId = arg.split('=')[1].trim();
  }

  return options;
}

async function seed() {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    console.error('❌ DATABASE_URL missing in .env');
    process.exit(1);
  }

  const { email, password, name, role, customId } = parseArgs();
  const normalizedEmail = email.toLowerCase().trim();

  console.log('====================================================');
  console.log('            WEBSMITH USER SEEDING SCRIPT            ');
  console.log('====================================================\n');
  console.log(`Target Email : ${normalizedEmail}`);
  console.log(`Target Name  : ${name}`);
  console.log(`Target Role  : ${role}`);
  console.log(`Password     : ${'*'.repeat(password.length)}\n`);

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // 1. Ensure notification_logs columns exist (prevents login OTP mailer failure)
    console.log('[1/4] Ensuring notification_logs schema integrity...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        channel TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT,
        status TEXT NOT NULL DEFAULT 'sent',
        response TEXT,
        error TEXT,
        license_key TEXT,
        hardware_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS subject TEXT`); } catch (_) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS response TEXT`); } catch (_) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS error TEXT`); } catch (_) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS hardware_id TEXT`); } catch (_) {}
    try { await client.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS error_message TEXT`); } catch (_) {}
    console.log('✓ notification_logs schema verified.');

    // 2. Ensure users table exists (Internal API Center auth)
    console.log('\n[2/4] Ensuring users table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        avatar TEXT,
        theme TEXT DEFAULT 'system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ users table ready.');

    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Upsert user into users table (Internal API Center)
    console.log('\n[3/4] Upserting user into `users` table...');
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (email)
       DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, email, name, role`,
      [normalizedEmail, passwordHash, name, role]
    );
    console.log(`✓ User synced in 'users' table (ID: ${userRes.rows[0].id}, Email: ${userRes.rows[0].email})`);

    // 4. Upsert user into portal_users table (Website & Portal login)
    console.log('\n[4/4] Upserting user into `portal_users` table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS portal_users (
        _id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_portal_users_data ON portal_users USING GIN (data)
    `);

    const existingPortalUser = await client.query(
      `SELECT _id, data FROM portal_users WHERE data->>'email' = $1`,
      [normalizedEmail]
    );

    if (existingPortalUser.rows.length > 0) {
      const existingDoc = existingPortalUser.rows[0].data;
      const updatedDoc = {
        ...existingDoc,
        email: normalizedEmail,
        name: name || existingDoc.name,
        password: passwordHash,
        role: role || existingDoc.role || 'admin',
        status: existingDoc.status || 'active',
        customId: existingDoc.customId || customId,
        updatedAt: new Date().toISOString()
      };

      await client.query(
        `UPDATE portal_users SET data = $1, updated_at = NOW() WHERE _id = $2`,
        [JSON.stringify(updatedDoc), existingPortalUser.rows[0]._id]
      );
      console.log(`✓ User updated in 'portal_users' table (_id: ${existingPortalUser.rows[0]._id})`);
    } else {
      const newId = crypto.randomBytes(12).toString('hex');
      const newDoc = {
        _id: newId,
        email: normalizedEmail,
        name: name,
        password: passwordHash,
        role: role,
        status: 'active',
        customId: customId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await client.query(
        `INSERT INTO portal_users (_id, data, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())`,
        [newId, JSON.stringify(newDoc)]
      );
      console.log(`✓ User inserted in 'portal_users' table (_id: ${newId})`);
    }

    console.log('\n====================================================');
    console.log('🎉 SUCCESS! User seeded in BOTH auth stores.');
    console.log('====================================================');
    console.log(`• Website Login       : ${normalizedEmail}`);
    console.log(`• API Center Login    : ${normalizedEmail}`);
    console.log(`• Role                : ${role}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

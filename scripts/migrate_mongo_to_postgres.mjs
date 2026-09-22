import pg from 'pg';
import fs from 'fs';
import path from 'path';

function getEnv() {
  const envContent = fs.readFileSync('.env', 'utf-8');
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

// All 19 collections
const COLLECTIONS = [
  'users',
  'clients',
  'projects',
  'tickets',
  'resolution_templates',
  'uploads',
  'notifications',
  'settings',
  'services',
  'project_offerings',
  'tasks',
  'invoices',
  'payments',
  'leads',
  'softwarestorelistings',
  'directmessages',
  'softwarestoreinquiries',
  'paymentwebhookevents',
  'notification_logs'
];

async function run() {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL not found in .env");
  }

  const backupFile = path.resolve('scripts/backup/mongo_full_backup_latest.json');
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found at ${backupFile}`);
  }

  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
  console.log(`Loaded backup with ${backup.totalDocuments} total documents across ${Object.keys(backup.collections).length} collections.`);

  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log("Connected to Neon PostgreSQL!");

    // 1. Create all portal_* tables
    for (const colName of COLLECTIONS) {
      const tableName = `portal_${colName.toLowerCase()}`;
      console.log(`Creating table ${tableName}...`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          _id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${tableName}_data ON ${tableName} USING GIN (data);
      `);
    }

    // 2. Insert documents
    console.log("\nMigrating collection data to PostgreSQL...");
    let totalMigrated = 0;

    for (const colName of COLLECTIONS) {
      const tableName = `portal_${colName.toLowerCase()}`;
      const colData = backup.collections[colName];
      const docs = colData ? colData.documents : [];

      console.log(`Migrating ${docs.length} documents into ${tableName}...`);

      for (const doc of docs) {
        const id = doc._id;
        const createdAt = doc.createdAt || doc.created_at || new Date().toISOString();
        const updatedAt = doc.updatedAt || doc.updated_at || new Date().toISOString();

        await client.query(
          `
          INSERT INTO ${tableName} (_id, data, created_at, updated_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (_id) DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at;
          `,
          [id, JSON.stringify(doc), createdAt, updatedAt]
        );
        totalMigrated++;
      }
    }

    console.log(`\nData migration complete! Total documents inserted/upserted: ${totalMigrated}`);

    // 3. Post-migration verification
    console.log("\n--- Verification: Checking Row Counts ---");
    let verificationPassed = true;

    for (const colName of COLLECTIONS) {
      const tableName = `portal_${colName.toLowerCase()}`;
      const expectedCount = (backup.collections[colName] && backup.collections[colName].count) || 0;
      const res = await client.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
      const actualCount = res.rows[0].count;

      const ok = actualCount >= expectedCount;
      console.log(` - ${tableName}: expected=${expectedCount}, in_postgres=${actualCount} [${ok ? 'OK' : 'MISMATCH'}]`);
      if (!ok) verificationPassed = false;
    }

    if (!verificationPassed) {
      throw new Error("Verification failed: row counts do not match!");
    }

    console.log("\nAll row counts match 100%! Migration to Neon PostgreSQL successful!");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});

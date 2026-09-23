import bcrypt from "bcryptjs";
import { MongoClient } from "../lib/server/db.ts";
import { getDb } from "../lib/backend-db/index.ts";
import { sendLoginOtp } from "../lib/otp/login-otp.ts";
import fs from 'fs';

// Read .env into process.env
const envContent = fs.readFileSync('.env', 'utf-8');
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
    process.env[key] = val;
  }
}

async function run() {
  console.log('--- Step 1: Connecting via MongoClient (portal_users) ---');
  const mongoClient = new MongoClient(process.env.DATABASE_URL);
  await mongoClient.connect();
  const usersCollection = mongoClient.db("WSD").collection("users");

  const identifier = 'digitalwebsmith@gmail.com';
  const password = 'Khan@8383';

  console.log('--- Step 2: Querying user ---');
  const user = await usersCollection.findOne({
    $or: [{ email: identifier.toLowerCase() }, { customId: identifier }],
  });

  if (!user) {
    console.error('❌ User NOT found in portal_users!');
    process.exit(1);
  }
  console.log('✓ Found user in portal_users:', { email: user.email, name: user.name, role: user.role });

  console.log('--- Step 3: Verifying password with bcrypt ---');
  const passwordValid = await bcrypt.compare(password, user.password);
  console.log('✓ Password match?:', passwordValid);
  if (!passwordValid) {
    console.error('❌ Password mismatch!');
    process.exit(1);
  }

  console.log('--- Step 4: Testing sendLoginOtp ---');
  const pool = await getDb();
  console.log('✓ Got pool from getDb()');

  try {
    const otpResult = await sendLoginOtp(pool, "website_login", user.email, '127.0.0.1');
    console.log('OTP Result:', otpResult);
  } catch (otpErr) {
    console.error('❌ sendLoginOtp threw:', otpErr);
  }

  await pool.end();
}

run().catch(e => {
  console.error('FAILED AT:', e);
});

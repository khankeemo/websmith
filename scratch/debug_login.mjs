import { MongoClient } from "../lib/server/api.ts";
import bcrypt from "bcryptjs";
import { getDb } from "../lib/backend-db/index.ts";
import { sendLoginOtp } from "../lib/otp/login-otp.ts";
import fs from 'fs';

// Read .env into process.env if needed
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

async function debugLogin() {
  const identifier = 'digitalwebsmith@gmail.com';
  const password = 'Khan@8383';

  console.log('Step 1: MongoClient...');
  const mongoClient = new MongoClient(process.env.DATABASE_URL);
  await mongoClient.connect();
  const usersCollection = mongoClient.db("WSD").collection("users");

  console.log('Step 2: Find user...');
  const user = await usersCollection.findOne({
    $or: [{ email: identifier.toLowerCase() }, { customId: identifier }],
  });
  console.log('User found:', user ? { email: user.email, name: user.name } : null);
  if (!user) return;

  console.log('Step 3: Compare password...');
  const passwordValid = await bcrypt.compare(password, user.password);
  console.log('Password valid:', passwordValid);

  console.log('Step 4: sendLoginOtp...');
  const db = await getDb();
  console.log('Got db pool. Calling sendLoginOtp...');
  const otpResult = await sendLoginOtp(db, "website_login", user.email, '127.0.0.1');
  console.log('OTP Result:', otpResult);
}

debugLogin().catch(e => console.error('CAUGHT ERROR:', e));

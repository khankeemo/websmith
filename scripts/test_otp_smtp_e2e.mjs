import pg from 'pg';
const { Pool } = pg;
import { sendLoginOtp, verifyLoginOtp } from '../lib/otp/login-otp.ts';

async function run() {
  console.log('--- STARTING E2E NODEMAILER SMTP & OTP TEST ---');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const testEmail = 'digitalwebsmith@gmail.com';
  const testPurpose = 'website_login';

  console.log(`\n1. Sending Login OTP to ${testEmail}...`);
  const sendRes = await sendLoginOtp(pool, testPurpose, testEmail, '127.0.0.1');
  console.log('Send result:', sendRes);

  if (!sendRes.success) {
    console.error('FAILED to send login OTP:', sendRes.error);
    await pool.end();
    process.exit(1);
  }

  console.log('\n2. Verifying notification_logs entry in database...');
  const logRes = await pool.query(
    `SELECT event_type, channel, recipient, subject, status, response, error, created_at
     FROM notification_logs
     WHERE recipient = $1 AND event_type = 'otp_verification'
     ORDER BY id DESC LIMIT 1`,
    [testEmail]
  );
  console.log('Latest notification log:', logRes.rows[0]);

  if (!logRes.rows[0] || logRes.rows[0].status !== 'sent') {
    console.error('FAILED: notification_logs does not show sent status');
    await pool.end();
    process.exit(1);
  }

  console.log('\n3. Retrieving generated OTP from otp_verifications...');
  const otpRes = await pool.query(
    `SELECT id, otp_code, purpose, expires_at, verified, attempts
     FROM otp_verifications
     WHERE email = $1 AND purpose = $2
     ORDER BY id DESC LIMIT 1`,
    [testEmail, testPurpose]
  );
  const otpRecord = otpRes.rows[0];
  console.log('OTP Record:', otpRecord);

  if (!otpRecord || !otpRecord.otp_code) {
    console.error('FAILED: OTP record not found');
    await pool.end();
    process.exit(1);
  }

  console.log('\n4. Testing invalid OTP verification...');
  const invalidVerifyRes = await verifyLoginOtp(pool, testPurpose, testEmail, '000000');
  console.log('Invalid verify result:', invalidVerifyRes);
  if (invalidVerifyRes.success) {
    console.error('FAILED: Invalid OTP unexpectedly succeeded');
    await pool.end();
    process.exit(1);
  }

  console.log('\n5. Testing valid OTP verification with correct code:', otpRecord.otp_code);
  const validVerifyRes = await verifyLoginOtp(pool, testPurpose, testEmail, otpRecord.otp_code);
  console.log('Valid verify result:', validVerifyRes);

  if (!validVerifyRes.success) {
    console.error('FAILED: Valid OTP verification failed:', validVerifyRes.error);
    await pool.end();
    process.exit(1);
  }

  console.log('\n6. Checking final verified flag in database...');
  const finalCheck = await pool.query(
    `SELECT verified, attempts FROM otp_verifications WHERE id = $1`,
    [otpRecord.id]
  );
  console.log('Final DB state:', finalCheck.rows[0]);

  if (!finalCheck.rows[0].verified) {
    console.error('FAILED: Record not marked as verified');
    await pool.end();
    process.exit(1);
  }

  console.log('\n>>> ALL NODEMAILER SMTP & OTP VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<');
  await pool.end();
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

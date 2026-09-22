import pg from 'pg';
const { Pool } = pg;

async function test() {
  console.log('=== RUNNING HTTP + SMTP E2E VERIFICATION TEST ===\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const testEmail = 'digitalwebsmith@gmail.com';

  // STEP 1: Test Login OTP Resend
  console.log('Step 1: Calling POST http://localhost:3000/api/auth/login/otp/resend ...');
  const resendResp = await fetch('http://localhost:3000/api/auth/login/otp/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const resendData = await resendResp.json();
  console.log('Resend Response Status:', resendResp.status);
  console.log('Resend Response Data:', resendData);

  if (!resendData.success) {
    console.error('ERROR: Failed to resend OTP');
    await pool.end();
    process.exit(1);
  }

  // STEP 2: Inspect notification_logs in database
  console.log('\nStep 2: Checking notification_logs for email delivery via Nodemailer SMTP...');
  const logQuery = await pool.query(
    `SELECT id, event_type, channel, recipient, subject, status, response, error, created_at
     FROM notification_logs
     WHERE recipient = $1 AND event_type = 'otp_verification'
     ORDER BY id DESC LIMIT 1`,
    [testEmail]
  );
  console.log('Latest notification_log:', logQuery.rows[0]);

  if (!logQuery.rows[0] || logQuery.rows[0].status !== 'sent') {
    console.error('ERROR: Email was not marked as sent in notification_logs');
    await pool.end();
    process.exit(1);
  }

  // STEP 3: Inspect otp_verifications for code
  console.log('\nStep 3: Checking otp_verifications table for OTP code...');
  const otpQuery = await pool.query(
    `SELECT id, otp_code, purpose, expires_at, verified, attempts
     FROM otp_verifications
     WHERE email = $1 AND purpose = 'website_login'
     ORDER BY id DESC LIMIT 1`,
    [testEmail]
  );
  const otpRow = otpQuery.rows[0];
  console.log('OTP Record:', otpRow);

  if (!otpRow || !otpRow.otp_code) {
    console.error('ERROR: No OTP code in database');
    await pool.end();
    process.exit(1);
  }

  // STEP 4: Test Invalid OTP verification
  console.log('\nStep 4: Testing invalid OTP verification (000000)...');
  const invalidResp = await fetch('http://localhost:3000/api/auth/login/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, otp: '000000' }),
  });
  const invalidData = await invalidResp.json();
  console.log('Invalid verify HTTP status:', invalidResp.status);
  console.log('Invalid verify response:', invalidData);

  if (invalidResp.status !== 400 || invalidData.success) {
    console.error('ERROR: Expected 400 with success: false for invalid OTP');
    await pool.end();
    process.exit(1);
  }

  // STEP 5: Test Valid OTP verification
  console.log('\nStep 5: Testing valid OTP verification with code:', otpRow.otp_code);
  const validResp = await fetch('http://localhost:3000/api/auth/login/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, otp: otpRow.otp_code }),
  });
  const validData = await validResp.json();
  console.log('Valid verify HTTP status:', validResp.status);
  console.log('Valid verify response:', validData);

  // STEP 6: Check DB for verified status
  console.log('\nStep 6: Checking DB verified flag...');
  const verifyDbCheck = await pool.query(
    `SELECT verified FROM otp_verifications WHERE id = $1`,
    [otpRow.id]
  );
  console.log('DB verified status:', verifyDbCheck.rows[0]);
  if (!verifyDbCheck.rows[0].verified) {
    console.error('ERROR: DB did not record verified: true');
    await pool.end();
    process.exit(1);
  }

  // STEP 7: Test Forgot-Password Request with Nodemailer SMTP
  console.log('\nStep 7: Testing Forgot Password request route via Nodemailer SMTP...');
  const forgotResp = await fetch('http://localhost:3000/api/auth/forgot-password/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const forgotData = await forgotResp.json();
  console.log('Forgot Password HTTP status:', forgotResp.status);
  console.log('Forgot Password Response:', forgotData);

  if (!forgotData.success) {
    console.error('ERROR: Forgot password request failed');
    await pool.end();
    process.exit(1);
  }

  // STEP 8: Inspect password_reset notification_log
  console.log('\nStep 8: Checking notification_logs for password_reset delivery...');
  const resetLog = await pool.query(
    `SELECT id, event_type, channel, recipient, subject, status, response, error, created_at
     FROM notification_logs
     WHERE recipient = $1 AND event_type = 'password_reset'
     ORDER BY id DESC LIMIT 1`,
    [testEmail]
  );
  console.log('Password Reset notification_log:', resetLog.rows[0]);

  if (!resetLog.rows[0] || resetLog.rows[0].status !== 'sent') {
    console.error('ERROR: password_reset email was not logged as sent');
    await pool.end();
    process.exit(1);
  }

  console.log('\n============================================================');
  console.log('SUCCESS! ALL NODEMAILER SMTP & OTP VERIFICATIONS VERIFIED!');
  console.log('============================================================\n');

  await pool.end();
}

test().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

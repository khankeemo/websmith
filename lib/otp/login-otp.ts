// FILE: lib/otp/login-otp.ts
// PURPOSE: Shared OTP send/verify/resend for LOGIN flows (two-step login).
//          Parameterized by email purpose so the WEBSITE login ('website_login')
//          and the INTERNAL API Center login ('api_login') each have their own
//          otp_verifications row (UNIQUE(email, purpose)) and never collide
//          with password-reset ('password_reset') or portal ('purchase') OTPs.
//          Reuses the existing email service (@/lib/email/mailer) and the shared
//          otp_verifications table — no new OTP implementation.

import { Pool, PoolClient } from 'pg';
import { sendEmail } from '@/lib/email/mailer';
import { redis } from '@/lib/redis-client';

export const LOGIN_OTP_EXPIRY_SECONDS = 5 * 60;
export const LOGIN_OTP_MAX_ATTEMPTS = 15;

// Rate limits: 5 OTP sends per 10 minutes per IP
const OTP_SEND_LIMIT = 5;
const OTP_SEND_WINDOW_SECONDS = 600;

// Rate limits: 15 OTP verify attempts per 15 minutes per email
const OTP_VERIFY_LIMIT = 15;
const OTP_VERIFY_WINDOW_SECONDS = 900;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function rateLimitedSend(ip: string, email: string): Promise<{ limited: true; error: string } | { limited: false }> {
  try {
    const ipKey = `otp_send:${ip}`;
    const result = await redis.incr(ipKey);
    if (result === 1) {
      await redis.expire(ipKey, OTP_SEND_WINDOW_SECONDS);
    }
    if (result > OTP_SEND_LIMIT) {
      return { limited: true, error: 'Too many OTP requests. Please wait a few minutes and try again.' };
    }
  } catch {
    // Fail open
  }

  const emailKey = `otp_send_email:${email}`;
  try {
    const result = await redis.incr(emailKey);
    if (result === 1) {
      await redis.expire(emailKey, OTP_SEND_WINDOW_SECONDS);
    }
    if (result > OTP_SEND_LIMIT) {
      return { limited: true, error: 'Too many OTP requests for this email. Please wait a few minutes and try again.' };
    }
  } catch {
    // Fail open
  }

  return { limited: false };
}

async function rateLimitedVerify(email: string): Promise<{ limited: true; error: string } | { limited: false }> {
  try {
    const key = `otp_verify:${email}`;
    const result = await redis.incr(key);
    if (result === 1) {
      await redis.expire(key, OTP_VERIFY_WINDOW_SECONDS);
    }
    if (result > OTP_VERIFY_LIMIT) {
      return { limited: true, error: 'Too many verification attempts. Please request a new code.' };
    }
  } catch {
    // Fail open
  }

  return { limited: false };
}

export interface SendLoginOtpResult {
  success: boolean;
  error?: string;
  expires_in?: number;
}

export async function sendLoginOtp(
  pool: Pool,
  purpose: string,
  email: string,
  ipAddress = ''
): Promise<SendLoginOtpResult> {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { success: false, error: 'A valid email address is required' };
  }

  // Rate limiting via Redis
  const rateResult = await rateLimitedSend(ipAddress || 'unknown', normalized);
  if (rateResult.limited) {
    return { success: false, error: rateResult.error };
  }

  let client: PoolClient | null = null;
  try {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + LOGIN_OTP_EXPIRY_SECONDS * 1000).toISOString();

    client = await pool.connect();
    await client.query(
      `INSERT INTO otp_verifications (email, phone, otp_code, purpose, expires_at, verified, attempts, max_attempts)
       VALUES ($1, NULL, $2, $3, $4, FALSE, 0, $5)
       ON CONFLICT (email, purpose)
       DO UPDATE SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, verified = FALSE, attempts = 0, created_at = CURRENT_TIMESTAMP`,
      [normalized, otp, purpose, expiresAt, LOGIN_OTP_MAX_ATTEMPTS]
    );

    const emailResult = await sendEmail(client, 'otp_verification', { email: normalized }, { otp_code: otp });
    if (!emailResult.success) {
      console.error(`[login OTP] failed to send to ${normalized} (purpose: ${purpose}):`, emailResult.error);
      return { success: false, error: 'Failed to send OTP email. Please try again.' };
    }

    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
        ['login_otp_sent', `Login OTP sent to ${normalized} (purpose: ${purpose})`, ipAddress || '']
      );
    } catch { /* audit is best-effort */ }

    return { success: true, expires_in: LOGIN_OTP_EXPIRY_SECONDS };
  } catch (error) {
    console.error(`[login OTP] send error (purpose: ${purpose}):`, error);
    return { success: false, error: 'Failed to send OTP email. Please try again.' };
  } finally {
    if (client) client.release();
  }
}

export interface VerifyLoginOtpResult {
  success: boolean;
  error?: string;
  expired?: boolean;
  attempts_used?: number;
  max_attempts?: number;
}

export async function verifyLoginOtp(
  pool: Pool,
  purpose: string,
  email: string,
  otpCode: string
): Promise<VerifyLoginOtpResult> {
  const normalized = (email || '').trim().toLowerCase();
  const cleanOtp = (otpCode || '').trim();
  if (!normalized || !cleanOtp) {
    return { success: false, error: 'Email and OTP code are required' };
  }

  // Rate limiting via Redis
  const rateResult = await rateLimitedVerify(normalized);
  if (rateResult.limited) {
    return { success: false, error: rateResult.error };
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    const result = await client.query(
      `SELECT id, otp_code, expires_at, verified, attempts, max_attempts, (expires_at < CURRENT_TIMESTAMP) AS is_expired
       FROM otp_verifications
       WHERE email = $1 AND purpose = $2
       ORDER BY id DESC LIMIT 1`,
      [normalized, purpose]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'No code has been sent to this email. Please request a new code.' };
    }

    const record = result.rows[0];

    const isExpired = Boolean(record.is_expired) || (record.expires_at && new Date(record.expires_at).getTime() < Date.now());
    if (isExpired) {
      return { success: false, error: 'The code has expired. Please request a new one.', expired: true };
    }
    if (record.verified) {
      return { success: false, error: 'The code was already used. Please request a new one.' };
    }
    const maxAttempts = record.max_attempts || LOGIN_OTP_MAX_ATTEMPTS;
    if ((record.attempts || 0) >= maxAttempts) {
      return { success: false, error: 'Too many invalid attempts. Please request a new code.', max_attempts: maxAttempts };
    }
    if (String(record.otp_code).trim() !== String(cleanOtp).trim()) {
      const newAttempts = (record.attempts || 0) + 1;
      await client.query(`UPDATE otp_verifications SET attempts = $1 WHERE id = $2`, [newAttempts, record.id]);
      return {
        success: false,
        error: 'Invalid code. Please try again.',
        attempts_used: newAttempts,
        max_attempts: maxAttempts,
      };
    }

    await client.query(`UPDATE otp_verifications SET verified = TRUE WHERE id = $1`, [record.id]);

    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
        ['login_otp_verified', `Login OTP verified for ${normalized} (purpose: ${purpose})`, '']
      );
    } catch { /* audit is best-effort */ }

    return { success: true };
  } catch (error) {
    console.error(`[login OTP] verify error (purpose: ${purpose}):`, error);
    return { success: false, error: 'Could not verify the code. Please try again.' };
  } finally {
    if (client) client.release();
  }
}
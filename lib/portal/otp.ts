// FILE: lib/portal/otp.ts
// PURPOSE: OTP issue + verification for the Universal Buy & Renew Portal.
//          Reuses the existing email service (@/lib/email/mailer) and the
//          shared otp_verifications table (purpose = 'purchase'), so the
//          portal uses the SAME OTP mechanism as the rest of the platform —
//          no new OTP implementation.

import { Pool, PoolClient } from 'pg';
import { sendEmail } from '@/lib/email/mailer';

const OTP_PURPOSE = 'purchase';
const OTP_EXPIRY_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 15;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// In-memory per-IP throttle (best-effort; the DB is the authoritative store).
const sendWindows = new Map<string, { count: number; resetsAt: number }>();
const MAX_SENDS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = sendWindows.get(ip);
  if (!entry || entry.resetsAt < now) {
    sendWindows.set(ip, { count: 1, resetsAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_SENDS_PER_WINDOW;
}

export async function sendPortalOtp(
  pool: Pool,
  email: string,
  ipAddress = ''
): Promise<{ success: boolean; error?: string; expires_in?: number }> {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { success: false, error: 'Valid email is required' };
  }
  if (rateLimited(ipAddress || normalized)) {
    return { success: false, error: 'Too many OTP requests. Please wait a few minutes and try again.' };
  }

  let client: PoolClient | null = null;
  try {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString();

    client = await pool.connect();
    await client.query(
      `INSERT INTO otp_verifications (email, phone, otp_code, purpose, expires_at, verified, attempts, max_attempts)
       VALUES ($1, NULL, $2, $3, $4, FALSE, 0, $5)
       ON CONFLICT (email, purpose)
       DO UPDATE SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, verified = FALSE, attempts = 0`,
      [normalized, otp, OTP_PURPOSE, expiresAt, MAX_ATTEMPTS]
    );

    const emailResult = await sendEmail(client, 'otp_verification', { email: normalized }, { otp_code: otp });
    if (!emailResult.success) {
      console.error(`[portal OTP] failed to send to ${normalized}:`, emailResult.error);
      return { success: false, error: 'Failed to send OTP email. Please try again.' };
    }

    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
        ['otp_sent', `Portal OTP sent to ${normalized} (purpose: purchase)`, ipAddress || '']
      );
    } catch { /* audit is best-effort */ }

    return { success: true, expires_in: OTP_EXPIRY_SECONDS };
  } catch (error) {
    console.error('[portal OTP] send error:', error);
    return { success: false, error: 'Failed to send OTP email. Please try again.' };
  } finally {
    if (client) client.release();
  }
}

export async function verifyPortalOtp(
  pool: Pool,
  email: string,
  otpCode: string
): Promise<{
  success: boolean;
  verified?: boolean;
  error?: string;
  attempts_used?: number;
  max_attempts?: number;
  expired?: boolean;
}> {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized || !otpCode) {
    return { success: false, error: 'Email and OTP code are required' };
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    const result = await client.query(
      `SELECT id, otp_code, expires_at, verified, attempts, max_attempts FROM otp_verifications
       WHERE email = $1 AND purpose = $2
       ORDER BY created_at DESC LIMIT 1`,
      [normalized, OTP_PURPOSE]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'No OTP code has been sent to this email. Please request a new OTP.' };
    }

    const record = result.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return { success: false, error: 'OTP code has expired. Please request a new OTP.', expired: true };
    }
    if (record.verified) {
      return { success: false, error: 'OTP code already used. Please request a new OTP.' };
    }
    if (record.otp_code !== otpCode) {
      const newAttempts = (record.attempts || 0) + 1;
      await client.query(`UPDATE otp_verifications SET attempts = $1 WHERE id = $2`, [newAttempts, record.id]);
      return {
        success: false,
        error: 'Invalid OTP code. Please try again.',
        attempts_used: newAttempts,
        max_attempts: record.max_attempts || MAX_ATTEMPTS,
      };
    }

    await client.query(`UPDATE otp_verifications SET verified = TRUE WHERE id = $1`, [record.id]);

    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
        ['otp_verified', `Portal OTP verified for ${normalized} (purpose: purchase)`, '']
      );
    } catch { /* audit is best-effort */ }

    return { success: true, verified: true };
  } catch (error) {
    console.error('[portal OTP] verify error:', error);
    return { success: false, error: 'Could not verify OTP. Please try again.' };
  } finally {
    if (client) client.release();
  }
}

export async function hasVerifiedPortalOtp(
  pool: Pool,
  email: string
): Promise<boolean> {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return false;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT expires_at FROM otp_verifications
         WHERE email = $1 AND purpose = $2 AND verified = TRUE
         ORDER BY created_at DESC LIMIT 1`,
        [normalized, OTP_PURPOSE]
      );
      if (result.rows.length === 0) return false;
      return new Date(result.rows[0].expires_at) > new Date();
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

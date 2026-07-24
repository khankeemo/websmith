import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey } from '@/lib/public-api/auth';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest } from '@/lib/public-api/audit';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let dbClient = null;
  let apiKeyId = '';

  try {
    const apiKey = request.headers.get('X-API-Key');
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!apiKey) return NextResponse.json({ success: false, error: 'API key required' }, { status: 401 });

    const auth = await validateApiKey(apiKey);
    apiKeyId = auth.apiKeyId;

    const rate = await checkRateLimit(auth.apiKeyId, ipAddress, 'otp_verify');
    if (!rate.allowed) return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });

    const body = await request.json();
    const { email, otp: otpCode } = body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!normalizedEmail || !otpCode) {
      return NextResponse.json({ success: false, error: 'Email and OTP code are required' }, { status: 400 });
    }

    dbClient = await pool.connect();

    const result = await dbClient.query(
      `SELECT id, expires_at, verified FROM otp_verifications
       WHERE email = $1 AND otp_code = $2 AND purpose = 'trial_activation' AND verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, otpCode]
    );

    console.log('[OTP verify] match found:', result.rows.length, 'email:', normalizedEmail);

    if (result.rows.length === 0) {
      // Check if OTP exists but is already verified
      const alreadyVerified = await dbClient.query(
        `SELECT id, verified FROM otp_verifications
         WHERE email = $1 AND otp_code = $2 AND purpose = 'trial_activation'
         LIMIT 1`,
        [normalizedEmail, otpCode]
      );
      if (alreadyVerified.rows.length > 0 && alreadyVerified.rows[0].verified) {
        await dbClient.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
           VALUES ($1, $2, $3, $4)`,
          ['otp_already_used', `OTP already used for ${normalizedEmail}`, new Date().toISOString(), ipAddress]
        );
        return NextResponse.json({ success: false, error: 'OTP code already used' }, { status: 400 });
      }
      await dbClient.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
         VALUES ($1, $2, $3, $4)`,
        ['otp_verify_failed', `Invalid OTP attempt for ${normalizedEmail}`, new Date().toISOString(), ipAddress]
      );
      return NextResponse.json({ success: false, error: 'Invalid OTP code' }, { status: 400 });
    }

    const record = result.rows[0];
    if (new Date(record.expires_at) < new Date()) {
      console.warn('[OTP verify] expired:', record.expires_at);
      await dbClient.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
         VALUES ($1, $2, $3, $4)`,
        ['otp_expired', `Expired OTP attempt for ${normalizedEmail}`, new Date().toISOString(), ipAddress]
      );
      return NextResponse.json({ success: false, error: 'OTP code has expired' }, { status: 400 });
    }

    await dbClient.query(
      `UPDATE otp_verifications SET verified = TRUE WHERE id = $1`,
      [record.id]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
       VALUES ($1, $2, $3, $4)`,
      ['otp_verified', `OTP verified for ${normalizedEmail}`, new Date().toISOString(), ipAddress]
    );

    await logRequest({
      apiKeyId, endpoint: '/api/v1/auth/otp/verify', method: 'POST',
      statusCode: 200, latencyMs: Date.now() - startTime, ipAddress, userAgent,
      requestRedacted: { email, action: 'otp_verified' },
    });

    return NextResponse.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    await logRequest({
      apiKeyId, endpoint: '/api/v1/auth/otp/verify', method: 'POST',
      statusCode: 500, latencyMs: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      requestRedacted: { error: 'verify_failed', action: 'failure' },
    });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    if (dbClient) dbClient.release();
  }
}

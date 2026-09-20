import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey } from '@/lib/public-api/auth';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest } from '@/lib/public-api/audit';
import { sendEmail } from '@/lib/email/mailer';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

    const rate = await checkRateLimit(auth.apiKeyId, ipAddress, 'otp_send');
    if (!rate.allowed) return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });

    const body = await request.json();
    const { email: rawEmail } = body;
    const email = (rawEmail || '').trim().toLowerCase();

    console.log('[OTP send] body keys:', Object.keys(body), 'email:', email);

    const OTP_EXPIRY_SECONDS = 5 * 60;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.warn('[OTP send] email validation failed:', JSON.stringify(rawEmail));
      return NextResponse.json({
        success: false,
        error: 'Valid email is required',
        debug: process.env.NODE_ENV === 'development' ? { received: email, type: typeof email } : undefined
      }, { status: 400 });
    }

    const otp = generateOTP();
    dbClient = await pool.connect();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString();

    await dbClient.query(
      `INSERT INTO otp_verifications (email, phone, otp_code, purpose, expires_at, verified, attempts, max_attempts)
       VALUES ($1, NULL, $2, 'trial_activation', $3, FALSE, 0, 15)
       ON CONFLICT (email, purpose)
       DO UPDATE SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, verified = FALSE, attempts = 0`,
      [email, otp, expiresAt]
    );

    // Use centralized email service for OTP verification
    const emailResult = await sendEmail(dbClient, 'otp_verification', { email }, { otp_code: otp });
    if (!emailResult.success) {
      console.error(`[OTP send] Failed to send OTP email to ${email}:`, emailResult.error);
      return NextResponse.json({ success: false, error: 'Failed to send OTP email' }, { status: 500 });
    }
    console.log(`[OTP send] OTP email sent to ${email}, messageId: ${emailResult.messageId}`);

    await logRequest({
      apiKeyId, endpoint: '/api/v1/auth/otp/send', method: 'POST',
      statusCode: 200, latencyMs: Date.now() - startTime, ipAddress, userAgent,
      requestRedacted: { email, action: 'otp_sent' },
    });

    return NextResponse.json({ success: true, message: 'OTP sent successfully', expires_in: OTP_EXPIRY_SECONDS });
  } catch (error: any) {
    console.error('[OTP send] UNCAUGHT ERROR:', error?.message || error, error?.stack || '');
    await logRequest({
      apiKeyId, endpoint: '/api/v1/auth/otp/send', method: 'POST',
      statusCode: 500, latencyMs: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      requestRedacted: { error: 'send_failed', action: 'failure' },
    });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    if (dbClient) dbClient.release();
  }
}

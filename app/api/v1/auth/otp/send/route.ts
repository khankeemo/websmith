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

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.warn('[OTP send] BREVO_API_KEY not configured');
      return false;
    }
    const senderEmail = process.env.MAIL_FROM_ADDRESS || process.env.BREVO_SENDER_EMAIL || process.env.SENDER_EMAIL || 'no-reply@websmithdigital.com';
    const senderName = process.env.BREVO_SENDER_NAME || 'WebSmith License';
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email }],
        subject: 'Your OTP Verification Code',
        htmlContent: `<html><body style="font-family:Arial;padding:20px;background:#f4f4f4"><div style="max-width:500px;margin:auto;background:white;border-radius:10px;padding:30px"><h2 style="text-align:center;color:#333">Your Verification Code</h2><div style="font-size:36px;font-weight:bold;text-align:center;color:#3b82f6;background:#eff6ff;padding:20px;border-radius:8px;letter-spacing:5px;margin:20px 0">${otp}</div><p style="text-align:center;color:#555">Valid for <strong>10 minutes</strong>.</p></div></body></html>`,
        textContent: `Your OTP verification code is: ${otp}. Valid for 10 minutes.`,
      }),
    });
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => 'Unknown error');
      console.error(`[OTP send] Brevo API returned ${resp.status}: ${errorText}`);
    }
    return resp.ok;
  } catch (err) {
    console.error('[OTP send] Email send error:', err);
    return false;
  }
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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await dbClient.query(
      `INSERT INTO otp_verifications (email, phone, otp_code, purpose, expires_at, verified)
       VALUES ($1, NULL, $2, 'trial_activation', $3, FALSE)
       ON CONFLICT (email, purpose)
       DO UPDATE SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, verified = FALSE`,
      [email, otp, expiresAt]
    );

    const sent = await sendOTPEmail(email, otp);
    if (!sent) return NextResponse.json({ success: false, error: 'Failed to send OTP email' }, { status: 500 });

    await logRequest({
      apiKeyId, endpoint: '/api/v1/auth/otp/send', method: 'POST',
      statusCode: 200, latencyMs: Date.now() - startTime, ipAddress, userAgent,
      requestRedacted: { email, action: 'otp_sent' },
    });

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });
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

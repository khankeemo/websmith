import { NextResponse } from "next/server";
import { Pool } from "pg";
import { redis } from "@/lib/redis-client";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const PASSWORD_RESET_RATE_LIMIT = 3;
const PASSWORD_RESET_WINDOW_SECONDS = 3600;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function rateLimitedPasswordReset(ip: string): Promise<{ allowed: boolean; error?: string }> {
  try {
    const key = `pwd_reset:${ip}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, PASSWORD_RESET_WINDOW_SECONDS);
    }
    if (current > PASSWORD_RESET_RATE_LIMIT) {
      return { allowed: false, error: 'Too many password reset requests. Please try again later.' };
    }
  } catch {
    // Fail open
  }
  return { allowed: true };
}

async function sendOTPEmail(email: string, otp: string): Promise<{ sent: boolean; error?: string }> {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    return { sent: false, error: "BREVO_API_KEY not configured" };
  }

  const SENDER_EMAIL = process.env.SENDER_EMAIL || "support@websmithdigital.com";

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { email: SENDER_EMAIL, name: "Websmith Digital" },
        to: [{ email }],
        subject: "Password Reset - Websmith Digital",
        htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #0B1120; color: #fff; padding: 40px; margin: 0; }
    .container { max-width: 480px; margin: 0 auto; background: #1a1a2e; padding: 40px; border-radius: 16px; border: 1px solid #333; }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo h1 { color: #60A5FA; font-size: 24px; margin: 0; }
    .code { font-size: 42px; font-weight: bold; text-align: center; color: #60A5FA; letter-spacing: 10px; padding: 24px; background: #0B1120; border-radius: 12px; margin: 24px 0; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo"><h1>Websmith Digital</h1></div>
    <h2 style="text-align:center;color:#fff;font-weight:400;font-size:20px">Password Reset Request</h2>
    <p style="color:#94A3B8;text-align:center;line-height:1.6">Use the code below to reset your password:</p>
    <div class="code">${otp}</div>
    <p style="color:#94A3B8;text-align:center;font-size:14px">This code will expire in <strong style="color:#fff">5 minutes</strong>.</p>
    <p style="color:#475569;text-align:center;font-size:13px;margin-top:24px">If you didn't request this, please ignore this email.</p>
  </div>
</body>
</html>`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Brevo API error (${response.status}): ${errorText}`);
      return { sent: false, error: `Brevo API returned ${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Failed to send OTP email (internal):", errMsg);
    return { sent: false, error: "Failed to send OTP email. Please try again later." };
  }
}

export async function POST(request: Request) {
  let client = null;

  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                      request.headers.get("x-real-ip") || "unknown";

    const rateResult = await rateLimitedPasswordReset(ipAddress);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { success: false, error: rateResult.error },
        { status: 429 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const expiresAtISO = expiresAt.toISOString();

    client = await pool.connect();

    await client.query(
      `INSERT INTO otp_verifications (email, otp_code, purpose, expires_at, created_at, verified, attempts, max_attempts)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, false, 0, 15)
       ON CONFLICT (email, purpose)
       DO UPDATE SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, created_at = CURRENT_TIMESTAMP, verified = false, attempts = 0`,
      [normalizedEmail, otp, "password_reset", expiresAt]
    );

    client.release();
    client = null;

    const result = await sendOTPEmail(email, otp);

    if (!result.sent) {
      console.error("OTP email delivery failed:", result.error);
      return NextResponse.json(
        { success: false, error: "Failed to send OTP email. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
      email: normalizedEmail,
      expires_at: expiresAtISO,
      expires_in_seconds: 300,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Forgot password request error (internal):", errMsg);
    if (client) {
      try { client.release(); } catch (_) {}
    }
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
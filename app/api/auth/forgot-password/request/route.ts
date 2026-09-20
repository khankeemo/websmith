import { NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { redis } from "@/lib/redis-client";
import { sendEmail } from "@/lib/email/mailer";

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

    const db = await getDb();
    client = await db.connect();

    // Check user display name if available
    let customerName = 'Valued Customer';
    try {
      const userRes = await client.query(
        'SELECT name FROM portal_users WHERE email = $1 LIMIT 1',
        [normalizedEmail]
      );
      if (userRes.rows.length > 0 && userRes.rows[0].name) {
        customerName = userRes.rows[0].name;
      }
    } catch {
      // Best-effort name lookup
    }

    await client.query(
      `INSERT INTO otp_verifications (email, otp_code, purpose, expires_at, created_at, verified, attempts, max_attempts)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, false, 0, 15)
       ON CONFLICT (email, purpose)
       DO UPDATE SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, created_at = CURRENT_TIMESTAMP, verified = false, attempts = 0`,
      [normalizedEmail, otp, "password_reset", expiresAt]
    );

    client.release();
    client = null;

    const emailRes = await sendEmail(
      db,
      'password_reset',
      { email: normalizedEmail, name: customerName },
      {
        otp_code: otp,
        customer_name: customerName,
        product_name: 'Websmith Digital',
      }
    );

    if (!emailRes.success) {
      console.error("Password reset email delivery failed:", emailRes.error);
      return NextResponse.json(
        { success: false, error: "Failed to send password reset code. Please try again later." },
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
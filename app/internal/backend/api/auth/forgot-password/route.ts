// FILE: app/internal/backend/api/auth/forgot-password/route.ts
// PURPOSE: Send OTP via Nodemailer SMTP for password reset

import { NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { sendEmail } from "@/lib/email/mailer";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    const normalizedEmail = email.trim().toLowerCase();
    const db = await getDb();
    client = await db.connect();

    const userResult = await client.query(
      `SELECT id, email, name FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      client.release();
      return NextResponse.json({
        success: true,
        message: "If an account exists, an OTP has been sent",
      });
    }

    const user = userResult.rows[0];
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const expiresAtISO = expiresAt.toISOString();

    await client.query(
      `INSERT INTO otp_verifications (email, otp_code, purpose, expires_at, created_at, verified, attempts, max_attempts)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, false, 0, 15)
       ON CONFLICT (email, purpose)
       DO UPDATE SET otp_code = $2, expires_at = $4, created_at = CURRENT_TIMESTAMP, verified = false, attempts = 0`,
      [normalizedEmail, otp, "password_reset", expiresAt]
    );

    client.release();
    client = null;

    const emailRes = await sendEmail(
      db,
      'password_reset',
      { email: normalizedEmail, name: user.name || "User" },
      {
        otp_code: otp,
        customer_name: user.name || "User",
        product_name: 'Websmith Digital',
      }
    );

    if (!emailRes.success) {
      return NextResponse.json(
        { success: false, error: "Failed to send OTP email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
      email: normalizedEmail,
      expires_at: expiresAtISO,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        // Ignore
      }
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
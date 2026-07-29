// FILE: app/internal/backend/api/auth/verify-otp/route.ts
// PURPOSE: Verify OTP for password reset
// DATABASE: Neon PostgreSQL

import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST(request: Request) {
  let client = null;

  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP are required" },
        { status: 400 }
      );
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP format" },
        { status: 400 }
      );
    }

    client = await pool.connect();

    // Check OTP
    const otpResult = await client.query(
      `SELECT id, email, otp_code, expires_at, verified, attempts, max_attempts
       FROM otp_verifications
       WHERE email = $1 AND purpose = 'password_reset'
       ORDER BY created_at DESC
       LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (otpResult.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "No OTP found. Please request a new one." },
        { status: 400 }
      );
    }

    const otpRecord = otpResult.rows[0];

    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      client.release();
      return NextResponse.json(
        { success: false, error: "OTP has expired. Please request a new one.", expired: true },
        { status: 400 }
      );
    }

    // Check if already verified
    if (otpRecord.verified) {
      client.release();
      return NextResponse.json(
        { success: false, error: "OTP already verified" },
        { status: 400 }
      );
    }

    // Check OTP code match
    if (otpRecord.otp_code !== otp) {
      const newAttempts = (otpRecord.attempts || 0) + 1;
      await client.query(
        `UPDATE otp_verifications SET attempts = $1 WHERE id = $2`,
        [newAttempts, otpRecord.id]
      );
      client.release();
      return NextResponse.json(
        { success: false, error: "Invalid OTP", attempts_used: newAttempts, max_attempts: otpRecord.max_attempts || 15 },
        { status: 400 }
      );
    }

    // Mark OTP as verified
    await client.query(
      `UPDATE otp_verifications SET verified = true WHERE id = $1`,
      [otpRecord.id]
    );

    client.release();

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
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
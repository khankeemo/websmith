// FILE: app/internal/backend/api/auth/reset-password/route.ts
// PURPOSE: Reset password after OTP verification
// DATABASE: Neon PostgreSQL

import { NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST(request: Request) {
  let client = null;

  try {
    const { email, otp, new_password } = await request.json();

    if (!email || !otp || !new_password) {
      return NextResponse.json(
        { success: false, error: "Email, OTP, and new password are required" },
        { status: 400 }
      );
    }

    if (new_password.length < 4) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 4 characters" },
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

    const otpResult = await client.query(
      `SELECT id, email, otp_code, expires_at
       FROM otp_verifications
       WHERE email = $1 AND otp_code = $2 AND purpose = 'password_reset'
       ORDER BY created_at DESC
       LIMIT 1`,
      [email.trim().toLowerCase(), otp]
    );

    if (otpResult.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Invalid OTP" },
        { status: 400 }
      );
    }

    const otpRecord = otpResult.rows[0];

    if (new Date(otpRecord.expires_at) < new Date()) {
      client.release();
      return NextResponse.json(
        { success: false, error: "OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(new_password, saltRounds);

    // âœ… FIXED: Changed 'users' to 'users'
    await client.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2`,
      [passwordHash, email.trim().toLowerCase()]
    );

    await client.query(
      `DELETE FROM otp_verifications WHERE id = $1`,
      [otpRecord.id]
    );

    client.release();

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
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


import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
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

    client = await pool.connect();

    const result = await client.query(
      `SELECT id, email, otp_code, expires_at, verified, attempts, max_attempts
       FROM otp_verifications
       WHERE email = $1 AND purpose = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [email.trim().toLowerCase(), "password_reset"]
    );

    if (result.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "No OTP found. Please request a new one." },
        { status: 400 }
      );
    }

    const record = result.rows[0];

    if (record.verified) {
      client.release();
      return NextResponse.json(
        { success: false, error: "OTP already used. Please request a new one." },
        { status: 400 }
      );
    }

    if (new Date(record.expires_at) < new Date()) {
      client.release();
      return NextResponse.json(
        { success: false, error: "OTP has expired. Please request a new one.", expired: true },
        { status: 400 }
      );
    }

    if (record.otp_code !== otp.toString()) {
      const newAttempts = (record.attempts || 0) + 1;
      await client.query(
        `UPDATE otp_verifications SET attempts = $1 WHERE id = $2`,
        [newAttempts, record.id]
      );
      client.release();
      return NextResponse.json(
        { success: false, error: "Invalid OTP. Please try again.", attempts_used: newAttempts, max_attempts: record.max_attempts || 15 },
        { status: 400 }
      );
    }

    await client.query(
      `UPDATE otp_verifications SET verified = true WHERE id = $1`,
      [record.id]
    );

    client.release();

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("OTP verify error (internal):", errMsg);
    if (client) {
      try { client.release(); } catch (_) {}
    }
    return NextResponse.json(
      { success: false, error: "OTP verification failed. The OTP you entered is incorrect or has expired. Please check the OTP and try again." },
      { status: 400 }
    );
  }
}
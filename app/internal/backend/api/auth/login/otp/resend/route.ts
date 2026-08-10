// FILE: app/internal/backend/api/auth/login/otp/resend/route.ts
// PURPOSE: API Center Login - RESEND login OTP (purpose 'api_login').
//          Re-sends a fresh code to the same email address (replaces the
//          previous code, resets attempts/expiry). No session is created.

import { NextResponse } from "next/server";
import { Pool } from "pg";
import { sendLoginOtp } from "@/lib/otp/login-otp";

const LOGIN_OTP_PURPOSE = "api_login";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

    const result = await sendLoginOtp(pool, LOGIN_OTP_PURPOSE, email, ipAddress);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to resend verification code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      expires_in: result.expires_in,
    });
  } catch (error) {
    console.error("❌ ===== LOGIN OTP RESEND ERROR =====");
    console.error("Error details:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resend verification code" },
      { status: 500 }
    );
  }
}
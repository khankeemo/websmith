// FILE: app/internal/backend/api/auth/login/otp/verify/route.ts
// PURPOSE: API Center Login - STEP 2 of 2 (OTP verify)
//          Verifies the login OTP (purpose 'api_login'), then creates the
//          authenticated session: updates last_login, records the login
//          notification and issues the JWT + api_center_token cookie.
//          The session is ONLY created here — never at the credentials step.

import { NextResponse } from "next/server";
import { Pool } from "pg";
import jwt from "jsonwebtoken";
import { verifyLoginOtp } from "@/lib/otp/login-otp";

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
  let client = null;

  try {
    const { email, otp, rememberMe } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP are required" },
        { status: 400 }
      );
    }

    if (typeof otp !== "string" || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP format" },
        { status: 400 }
      );
    }

    const remember = rememberMe === true;

    // 1. Verify the login OTP (server-side authoritative check)
    const otpCheck = await verifyLoginOtp(pool, LOGIN_OTP_PURPOSE, email, otp);

    if (!otpCheck.success) {
      return NextResponse.json(
        {
          success: false,
          error: otpCheck.error || "Verification failed",
          expired: otpCheck.expired,
          attempts_used: otpCheck.attempts_used,
          max_attempts: otpCheck.max_attempts,
        },
        { status: 400 }
      );
    }

    // 2. Re-fetch the user from the authoritative store
    client = await pool.connect();

    const result = await client.query(
      `SELECT id, email, password_hash, name, role, avatar, theme
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "User not found. Please sign in again." },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // 3. Update Last Login
    try {
      await client.query(
        `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
        [user.id]
      );
    } catch (updateError) {
      console.error("⚠️ Failed to update last_login:", updateError);
    }

    // 4. Create Login Notification (final step — only after OTP verify)
    try {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, link, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          user.id,
          "Login",
          `User ${user.name} logged in`,
          "login",
          "/internal/api/dashboard"
        ]
      );
    } catch (notifError) {
      console.error("⚠️ Failed to create login notification:", notifError);
    }

    client.release();

    // 5. Generate JWT Token
    const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;
    if (!JWT_SECRET) {
      console.error("❌ API_CENTER_JWT_SECRET is not set");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const tokenExpiry = remember ? "30d" : "7d";
    const cookieMaxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        theme: user.theme || "dark",
      },
      JWT_SECRET,
      { expiresIn: tokenExpiry }
    );

    // 6. Prepare Response + Cookie
    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        theme: user.theme || "dark",
      },
    });

    response.cookies.set({
      name: "api_center_token",
      value: token,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cookieMaxAge,
    });

    console.log(`✅ ===== LOGIN SUCCESSFUL for: ${user.email} =====`);
    return response;
  } catch (error) {
    console.error("❌ ===== LOGIN OTP VERIFY ERROR =====");
    console.error("Error details:", error);
    if (client) {
      try { client.release(); } catch (releaseError) {
        console.error("⚠️ Error releasing client:", releaseError);
      }
    }
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
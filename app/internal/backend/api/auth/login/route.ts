// FILE: app/internal/backend/api/auth/login/route.ts
// PURPOSE: API Center Login - STEP 1 of 2 (credentials check)
//          Validates email + password, then sends a login OTP
//          (purpose 'api_login'). NO token/cookie is issued here —
//          the session is created ONLY after the OTP is verified in
//          /login/otp/verify (two-step login, OTP once per sign-in).
// FIXED: Notification code moved BEFORE client.release()
// ADDED: Top-level debug log to verify code execution

import { NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { sendLoginOtp } from "@/lib/otp/login-otp";

const LOGIN_OTP_PURPOSE = "api_login";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.charAt(0)}***@${domain}`;
}

// ============================================================
// DATABASE CONNECTION
// ============================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ============================================================
// MAIN LOGIN HANDLER
// ============================================================

export async function POST(request: Request) {
  let client = null;

  try {
    console.log("🔐 ===== LOGIN API CALLED =====");
    
    // 1. Parse Request Body
    let email, password, rememberMe;
    try {
      const body = await request.json();
      email = body.email;
      password = body.password;
      rememberMe = body.rememberMe === true;
      
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password length: ${password ? password.length : 0}`);
      console.log(`💭 Remember Me: ${rememberMe}`);
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError);
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    // 2. Validate Input
    if (!email || !password) {
      console.log("❌ Missing email or password");
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      console.log("❌ Invalid email format");
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      console.log("❌ Password too short");
      return NextResponse.json(
        { success: false, error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    // 3. Connect to Database
    console.log("🔄 Connecting to database...");
    console.log(`📊 DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    
    try {
      client = await pool.connect();
      console.log("✅ Database connected successfully");
    } catch (dbConnectError) {
      console.error("❌ Database connection failed:", dbConnectError);
      return NextResponse.json(
        { success: false, error: "Database connection failed" },
        { status: 500 }
      );
    }

    // ============================================================
    // 🔥 TEST: Verify code is running
    // ============================================================
    try {
      await client.query(
        `INSERT INTO debug_logs (message, details) VALUES ($1, $2)`,
        ['TEST', 'Login function started at ' + new Date().toISOString()]
      );
      console.log('✅ TEST log inserted');
    } catch (testError) {
      console.error('❌ TEST log failed:', testError);
    }

    // 4. Query User
    const result = await client.query(
      `SELECT id, email, password_hash, name, role, avatar, theme
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );
    
    console.log(`📊 Query returned ${result.rows.length} rows`);

    if (result.rows.length === 0) {
      console.log(`❌ User NOT found: ${email}`);
      client.release();
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    console.log(`✅ User found: ${user.email}`);
    console.log(`👤 User role: ${user.role}`);

    // 5. Verify Password
    let isPasswordValid = false;
    
    console.log("🔑 Comparing passwords...");
    try {
      isPasswordValid = await bcrypt.compare(password, user.password_hash);
      console.log(`🔑 Password valid: ${isPasswordValid}`);
    } catch (bcryptError) {
      console.error("❌ Bcrypt compare error:", bcryptError);
      client.release();
      return NextResponse.json(
        { success: false, error: "Password verification failed" },
        { status: 500 }
      );
    }

    if (!isPasswordValid) {
      console.log(`❌ Invalid password for: ${email}`);
      client.release();
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 6. Credentials OK → Send LOGIN OTP (step 1 of two-step login)
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

    const otpResult = await sendLoginOtp(pool, LOGIN_OTP_PURPOSE, user.email, ipAddress);

    client.release();

    if (!otpResult.success) {
      console.error(`❌ Login OTP send failed for: ${user.email}`);
      return NextResponse.json(
        { success: false, error: otpResult.error || "Failed to send verification code" },
        { status: 500 }
      );
    }

    console.log(`✅ ===== STEP 1 COMPLETE for: ${user.email} — OTP sent =====`);
    return NextResponse.json({
      success: true,
      requires_otp: true,
      email: user.email,
      email_masked: maskEmail(user.email),
      expires_in: otpResult.expires_in,
    });

  } catch (error) {
    console.error("❌ ===== LOGIN ERROR =====");
    console.error("Error details:", error);
    
    if (client) {
      try { client.release(); } catch (releaseError) {
        console.error("⚠️ Error releasing client:", releaseError);
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
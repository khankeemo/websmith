// FILE: app/internal/backend/api/auth/login/route.ts
// PURPOSE: API Center Login - JWT Authentication with Cookie
// FIXED: Notification code moved BEFORE client.release()
// ADDED: Top-level debug log to verify code execution

import { NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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

    // 6. Update Last Login
    try {
      await client.query(
        `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
        [user.id]
      );
      console.log("✅ Last login updated");
    } catch (updateError) {
      console.error("⚠️ Failed to update last_login:", updateError);
    }

    // 7. Generate JWT Token
    const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;
    if (!JWT_SECRET) {
      console.error("❌ API_CENTER_JWT_SECRET is not set");
      client.release();
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const tokenExpiry = rememberMe ? "30d" : "7d";
    const cookieMaxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;

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

    console.log(`✅ JWT token generated (expires: ${tokenExpiry})`);

    // ============================================================
    // 8. Create Login Notification - BEFORE client.release()
    // ============================================================
    try {
      console.log(`📝 Creating login notification for user: ${user.id}`);
      
      // Log to debug table
      await client.query(
        `INSERT INTO debug_logs (message, details) VALUES ($1, $2)`,
        ['Notification attempt', JSON.stringify({ user_id: user.id, email: user.email })]
      );
      
      const insertResult = await client.query(
        `INSERT INTO notifications (user_id, title, message, type, link, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          user.id,
          "Login",
          `User ${user.name} logged in`,
          "login",
          "/internal/api/dashboard"
        ]
      );
      
      // Log success to debug table
      await client.query(
        `INSERT INTO debug_logs (message, details) VALUES ($1, $2)`,
        ['Notification created', JSON.stringify({ id: insertResult.rows[0].id })]
      );
      
      console.log(`✅ Login notification created with ID: ${insertResult.rows[0].id}`);
    } catch (notifError) {
      console.error("⚠️ Failed to create login notification:", notifError);
      
      // Log error to debug table
      await client.query(
        `INSERT INTO debug_logs (message, details) VALUES ($1, $2)`,
        ['Notification error', JSON.stringify({ 
          error: notifError.message, 
          stack: notifError.stack,
          code: notifError.code,
          detail: notifError.detail
        })]
      );
      // Don't throw - continue with login
    }

    // ============================================================
    // 9. Release client AFTER notification
    // ============================================================
    client.release();

    // 10. Prepare Response
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

    // 11. Set Cookie
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
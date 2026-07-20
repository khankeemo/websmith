// FILE: app/internal/backend/api/auth/logout/route.ts
// PURPOSE: Logout user and clear session with notification
// FIXED: Added better error handling and debug logging

import { NextResponse } from "next/server";
import { Pool } from "pg";
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
// MAIN LOGOUT HANDLER
// ============================================================

export async function POST(request: Request) {
  let client = null;
  
  try {
    console.log("🔐 ===== LOGOUT API CALLED =====");
    
    // 1. Get token from Authorization header or cookie
    let token = null;
    
    // Check Authorization header
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
      console.log("📌 Token from Authorization header");
    }
    
    // If not in header, check cookie
    if (!token) {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);
        token = cookies["api_center_token"];
        if (token) {
          console.log("📌 Token from cookie");
        }
      }
    }

    // 2. Decode token to get user info
    let userId = null;
    let userEmail = null;
    let userName = null;
    
    if (token) {
      try {
        const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;
        if (JWT_SECRET) {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          userId = decoded.id;
          userEmail = decoded.email;
          userName = decoded.name || "User";
          console.log(`👤 Logging out: ${userEmail} (${userId})`);
        }
      } catch (jwtError) {
        console.log("⚠️ Could not decode token:", jwtError);
        // Try to decode without verification to get user info
        try {
          const decoded = jwt.decode(token) as any;
          if (decoded) {
            userId = decoded.id;
            userEmail = decoded.email;
            userName = decoded.name || "User";
            console.log(`👤 Logging out (decoded without verify): ${userEmail} (${userId})`);
          }
        } catch (decodeError) {
          console.log("⚠️ Could not decode token at all:", decodeError);
        }
      }
    }

    // 3. Create logout notification if we have user info
    if (userId) {
      try {
        client = await pool.connect();
        console.log("✅ Database connected for logout notification");
        
        const result = await client.query(
          `INSERT INTO notifications (user_id, title, message, type, link, created_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           RETURNING id`,
          [
            userId,
            "Logout",
            `User ${userName} logged out`,
            "logout",
            "/internal/api/auth/login"
          ]
        );
        console.log(`✅ Logout notification created with ID: ${result.rows[0].id}`);
        
        client.release();
      } catch (notifError) {
        console.error("⚠️ Failed to create logout notification:", notifError);
        if (client) {
          try { client.release(); } catch (releaseError) {}
        }
        // Continue even if notification fails
      }
    } else {
      console.log("⚠️ No user ID found, skipping logout notification");
    }

    // 4. Create response
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // 5. Clear the cookie
    response.cookies.delete("api_center_token");

    console.log("✅ Logout successful - Cookie cleared");
    return response;

  } catch (error) {
    console.error("❌ Logout error:", error);
    if (client) {
      try { client.release(); } catch (releaseError) {}
    }
    return NextResponse.json(
      { success: false, error: "Failed to logout" },
      { status: 500 }
    );
  }
}
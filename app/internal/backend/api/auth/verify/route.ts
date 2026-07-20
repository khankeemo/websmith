// FILE: app/internal/backend/api/auth/verify/route.ts
// PURPOSE: Verify JWT token validity - QUERY DATABASE FOR FRESH USER DATA

import { NextResponse } from "next/server";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ valid: false, error: "No token provided" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;

    if (!JWT_SECRET) {
      console.error("API_CENTER_JWT_SECRET is not set");
      return NextResponse.json({ valid: false, error: "Server configuration error" }, { status: 500 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (jwtError) {
      return NextResponse.json({ valid: false, error: "Invalid or expired token" }, { status: 401 });
    }

    // ✅ QUERY DATABASE FOR FRESH USER DATA
    const client = await pool.connect();
    const result = await client.query(
      `SELECT id, email, name, role, avatar, theme, preferences
       FROM users
       WHERE id = $1`,
      [decoded.id]
    );
    client.release();

    if (result.rows.length === 0) {
      return NextResponse.json({ valid: false, error: "User not found" }, { status: 401 });
    }

    const user = result.rows[0];

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar || null,
        theme: user.theme || "dark",
        preferences: user.preferences || {},
      },
    });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json({ valid: false, error: "Internal server error" }, { status: 500 });
  }
}
// FILE: app/internal/backend/api/auth/register/route.ts
// PURPOSE: API Center Register - Create new admin account
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
    const { name, email, password } = await request.json();

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: "Name must be at least 2 characters" },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    client = await pool.connect();

    // âœ… FIXED: Changed 'users' to 'users'
    const existingUser = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Ensure id column has a sequence
    await client.query(
      `CREATE SEQUENCE IF NOT EXISTS users_id_seq
       OWNED BY users.id`
    );
    await client.query(
      `ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')`
    );

    const result = await client.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, email, name, role, created_at`,
      [email.trim().toLowerCase(), passwordHash, name.trim(), "admin"]
    );

    client.release();

    const user = result.rows[0];

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
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


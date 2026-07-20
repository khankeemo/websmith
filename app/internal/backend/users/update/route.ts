// FILE: D:\websmith\app\internal\backend\users\update\route.ts
// PURPOSE: Update user profile information (name, email, avatar, preferences)
// DATABASE: Neon PostgreSQL only
// ENDPOINT: PUT /internal/backend/users/update
// BODY: { user_id: string, name?: string, email?: string, avatar?: string, preferences?: object }
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateEmail } from '@/core/utils/validation-system';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function isValidEmail(email: string): boolean {
  return validateEmail(email).valid;
}

export async function PUT(request: NextRequest) {
  let client = null;
  
  try {
    const body = await request.json();
    const { user_id, name, email, avatar, preferences } = body;
    
    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    
    // Check if user exists
    const userCheck = await client.query(
      `SELECT id, email FROM users WHERE id = $1`,
      [user_id]
    );
    
    if (userCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }
    
    const existingUser = userCheck.rows[0];
    const updates: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCounter++}`);
      values.push(name.trim());
    }
    
    if (email !== undefined) {
      if (!isValidEmail(email)) {
        client.release();
        return NextResponse.json(
          { success: false, error: "Valid email address is required" },
          { status: 400 }
        );
      }
      
      // Check if email already taken by another user
      const emailCheck = await client.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [email.toLowerCase(), user_id]
      );
      
      if (emailCheck.rows.length > 0) {
        client.release();
        return NextResponse.json(
          { success: false, error: "Email already in use by another account" },
          { status: 409 }
        );
      }
      
      updates.push(`email = $${paramCounter++}`);
      values.push(email.toLowerCase());
    }
    
    if (avatar !== undefined) {
      updates.push(`avatar = $${paramCounter++}`);
      values.push(avatar || null);
    }
    
    if (preferences !== undefined) {
      updates.push(`preferences = $${paramCounter++}`);
      values.push(JSON.stringify(preferences));
    }
    
    if (updates.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }
    
    updates.push(`updated_at = $${paramCounter++}`);
    values.push(now);
    values.push(user_id);
    
    await client.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramCounter}`,
      values
    );
    
    // Log the update
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "user_update",
        `User ${user_id} profile updated`,
        now,
        clientIp,
        "",
        ""
      ]
    );
    
    // Get updated user
    const result = await client.query(
      `SELECT id, name, email, avatar, preferences, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [user_id]
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error("User update error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    );
  }
}
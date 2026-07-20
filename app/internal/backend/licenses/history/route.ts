// FILE: app/internal/backend/licenses/history/route.ts
// PURPOSE: Get license change history for audit trail
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/licenses/history?license_key=XXXXX
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// GET: Get license history
// Query params:
//   - license_key: string (required)
//   - limit: number (optional, default: 50)
//   - offset: number (optional, default: 0)
// ============================================================
export async function GET(request: NextRequest) {
  let client = null;
  
  try {
    const url = new URL(request.url);
    const licenseKey = url.searchParams.get('license_key');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!licenseKey || licenseKey.trim() === '') {
      return NextResponse.json(
        { success: false, error: "License key is required" },
        { status: 400 }
      );
    }

    const normalizedKey = licenseKey.toUpperCase();

    client = await pool.connect();

    // Check if license exists
    const licenseCheck = await client.query(
      `SELECT license_key, customer_name, customer_email, plan, status 
       FROM licenses 
       WHERE license_key = $1`,
      [normalizedKey]
    );

    if (licenseCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "License not found" },
        { status: 404 }
      );
    }

    // Get history from audit_logs
    const historyResult = await client.query(
      `SELECT 
        id,
        event_type,
        message,
        timestamp,
        ip_address
      FROM audit_logs 
      WHERE license_key = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3`,
      [normalizedKey, limit, offset]
    );

    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE license_key = $1`,
      [normalizedKey]
    );

    const total = parseInt(countResult.rows[0].total);

    client.release();

    return NextResponse.json({
      success: true,
      data: {
        license_key: normalizedKey,
        license_info: licenseCheck.rows[0],
        history: historyResult.rows,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error("Get license history error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to get license history" },
      { status: 500 }
    );
  }
}
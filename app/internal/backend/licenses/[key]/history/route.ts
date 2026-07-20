// FILE: app/internal/backend/licenses/[key]/history/route.ts
// PURPOSE: Get license change history for audit trail
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/licenses/[key]/history
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
// Params:
//   - key: string (license key)
// Query params:
//   - limit: number (optional, default: 50)
//   - offset: number (optional, default: 0)
//   - event_type: string (optional, filter by event type)
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  let client = null;
  
  try {
    const { key } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const eventType = url.searchParams.get('event_type');

    if (!key || key.trim() === '') {
      return NextResponse.json(
        { success: false, error: "License key is required" },
        { status: 400 }
      );
    }

    const normalizedKey = key.toUpperCase();

    client = await pool.connect();

    // Check if license exists
    const licenseCheck = await client.query(
      `SELECT 
        license_key,
        customer_name,
        customer_email,
        customer_username,
        plan,
        status,
        expiry_date,
        max_devices,
        duration_days,
        is_activated,
        created_at,
        updated_at,
        deleted_at,
        deleted_by
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

    // Build query for history
    let historyQuery = `
      SELECT 
        id,
        event_type,
        message,
        timestamp,
        ip_address,
        hardware_id
      FROM audit_logs 
      WHERE license_key = $1
    `;

    const queryParams: any[] = [normalizedKey];
    let paramIndex = 2;

    if (eventType) {
      historyQuery += ` AND event_type = $${paramIndex}`;
      queryParams.push(eventType);
      paramIndex++;
    }

    historyQuery += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    // Get history
    const historyResult = await client.query(historyQuery, queryParams);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE license_key = $1`;
    const countParams: any[] = [normalizedKey];
    
    if (eventType) {
      countQuery += ` AND event_type = $2`;
      countParams.push(eventType);
    }

    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Get event type summary
    const summaryResult = await client.query(
      `SELECT 
        event_type,
        COUNT(*) as count
      FROM audit_logs 
      WHERE license_key = $1
      GROUP BY event_type
      ORDER BY count DESC`,
      [normalizedKey]
    );

    client.release();

    return NextResponse.json({
      success: true,
      data: {
        license: licenseCheck.rows[0],
        history: historyResult.rows,
        summary: summaryResult.rows,
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
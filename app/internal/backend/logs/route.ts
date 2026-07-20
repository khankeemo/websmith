// FILE: D:\websmith\app\internal\backend\logs\route.ts
// PURPOSE: GET audit logs with pagination
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/logs?limit=100&offset=0
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: NextRequest) {
  let client = null;
  
  try {
    client = await pool.connect();
    const searchParams = request.nextUrl.searchParams;
    
    // Parse and validate pagination parameters
    let limit = parseInt(searchParams.get('limit') || '100');
    let offset = parseInt(searchParams.get('offset') || '0');
    
    // Validate limit (1-500)
    limit = Math.min(Math.max(limit, 1), 500);
    // Validate offset (>= 0)
    offset = Math.max(offset, 0);
    
    // Get paginated logs from audit_logs table
    const logsResult = await client.query(
      `SELECT 
        id,
        event_type,
        message,
        timestamp,
        ip_address,
        license_key,
        hardware_id
      FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    // Get total count for pagination
    const totalResult = await client.query(
      `SELECT COUNT(*) as total FROM audit_logs`
    );
    
    client.release();
    
    const total = parseInt(totalResult.rows[0]?.total || '0');
    
    return NextResponse.json({
      success: true,
      data: logsResult.rows,
      pagination: {
        total: total,
        limit: limit,
        offset: offset,
        has_more: offset + limit < total
      }
    });
    
  } catch (error) {
    console.error("Logs error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs", data: [] },
      { status: 500 }
    );
  }
}
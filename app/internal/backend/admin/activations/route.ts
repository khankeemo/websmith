// FILE: D:\websmith\app\internal\backend\admin\activations\route.ts
// PURPOSE: GET activation history with product isolation
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/admin/activations?limit=50
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only
// UPDATED: Added product isolation (only active, non-deleted products)

import { NextResponse } from "next/server";
import { Pool } from "pg";

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  let client = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    
    // Validate limit
    const validLimit = Math.min(Math.max(limit, 1), 500);
    
    client = await pool.connect();
    
    // Query with product isolation - only active, non-deleted products
    const result = await client.query(
      `
      SELECT 
        a.id,
        a.hardware_id,
        a.device_name,
        a.ip_address,
        a.activated_at,
        a.last_seen,
        l.license_key,
        l.customer_name,
        l.customer_email,
        l.plan,
        p.name as product_name,
        p.is_active as product_is_active,
        p.is_deleted as product_is_deleted
      FROM activations a
      JOIN licenses l ON a.license_key = l.license_key
      JOIN products p ON l.product_id = p.product_id
      WHERE (p.is_active = TRUE OR p.is_active IS NULL)
        AND (p.is_deleted = false OR p.is_deleted IS NULL)
      ORDER BY a.last_seen DESC
      LIMIT $1
      `,
      [validLimit]
    );
    
    client.release();
    
    const activations = result.rows;
    
    return NextResponse.json({
      success: true,
      activations: activations,
      count: activations.length,
    });
    
  } catch (error) {
    console.error("Activations error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch activations", activations: [] },
      { status: 500 }
    );
  }
}
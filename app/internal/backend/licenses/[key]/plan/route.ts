// FILE: app/internal/backend/licenses/[key]/plan/route.ts
// PURPOSE: Update license plan
// DATABASE: Neon PostgreSQL only
// ENDPOINT: PUT /internal/backend/licenses/[key]/plan
// BODY: { plan: string }
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// PUT: Update license plan
// ============================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  let client = null;
  
  try {
    const { key } = await params;
    const body = await request.json();
    const { plan } = body;
    
    // Validate license key
    if (!key) {
      return NextResponse.json(
        { success: false, error: "License key is required" },
        { status: 400 }
      );
    }
    
    // Validate plan
    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Plan is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const normalizedKey = key.toUpperCase();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const now = new Date().toISOString();
    
    // Get current license
    const licenseResult = await client.query(
      `SELECT license_key, plan, customer_name, customer_email, product_id 
       FROM licenses 
       WHERE license_key = $1`,
      [normalizedKey]
    );
    
    if (licenseResult.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "License not found" },
        { status: 404 }
      );
    }
    
    const license = licenseResult.rows[0];
    const oldPlan = license.plan;
    
    // Verify plan exists for this product
    const planCheck = await client.query(
      `SELECT id, name FROM plans 
       WHERE product_id = $1 AND name = $2 AND is_active = true`,
      [license.product_id, plan]
    );
    
    if (planCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { 
          success: false, 
          error: `Plan "${plan}" not found or inactive for this product` 
        },
        { status: 400 }
      );
    }
    
    // Update the plan
    await client.query(
      `UPDATE licenses SET plan = $1, updated_at = CURRENT_TIMESTAMP WHERE license_key = $2`,
      [plan, normalizedKey]
    );
    
    // Log to audit_logs
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "plan_update",
        `Plan changed from ${oldPlan} to ${plan} for license ${normalizedKey}`,
        now,
        clientIp,
        normalizedKey,
        ""
      ]
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: "Plan updated successfully",
      data: {
        license_key: normalizedKey,
        old_plan: oldPlan,
        new_plan: plan
      }
    });
    
  } catch (error) {
    console.error("Plan update error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to update plan" },
      { status: 500 }
    );
  }
}
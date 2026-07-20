// FILE: app/internal/backend/trials/journey/route.ts
// PURPOSE: Get customer journey timeline for a trial
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/trials/journey?trial_id={id}
// RULE: Single source of truth - Neon PostgreSQL only

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// GET /trials/journey
// ============================================================
export async function GET(request: NextRequest) {
  let client = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const trialId = searchParams.get('trial_id');
    const hardwareId = searchParams.get('hardware_id');
    
    if (!trialId && !hardwareId) {
      return NextResponse.json(
        { success: false, error: "trial_id or hardware_id is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    // ============================================================
    // 1. GET TRIAL DETAILS
    // ============================================================
    
    let trialQuery = `
      SELECT 
        t.id,
        t.hardware_id,
        t.status,
        t.started_at,
        t.expiry_date,
        t.product_id,
        t.plan_id,
        t.customer_name,
        t.customer_email,
        t.mobile_number,
        t.ip_address,
        t.cpu_id,
        t.motherboard_id,
        t.device_hash,
        t.software_version,
        t.os_info,
        t.installation_timestamp,
        t.converted_at,
        t.converted_to_license_key,
        p.name as product_name,
        pl.name as plan_name
      FROM trials t
      LEFT JOIN products p ON t.product_id = p.product_id
      LEFT JOIN plans pl ON t.plan_id = pl.id
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    
    if (trialId) {
      trialQuery += ` AND t.id = $1`;
      queryParams.push(parseInt(trialId));
    } else if (hardwareId) {
      trialQuery += ` AND t.hardware_id = $1`;
      queryParams.push(hardwareId);
    }
    
    const trialResult = await client.query(trialQuery, queryParams);
    
    if (trialResult.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Trial not found" },
        { status: 404 }
      );
    }
    
    const trial = trialResult.rows[0];
    
    // ============================================================
    // 2. GET JOURNEY FROM trial_audit_logs
    // ============================================================
    
    const journeyResult = await client.query(
      `SELECT 
        id,
        event_type,
        message,
        timestamp,
        ip_address,
        metadata
      FROM trial_audit_logs
      WHERE trial_id = $1
      ORDER BY timestamp ASC`,
      [trial.id]
    );
    
    // ============================================================
    // 3. BUILD JOURNEY TIMELINE
    // ============================================================
    
    const journey = journeyResult.rows.map((log: any) => ({
      event_type: log.event_type,
      message: log.message,
      timestamp: log.timestamp,
      ip_address: log.ip_address,
      metadata: log.metadata || {}
    }));
    
    // ============================================================
    // 4. CALCULATE METRICS
    // ============================================================
    
    const now = new Date();
    const expiryDate = new Date(trial.expiry_date);
    const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const startedAt = new Date(trial.started_at);
    const daysActive = Math.max(1, Math.ceil((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Count events by type
    const eventCounts: Record<string, number> = {};
    journey.forEach((j: any) => {
      eventCounts[j.event_type] = (eventCounts[j.event_type] || 0) + 1;
    });
    
    // ============================================================
    // 5. BUILD RESPONSE
    // ============================================================
    
    client.release();
    
    return NextResponse.json({
      success: true,
      trial: {
        id: trial.id,
        hardware_id: trial.hardware_id,
        status: trial.status,
        started_at: trial.started_at,
        expiry_date: trial.expiry_date,
        days_left: daysLeft,
        days_active: daysActive,
        product_id: trial.product_id,
        product_name: trial.product_name || 'Unknown Product',
        plan_id: trial.plan_id,
        plan_name: trial.plan_name || 'Unknown Plan',
        customer_name: trial.customer_name,
        customer_email: trial.customer_email,
        mobile_number: trial.mobile_number,
        ip_address: trial.ip_address,
        software_version: trial.software_version,
        os_info: trial.os_info,
        installation_timestamp: trial.installation_timestamp,
        converted_at: trial.converted_at,
        converted_to_license_key: trial.converted_to_license_key,
        device_hash: trial.device_hash,
        cpu_id: trial.cpu_id,
        motherboard_id: trial.motherboard_id
      },
      journey: journey,
      summary: {
        total_events: journey.length,
        event_counts: eventCounts,
        first_event: journey.length > 0 ? journey[0] : null,
        last_event: journey.length > 0 ? journey[journey.length - 1] : null
      }
    });
    
  } catch (error) {
    console.error("❌ Journey fetch error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch trial journey",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
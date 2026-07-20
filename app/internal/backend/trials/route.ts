// FILE: app/internal/backend/trials/route.ts
// PURPOSE: GET list of all trials with full details (product, plan, days left)
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/trials
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// GET /internal/backend/trials
// Description: Get all trials with product and plan details
// ============================================================
export async function GET() {
  let client = null;
  
  try {
    client = await pool.connect();
    const now = new Date();
    const nowISO = now.toISOString();
    
    // Fetch trials with product and plan details
    const result = await client.query(`
      SELECT 
        t.id,
        t.hardware_id,
        t.status,
        t.started_at,
        t.expiry_date,
        t.product_id,
        t.plan_id,
        t.converted_at,
        t.converted_to_license_key,
        p.name as product_name,
        pl.name as plan_name,
        pl.trial_days_limit,
        pl.max_devices,
        pl.is_trial_plan
      FROM trials t
      LEFT JOIN products p ON t.product_id = p.product_id
      LEFT JOIN plans pl ON t.plan_id = pl.id
      ORDER BY t.started_at DESC
    `);
    
    client.release();
    
    // Process trials with days left calculation
    const trialsWithDetails = result.rows.map((trial: any) => {
      let daysLeft = 0;
      let isExpired = false;
      
      if (trial.status === 'active' && trial.expiry_date) {
        const expiry = new Date(trial.expiry_date);
        daysLeft = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        isExpired = daysLeft === 0;
      }
      
      // Auto-update expired trials (when fetching)
      if (trial.status === 'active' && isExpired) {
        // We'll handle this in a separate update if needed
        // For now, just mark as expired in the response
        trial.status = 'expired';
      }
      
      return {
        id: trial.id,
        hardware_id: trial.hardware_id,
        status: trial.status,
        started_at: trial.started_at?.split('T')[0],
        expiry_date: trial.expiry_date?.split('T')[0],
        days_left: daysLeft,
        product_id: trial.product_id,
        product_name: trial.product_name || 'Unknown Product',
        plan_id: trial.plan_id,
        plan_name: trial.plan_name || 'Unknown Plan',
        trial_days_limit: trial.trial_days_limit || 0,
        max_devices: trial.max_devices || 0,
        is_trial_plan: trial.is_trial_plan || false,
        converted_at: trial.converted_at,
        converted_to_license_key: trial.converted_to_license_key,
        // Additional flags for UI
        can_convert: trial.status === 'active' && daysLeft > 0,
        is_expired: trial.status === 'expired' || (trial.status === 'active' && daysLeft === 0),
        is_converted: trial.status === 'converted'
      };
    });
    
    // Count stats
    const activeCount = trialsWithDetails.filter((t: any) => t.status === 'active' && t.days_left > 0).length;
    const expiredCount = trialsWithDetails.filter((t: any) => t.status === 'expired' || t.status === 'converted').length;
    const convertedCount = trialsWithDetails.filter((t: any) => t.status === 'converted').length;
    
    return NextResponse.json({
      success: true,
      trials: trialsWithDetails,
      count: trialsWithDetails.length,
      stats: {
        active: activeCount,
        expired: expiredCount - convertedCount,
        converted: convertedCount,
        total: trialsWithDetails.length
      }
    });
    
  } catch (error) {
    console.error("Trials error:", error);
    
    if (client) client.release();
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch trials", trials: [] },
      { status: 500 }
    );
  }
}
// FILE: app/internal/backend/admin/trials/suspicious/route.ts
// PURPOSE: List all suspicious trials
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/admin/trials/suspicious
// QUERY PARAMS: severity? (low, medium, high, critical), notified? (true, false)

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// GET /admin/trials/suspicious
// ============================================================
export async function GET(request: NextRequest) {
  let client = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const notified = searchParams.get('notified');
    
    client = await pool.connect();
    
    let query = `
      SELECT 
        t.id,
        t.hardware_id,
        t.status,
        t.started_at,
        t.expiry_date,
        t.customer_name,
        t.customer_email,
        t.mobile_number,
        t.ip_address,
        t.cpu_id,
        t.motherboard_id,
        t.device_hash,
        t.software_version,
        t.os_info,
        t.suspicious_flag,
        t.suspicious_reason,
        t.suspicious_logged_at,
        t.notified_admin,
        t.reset_attempts,
        p.name as product_name,
        pl.name as plan_name,
        (SELECT COUNT(*) FROM trial_audit_logs WHERE trial_id = t.id) as event_count
      FROM trials t
      LEFT JOIN products p ON t.product_id = p.product_id
      LEFT JOIN plans pl ON t.plan_id = pl.id
      WHERE t.suspicious_flag = true
    `;
    
    const params: any[] = [];
    let paramCounter = 1;
    
    if (severity) {
      // Severity is stored in suspicious_reason as text, we'll filter in application
      // Or we can add a severity column if needed
    }
    
    if (notified === 'true') {
      query += ` AND t.notified_admin = true`;
    } else if (notified === 'false') {
      query += ` AND t.notified_admin = false`;
    }
    
    query += ` ORDER BY t.suspicious_logged_at DESC`;
    
    const result = await client.query(query);
    
    client.release();
    
    // Process results
    const trials = result.rows.map((row: any) => {
      // Parse reasons from semicolon-separated string
      const reasons = row.suspicious_reason ? row.suspicious_reason.split('; ').filter((r: string) => r.trim()) : [];
      
      // Determine severity based on reasons count and content
      let severity = 'low';
      if (reasons.length >= 3) severity = 'high';
      if (reasons.length >= 5) severity = 'critical';
      if (reasons.length === 1 || reasons.length === 2) severity = 'medium';
      
      return {
        id: row.id,
        hardware_id: row.hardware_id,
        status: row.status,
        started_at: row.started_at,
        expiry_date: row.expiry_date,
        product_name: row.product_name || 'Unknown',
        plan_name: row.plan_name || 'Unknown',
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        mobile_number: row.mobile_number,
        ip_address: row.ip_address,
        suspicious_flag: row.suspicious_flag,
        suspicious_reason: row.suspicious_reason,
        suspicious_logged_at: row.suspicious_logged_at,
        notified_admin: row.notified_admin,
        reset_attempts: row.reset_attempts,
        event_count: parseInt(row.event_count),
        severity: severity,
        reasons: reasons,
        device_hash: row.device_hash ? row.device_hash.substring(0, 16) + '...' : null,
        software_version: row.software_version,
        os_info: row.os_info
      };
    });
    
    // Stats
    const total = trials.length;
    const unread = trials.filter((t: any) => !t.notified_admin).length;
    const bySeverity = {
      low: trials.filter((t: any) => t.severity === 'low').length,
      medium: trials.filter((t: any) => t.severity === 'medium').length,
      high: trials.filter((t: any) => t.severity === 'high').length,
      critical: trials.filter((t: any) => t.severity === 'critical').length
    };
    
    return NextResponse.json({
      success: true,
      trials,
      count: total,
      unread_count: unread,
      by_severity: bySeverity,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Suspicious trials error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch suspicious trials",
        trials: [],
        count: 0,
        unread_count: 0,
        by_severity: { low: 0, medium: 0, high: 0, critical: 0 }
      },
      { status: 500 }
    );
  }
}
// FILE: app/internal/backend/trials/analyze/route.ts
// PURPOSE: Analyze a trial for suspicious activity (VM abuse, spoofing, multiple attempts)
// DATABASE: Neon PostgreSQL only
// ENDPOINT: POST /internal/backend/trials/analyze
// BODY: { trial_id: number, hardware_id?: string }
// RULE: Single source of truth - Neon PostgreSQL only

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// TYPES
// ============================================================

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface SuspicionResult {
  flagged: boolean;
  reasons: string[];
  severity: Severity;
  recommendations: string[];
}

// ============================================================
// SUSPICIOUS ACTIVITY DETECTION RULES
// ============================================================

async function detectSuspiciousActivity(
  client: any,
  trial: any,
  hardwareId: string
): Promise<SuspicionResult> {
  const reasons: string[] = [];
  let severity: Severity = 'low';
  const recommendations: string[] = [];
  
  // ============================================================
  // 1. CHECK: Multiple trials from same email
  // ============================================================
  if (trial.customer_email) {
    const emailTrials = await client.query(
      `SELECT COUNT(*) as count FROM trials 
       WHERE customer_email = $1 AND id != $2`,
      [trial.customer_email, trial.id]
    );
    
    const totalTrials = parseInt(emailTrials.rows[0].count);
    
    if (totalTrials > 5 && totalTrials <= 10) {
      reasons.push(`Multiple trials from same email: ${totalTrials} total`);
      if (severity === 'low') severity = 'medium';
      recommendations.push('Review email for potential abuse');
    }
    
    if (totalTrials > 10) {
      reasons.push(`Excessive trials from same email: ${totalTrials} total`);
      severity = 'high';
      recommendations.push('Block email from creating more trials');
    }
  }
  
  // ============================================================
  // 2. CHECK: Same hardware multiple times
  // ============================================================
  const hardwareHistory = await client.query(
    `SELECT COUNT(*) as count FROM trials 
     WHERE hardware_id = $1 AND id != $2`,
    [hardwareId, trial.id]
  );
  
  const totalHardwareTrials = parseInt(hardwareHistory.rows[0].count);
  
  if (totalHardwareTrials > 3 && totalHardwareTrials <= 5) {
    reasons.push(`Hardware reused for multiple trials: ${totalHardwareTrials} times`);
    if (severity === 'low') severity = 'medium';
    recommendations.push('Verify hardware is legitimate');
  }
  
  if (totalHardwareTrials > 5) {
    reasons.push(`Excessive hardware reuse: ${totalHardwareTrials} times`);
    if (severity !== 'high') severity = 'high';
    recommendations.push('Flag hardware ID for review');
  }
  
  // ============================================================
  // 3. CHECK: VM or sandbox detection
  // ============================================================
  if (trial.os_info) {
    const osInfo = typeof trial.os_info === 'string' 
      ? JSON.parse(trial.os_info) 
      : trial.os_info;
    
    const vmIndicators = [
      'vmware', 'virtualbox', 'qemu', 'kvm', 'xen', 
      'hyper-v', 'parallels', 'vbox'
    ];
    
    const osString = JSON.stringify(osInfo).toLowerCase();
    const foundVm = vmIndicators.some(indicator => osString.includes(indicator));
    
    if (foundVm) {
      reasons.push('VM or sandbox environment detected');
      if (severity === 'low') severity = 'medium';
      recommendations.push('Verify this is a legitimate installation');
    }
  }
  
  // ============================================================
  // 4. CHECK: CPU/Motherboard spoofing
  // ============================================================
  if (trial.cpu_id && trial.motherboard_id) {
    const comboCheck = await client.query(
      `SELECT COUNT(*) as count FROM trials 
       WHERE cpu_id = $1 AND motherboard_id = $2 AND id != $3`,
      [trial.cpu_id, trial.motherboard_id, trial.id]
    );
    
    if (parseInt(comboCheck.rows[0].count) > 2) {
      reasons.push('Suspicious CPU/Motherboard combination reused multiple times');
      if (severity === 'low') severity = 'medium';
      recommendations.push('Flag hardware combination for review');
    }
  }
  
  // ============================================================
  // 5. CHECK: Invalid or missing device hash
  // ============================================================
  if (!trial.device_hash || trial.device_hash.length < 10) {
    reasons.push('Missing or invalid device hash');
    // Don't increase severity for this
    recommendations.push('Verify device fingerprinting is working');
  }
  
  // ============================================================
  // 6. CHECK: Expired trial attempts
  // ============================================================
  const expiryDate = new Date(trial.expiry_date);
  const now = new Date();
  
  if (expiryDate < now && trial.status === 'active') {
    reasons.push('Trial active but already expired');
    if (severity === 'low') severity = 'medium';
    recommendations.push('Auto-update trial status to expired');
  }
  
  // ============================================================
  // 7. CHECK: Multiple converted trials from same IP
  // ============================================================
  if (trial.ip_address) {
    const ipConversions = await client.query(
      `SELECT COUNT(*) as count FROM trials 
       WHERE ip_address = $1 AND status = 'converted' AND id != $2`,
      [trial.ip_address, trial.id]
    );
    
    if (parseInt(ipConversions.rows[0].count) > 3) {
      reasons.push(`Multiple conversions from same IP: ${ipConversions.rows[0].count}`);
      if (severity === 'low') severity = 'medium';
      recommendations.push('Review IP for potential fraud');
    }
  }
  
  // ============================================================
  // 8. CHECK: Rapid trial resets
  // ============================================================
  if (trial.reset_attempts && trial.reset_attempts > 2) {
    reasons.push(`Multiple reset attempts: ${trial.reset_attempts}`);
    if (severity === 'low') severity = 'medium';
    recommendations.push('Investigate reset activity');
  }
  
  // ============================================================
  // DETERMINE FINAL SEVERITY
  // ============================================================
  if (reasons.length >= 5) {
    severity = 'critical';
  } else if (reasons.length >= 3 && severity !== 'high') {
    severity = 'high';
  }
  
  return {
    flagged: reasons.length > 0,
    reasons,
    severity,
    recommendations
  };
}

// ============================================================
// MAIN: POST /trials/analyze
// ============================================================
export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    const body = await request.json();
    const { trial_id, hardware_id } = body;
    
    if (!trial_id && !hardware_id) {
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
        id,
        hardware_id,
        status,
        expiry_date,
        started_at,
        customer_email,
        customer_name,
        mobile_number,
        ip_address,
        cpu_id,
        motherboard_id,
        device_hash,
        software_version,
        os_info,
        reset_attempts,
        suspicious_flag,
        suspicious_reason,
        suspicious_logged_at,
        notified_admin
      FROM trials
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    
    if (trial_id) {
      trialQuery += ` AND id = $1`;
      queryParams.push(trial_id);
    } else if (hardware_id) {
      trialQuery += ` AND hardware_id = $1`;
      queryParams.push(hardware_id);
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
    // 2. RUN SUSPICIOUS ACTIVITY DETECTION
    // ============================================================
    
    const result = await detectSuspiciousActivity(client, trial, trial.hardware_id);
    
    // ============================================================
    // 3. UPDATE TRIAL IF FLAGGED
    // ============================================================
    
    if (result.flagged) {
      await client.query(
        `UPDATE trials 
         SET 
           suspicious_flag = true,
           suspicious_reason = $1,
           suspicious_logged_at = $2,
           notified_admin = false
         WHERE id = $3`,
        [
          result.reasons.join('; '),
          new Date().toISOString(),
          trial.id
        ]
      );
      
      // ============================================================
      // 4. LOG TO TRIAL AUDIT LOGS
      // ============================================================
      
      await client.query(
        `INSERT INTO trial_audit_logs (trial_id, event_type, message, timestamp, ip_address, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          trial.id,
          "suspicious_activity",
          `Suspicious activity detected: ${result.reasons.join('; ')}`,
          new Date().toISOString(),
          trial.ip_address || 'unknown',
          JSON.stringify({
            severity: result.severity,
            reasons: result.reasons,
            recommendations: result.recommendations
          })
        ]
      );
      
      // ============================================================
      // 5. LOG TO AUDIT LOGS
      // ============================================================
      
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "suspicious_trial",
          `Suspicious activity flagged for trial ${trial.id} (${trial.hardware_id})`,
          new Date().toISOString(),
          trial.ip_address || 'unknown',
          '',
          trial.hardware_id
        ]
      );
    }
    
    client.release();
    
    return NextResponse.json({
      success: true,
      trial_id: trial.id,
      hardware_id: trial.hardware_id,
      flagged: result.flagged,
      severity: result.severity,
      reasons: result.reasons,
      recommendations: result.recommendations,
      message: result.flagged 
        ? 'Suspicious activity detected and logged' 
        : 'No suspicious activity detected'
    });
    
  } catch (error) {
    console.error("❌ Trial analysis error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to analyze trial",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
// FILE: app/internal/backend/trials/status/route.ts
// PURPOSE: Check trial status for a hardware device with full product details
// DATABASE: Neon PostgreSQL only
// ENDPOINT: POST /internal/backend/trials/status
// BODY: { hardware_id: string, include_details?: boolean }
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only
// RULE 5 & 6: No hardcoded product names - generic fallback

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// HELPERS
// ============================================================

/**
 * Get product details with plan and template information
 */
async function getTrialDetails(client: any, hardwareId: string) {
  const result = await client.query(
    `SELECT 
      t.id,
      t.hardware_id,
      t.status,
      t.expiry_date,
      t.started_at,
      t.product_id,
      t.plan_id,
      t.user_id,
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
      t.trial_template_id,
      -- Product details
      p.name as product_name,
      p.version as product_version,
      p.description as product_description,
      p.company_name,
      p.website,
      p.support_url,
      p.docs_url,
      p.short_description,
      -- Plan details
      pl.name as plan_name,
      pl.description as plan_description,
      pl.price as plan_price,
      pl.default_expiry_days as plan_duration,
      pl.max_devices,
      pl.trial_days_limit,
      pl.features as plan_features,
      -- Template details
      tt.name as template_name,
      tt.duration_days as template_duration,
      tt.hardware_binding_enabled,
      tt.max_hardware_changes,
      tt.collect_name,
      tt.collect_email,
      tt.collect_mobile,
      tt.support_url as template_support_url,
      tt.store_url,
      tt.offline_cache_enabled
    FROM trials t
    LEFT JOIN products p ON t.product_id = p.product_id
    LEFT JOIN plans pl ON t.plan_id = pl.id
    LEFT JOIN trial_templates tt ON t.trial_template_id = tt.id
    WHERE t.hardware_id = $1`,
    [hardwareId]
  );
  
  return result.rows[0] || null;
}

/**
 * Build upgrade dialog configuration
 */
function buildUpgradeConfig(trial: any, daysLeft: number): any {
  const config = {
    show_upgrade: false,
    upgrade_trigger: 'never',
    upgrade_button_text: 'Upgrade Now',
    support_button_text: 'Contact Support',
    benefits: []
  };

  // Show upgrade dialog based on days left
  if (trial.status === 'active' || trial.status === 'expired') {
    if (daysLeft === 0 || trial.status === 'expired') {
      config.show_upgrade = true;
      config.upgrade_trigger = 'expired';
      config.upgrade_button_text = 'Purchase License';
      config.benefits = [
        'Full software access',
        'Priority support',
        'Automatic updates',
        'Commercial license',
        'Extended warranty'
      ];
    } else if (daysLeft <= 3) {
      config.show_upgrade = true;
      config.upgrade_trigger = 'expiring_soon';
      config.benefits = [
        'Full software access',
        'Priority support',
        'Automatic updates',
        'Commercial license'
      ];
    } else if (daysLeft <= 7) {
      config.show_upgrade = true;
      config.upgrade_trigger = 'mid_trial';
      config.benefits = [
        'Unlock all features',
        'Priority support',
        'Commercial use rights'
      ];
    }
  }

  return config;
}

// ============================================================
// MAIN: POST /trials/status
// ============================================================
export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    const body = await request.json();
    const { hardware_id, include_details } = body;
    
    if (!hardware_id) {
      return NextResponse.json(
        { active: false, error: "hardware_id is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const now = new Date();
    const nowISO = now.toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    
    // ============================================================
    // 1. FETCH TRIAL WITH FULL DETAILS
    // ============================================================
    
    const trial = await getTrialDetails(client, hardware_id);
    
    if (!trial) {
      client.release();
      return NextResponse.json({
        active: false,
        has_trial: false,
        message: "No trial found"
      });
    }

    // Paid license takes precedence over trial
    const paidCheck = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM licenses l
        INNER JOIN activations a ON l.license_key = a.license_key AND a.hardware_id = $1
        WHERE (l.is_trial IS NULL OR l.is_trial = false)
      ) OR EXISTS (
        SELECT 1 FROM licenses l
        WHERE l.customer_email = $2 AND (l.is_trial IS NULL OR l.is_trial = false)
      ) AS has_paid_license`,
      [hardware_id, trial.customer_email || '']
    );
    if (paidCheck.rows[0]?.has_paid_license) {
      client.release();
      return NextResponse.json({
        active: false,
        has_trial: false,
        message: "A paid license is associated with this hardware. Trial is not available."
      });
    }
    
    // ============================================================
    // 2. CALCULATE DAYS LEFT
    // ============================================================
    
    const expiryDate = new Date(trial.expiry_date);
    const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const isExpired = daysLeft === 0;
    
    // ============================================================
    // 3. AUTO-UPDATE EXPIRED TRIAL
    // ============================================================
    
    if (isExpired && trial.status === 'active') {
      await client.query(
        `UPDATE trials SET status = $1, expired_at = $2 WHERE hardware_id = $3`,
        ['expired', nowISO, hardware_id]
      );
      trial.status = 'expired';
    }
    
    // ============================================================
    // 4. BUILD BASE RESPONSE
    // ============================================================
    
    const isActive = trial.status === 'active' && daysLeft > 0;
    
    const response: any = {
      active: isActive,
      has_trial: true,
      status: trial.status,
      days_left: daysLeft,
      expiry_date: trial.expiry_date,
      started_at: trial.started_at,
      // Basic product info
      product_id: trial.product_id,
      product_name: trial.product_name || 'Unknown Product',
      product_version: trial.product_version || '1.0.0',
      plan_id: trial.plan_id,
      plan_name: trial.plan_name || 'Trial',
      // Customer info
      customer_name: trial.customer_name,
      customer_email: trial.customer_email,
      mobile_number: trial.mobile_number,
      // Hardware info
      hardware_id: trial.hardware_id,
      cpu_id: trial.cpu_id,
      motherboard_id: trial.motherboard_id,
      device_hash: trial.device_hash,
      software_version: trial.software_version,
      // Timestamps
      installation_timestamp: trial.installation_timestamp,
      converted_at: trial.converted_at,
      converted_to_license_key: trial.converted_to_license_key
    };
    
    // ============================================================
    // 5. ADD DETAILED INFORMATION (if requested)
    // ============================================================
    
    if (include_details !== false) {
      // Product details
      response.product_description = trial.product_description;
      response.product_short_description = trial.short_description;
      response.company_name = trial.company_name;
      response.company_website = trial.website;
      response.support_url = trial.support_url || trial.template_support_url;
      response.docs_url = trial.docs_url;
      
      // Plan details
      response.plan_description = trial.plan_description;
      response.plan_price = trial.plan_price;
      response.plan_duration = trial.plan_duration || trial.template_duration;
      response.max_devices = trial.max_devices || 0;
      response.plan_features = trial.plan_features || [];
      response.trial_days_limit = trial.trial_days_limit || trial.template_duration || 0;
      
      // Template details
      response.template_name = trial.template_name;
      response.template_duration = trial.template_duration;
      response.hardware_binding_enabled = trial.hardware_binding_enabled;
      response.max_hardware_changes = trial.max_hardware_changes;
      response.store_url = trial.store_url;
      response.offline_cache_enabled = trial.offline_cache_enabled;
      
      // Collection settings
      response.collect_settings = {
        name: trial.collect_name,
        email: trial.collect_email,
        mobile: trial.collect_mobile
      };
      
      // Upgrade dialog configuration
      response.upgrade_config = buildUpgradeConfig(trial, daysLeft);
      
      // OS Info
      if (trial.os_info) {
        response.os_info = trial.os_info;
      }
    }
    
    // ============================================================
    // 6. TRIAL AUDIT LOG (Status Check)
    // ============================================================
    
    try {
      await client.query(
        `INSERT INTO trial_audit_logs (trial_id, event_type, message, timestamp, ip_address, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          trial.id,
          "status_checked",
          `Trial status checked for ${hardware_id}`,
          nowISO,
          clientIp,
          JSON.stringify({
            status: trial.status,
            days_left: daysLeft,
            active: isActive
          })
        ]
      );
    } catch (logError) {
      console.error("Failed to log trial_audit_logs:", logError);
      // Continue - don't fail the request
    }
    
    client.release();
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Trial status error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { active: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
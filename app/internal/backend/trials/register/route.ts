// FILE: app/internal/backend/trials/register/route.ts
// PURPOSE: Universal Software Registration - Auto-configure software from API response
// DATABASE: Neon PostgreSQL only
// ENDPOINT: POST /internal/backend/trials/register
// RULE: Single source of truth - Neon PostgreSQL only
// RULE: No hardcoded product values - everything comes from database

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { triggerNotification } from '@/lib/notification/notification-service';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// HELPERS
// ============================================================

/**
 * Get product configuration from database
 */
async function getProductConfig(client: any, productId: string) {
  const result = await client.query(
    `SELECT 
      product_id,
      name,
      version,
      description,
      short_description,
      price,
      is_active,
      company_name,
      website,
      support_url,
      docs_url,
      logo_url,
      platform
    FROM products
    WHERE product_id = $1 AND (is_deleted = false OR is_deleted IS NULL)`,
    [productId]
  );
  
  return result.rows[0] || null;
}

/**
 * Get trial plan for product
 */
async function getTrialPlan(client: any, productId: string) {
  const result = await client.query(
    `SELECT 
      id,
      name,
      description,
      price,
      default_expiry_days as duration_days,
      max_devices,
      is_trial_plan,
      trial_days_limit,
      features
    FROM plans
    WHERE product_id = $1 
      AND is_trial_plan = true 
      AND is_active = true
    ORDER BY display_order ASC
    LIMIT 1`,
    [productId]
  );
  
  return result.rows[0] || null;
}

/**
 * Get all plans for a product
 */
async function getProductPlans(client: any, productId: string): Promise<any[]> {
  const result = await client.query(
    `SELECT 
      id, name, description, price, default_expiry_days as duration_days,
      max_devices, is_active, is_trial_plan, trial_days_limit, features
    FROM plans
    WHERE product_id = $1 AND is_active = true
    ORDER BY display_order ASC, id ASC`,
    [productId]
  );
  return result.rows;
}

/**
 * Get trial template configuration
 */
async function getTrialTemplate(client: any, templateId: number) {
  if (!templateId) return null;
  
  const result = await client.query(
    `SELECT 
      id,
      name,
      description,
      duration_days,
      hardware_binding_enabled,
      max_hardware_changes,
      collect_name,
      collect_email,
      collect_mobile,
      support_url as template_support_url,
      store_url,
      offline_cache_enabled
    FROM trial_templates
    WHERE id = $1 AND is_active = true`,
    [templateId]
  );
  
  return result.rows[0] || null;
}

/**
 * Build upgrade dialog configuration from actual product plans
 */
function buildUpgradeConfig(product: any, plan: any, plans: any[]): any {
  const upgradePlans = (plans || [])
    .filter((p: any) => !p.is_trial_plan && p.is_active)
    .map((p: any) => ({
      name: p.name,
      price: Number(p.price) || 0,
      features: Array.isArray(p.features) ? p.features.slice(0, 5) : []
    }));

  return {
    show_upgrade: upgradePlans.length > 0,
    upgrade_trigger: 'mid_trial',
    upgrade_button_text: 'Upgrade Now',
    support_button_text: 'Contact Support',
    benefits: upgradePlans.length > 0
      ? ['Full software access', 'Priority support', 'Automatic updates', 'Commercial license']
      : [],
    plans: upgradePlans
  };
}

// ============================================================
// MAIN: POST /trials/register
// ============================================================
export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    const body = await request.json();
    const {
      product_id,
      hardware_id,
      customer_name,
      customer_email,
      mobile_number,
      cpu_id,
      motherboard_id,
      device_hash,
      software_version,
      os_info,
      installation_timestamp
    } = body;
    
    // ============================================================
    // 1. VALIDATION
    // ============================================================
    
    if (!product_id) {
      return NextResponse.json(
        { success: false, error: "product_id is required" },
        { status: 400 }
      );
    }
    
    if (!hardware_id) {
      return NextResponse.json(
        { success: false, error: "hardware_id is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const now = new Date();
    const nowISO = now.toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    
    // ============================================================
    // 2. GET PRODUCT CONFIGURATION
    // ============================================================
    
    const product = await getProductConfig(client, product_id);
    
    if (!product) {
      client.release();
      return NextResponse.json(
        { 
          success: false, 
          error: `Product "${product_id}" not found or inactive` 
        },
        { status: 404 }
      );
    }
    
    // ============================================================
    // 3. GET TRIAL PLAN
    // ============================================================
    
    const trialPlan = await getTrialPlan(client, product_id);
    
    if (!trialPlan) {
      client.release();
      return NextResponse.json(
        { 
          success: false, 
          error: `No trial plan found for product "${product_id}"` 
        },
        { status: 404 }
      );
    }
    
    // ============================================================
    // 4. GET UNIVERSAL TRIAL TEMPLATE
    // ============================================================
    
    const universalTrialResult = await client.query(
      `SELECT id, duration_days FROM trial_templates WHERE is_system_default = true AND is_active = true LIMIT 1`
    );
    const universalTrial = universalTrialResult.rows[0] || null;

    const template = await getTrialTemplate(client, universalTrial?.id);
    
    // ============================================================
    // 5. CHECK FOR EXISTING TRIAL
    // ============================================================
    
    const existingTrial = await client.query(
      `SELECT id, status, expiry_date FROM trials WHERE hardware_id = $1 AND product_id = $2`,
      [hardware_id, product_id]
    );
    
    const hasActiveTrial = existingTrial.rows.length > 0 && 
      existingTrial.rows[0].status === 'active' &&
      new Date(existingTrial.rows[0].expiry_date) > now;
    
    // ============================================================
    // 6. CALCULATE TRIAL DETAILS
    // ============================================================
    
    const trialDuration = trialPlan.trial_days_limit || template?.duration_days || 0;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + trialDuration);
    const expiryDateISO = expiryDate.toISOString();
    
    // ============================================================
    // 7. CREATE OR UPDATE TRIAL
    // ============================================================
    
    if (existingTrial.rows.length > 0) {
      // Update existing trial
      await client.query(
        `UPDATE trials 
         SET 
           status = 'active',
           expiry_date = $1,
           started_at = $2,
           plan_id = $3,
           customer_name = COALESCE($4, customer_name),
           customer_email = COALESCE($5, customer_email),
           mobile_number = COALESCE($6, mobile_number),
           ip_address = $7,
           cpu_id = COALESCE($8, cpu_id),
           motherboard_id = COALESCE($9, motherboard_id),
           device_hash = COALESCE($10, device_hash),
           software_version = COALESCE($11, software_version),
           os_info = COALESCE($12, os_info),
           installation_timestamp = COALESCE($13, installation_timestamp),
           trial_template_id = COALESCE($14, trial_template_id)
         WHERE hardware_id = $15`,
        [
          expiryDateISO,
          nowISO,
          trialPlan.id,
          customer_name || null,
          customer_email || null,
          mobile_number || null,
          clientIp,
          cpu_id || null,
          motherboard_id || null,
          device_hash || null,
          software_version || null,
          os_info || null,
          installation_timestamp || nowISO,
          template?.id || null,
          hardware_id
        ]
      );
    } else {
      // Create new trial
      await client.query(
        `INSERT INTO trials (
          hardware_id,
          status,
          expiry_date,
          started_at,
          product_id,
          plan_id,
          customer_name,
          customer_email,
          mobile_number,
          ip_address,
          cpu_id,
          motherboard_id,
          device_hash,
          software_version,
          os_info,
          installation_timestamp,
          trial_template_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          hardware_id,
          'active',
          expiryDateISO,
          nowISO,
          product_id,
          trialPlan.id,
          customer_name || null,
          customer_email || null,
          mobile_number || null,
          clientIp,
          cpu_id || null,
          motherboard_id || null,
          device_hash || null,
          software_version || null,
          os_info || null,
          installation_timestamp || nowISO,
          template?.id || null
        ]
      );
    }
    
    // ============================================================
    // 8. LOG TO TRIAL AUDIT LOGS
    // ============================================================
    
    await client.query(
      `INSERT INTO trial_audit_logs (trial_id, event_type, message, timestamp, ip_address, metadata)
       VALUES ((SELECT id FROM trials WHERE hardware_id = $1), $2, $3, $4, $5, $6)`,
      [
        hardware_id,
        "trial_started",
        `Software registered for product ${product.name} (${trialDuration} days)`,
        nowISO,
        clientIp,
        JSON.stringify({
          product_id,
          product_name: product.name,
          plan_name: trialPlan.name,
          duration_days: trialDuration,
          hardware_id,
          software_version
        })
      ]
    );
    
    triggerNotification(pool, 'trial_started', {
      customer_name: customer_name || '',
      customer_email: customer_email || '',
      customer_phone: mobile_number || '',
      hardware_id,
      product_id,
      trial_days: trialDuration,
      expiry_date: expiryDateISO.split('T')[0],
    }).catch(e => console.error('Trial registration notification error:', e));

    // ============================================================
    // 9. BUILD RESPONSE
    // ============================================================
    
    const response = {
      success: true,
      registration: {
        status: hasActiveTrial ? 'already_active' : 'created',
        product: {
          id: product.product_id,
          name: product.name,
          version: product.version || '1.0.0',
          description: product.description,
          short_description: product.short_description,
          company: product.company_name,
          website: product.website,
          support_url: product.support_url,
          docs_url: product.docs_url,
          platform: product.platform
        },
        trial: {
          plan_name: trialPlan.name,
          plan_description: trialPlan.description,
          duration_days: trialDuration,
          expiry_date: expiryDateISO,
          days_left: trialDuration,
          max_devices: trialPlan.max_devices || 0,
          features: trialPlan.features || {}
        },
        upgrade_config: buildUpgradeConfig(product, trialPlan, await getProductPlans(client, product_id)),
        store: {
          url: template?.store_url || null,
          product_url: null
        }
      },
      message: hasActiveTrial 
        ? 'Trial already active' 
        : `Trial started successfully for ${product.name}`
    };
    
    client.release();
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("❌ Registration error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to register software",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
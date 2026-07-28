// FILE: app/internal/backend/trials/start/route.ts
// PURPOSE: Start a trial with Notification

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { triggerNotification } from '@/lib/notification/notification-service';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ============================================================
// GET USER FROM TOKEN
// ============================================================

function getUserFromToken(request: NextRequest): { id: string; email: string; name: string; role: string } | null {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;
    if (!JWT_SECRET) {
      return null;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name || "Admin",
      role: decoded.role || "admin",
    };
  } catch (error) {
    console.error("❌ Failed to decode token:", error);
    return null;
  }
}

// ============================================================
// HELPERS
// ============================================================

async function getUniversalTrial(client: any): Promise<{ id: number; duration_days: number } | null> {
  const result = await client.query(
    `SELECT id, duration_days FROM trial_templates WHERE is_system_default = true AND is_active = true LIMIT 1`
  );
  if (result.rows.length === 0) return null;
  return { id: result.rows[0].id, duration_days: result.rows[0].duration_days };
}

async function getTrialPlanId(client: any, productId: string): Promise<number | null> {
  if (!productId) return null;
  
  const result = await client.query(
    `SELECT id, trial_days_limit, default_expiry_days FROM plans 
     WHERE product_id = $1 AND is_trial_plan = true AND is_active = true
     ORDER BY display_order ASC LIMIT 1`,
    [productId]
  );
  
  if (result.rows.length === 0) return null;
  return result.rows[0].id;
}

async function getTrialDuration(client: any, planId: number, trialTemplateId: number | null = null): Promise<number> {
  if (!planId) {
    if (trialTemplateId) {
      const templateResult = await client.query(
        `SELECT duration_days FROM trial_templates WHERE id = $1`,
        [trialTemplateId]
      );
      if (templateResult.rows.length > 0 && templateResult.rows[0].duration_days) {
        return templateResult.rows[0].duration_days;
      }
    }
    return 7;
  }
  
  const result = await client.query(
    `SELECT trial_days_limit, default_expiry_days FROM plans WHERE id = $1`,
    [planId]
  );
  
  if (result.rows.length === 0) {
    if (trialTemplateId) {
      const templateResult = await client.query(
        `SELECT duration_days FROM trial_templates WHERE id = $1`,
        [trialTemplateId]
      );
      if (templateResult.rows.length > 0 && templateResult.rows[0].duration_days) {
        return templateResult.rows[0].duration_days;
      }
    }
    return 7;
  }
  
  const planDays = result.rows[0].trial_days_limit || result.rows[0].default_expiry_days;
  if (planDays) return planDays;
  
  if (trialTemplateId) {
    const templateResult = await client.query(
      `SELECT duration_days FROM trial_templates WHERE id = $1`,
      [trialTemplateId]
    );
    if (templateResult.rows.length > 0 && templateResult.rows[0].duration_days) {
      return templateResult.rows[0].duration_days;
    }
  }
  
  return 7;
}

// ============================================================
// MAIN: POST /trials/start
// ============================================================

export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    // Get user from token
    const currentUser = getUserFromToken(request);
    
    const body = await request.json();
    const {
      hardware_id,
      product_id,
      plan_id,
      user_id,
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
    // VALIDATION
    // ============================================================
    
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
    // 1. CHECK FOR EXISTING TRIAL
    // ============================================================
    
    const existingResult = await client.query(
      `SELECT id, hardware_id, status, expiry_date, started_at, customer_name, customer_email 
       FROM trials 
       WHERE hardware_id = $1 AND (product_id = $2 OR $2 IS NULL)`,
      [hardware_id, product_id || null]
    );
    
    const existingTrial = existingResult.rows[0] || null;
    
    if (existingTrial) {
      const expiryDate = new Date(existingTrial.expiry_date);
      const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      if (existingTrial.status === 'active' && daysLeft > 0) {
        client.release();
        return NextResponse.json({
          active: true,
          days_left: daysLeft,
          expiry_date: existingTrial.expiry_date,
          message: `Trial already active with ${daysLeft} days left`
        });
      }
    }

    // Paid license takes precedence over trial
    const paidCheckParams = [hardware_id];
    const paidCheckClauses = [
      `EXISTS (
        SELECT 1 FROM licenses l
        INNER JOIN activations a ON l.license_key = a.license_key AND a.hardware_id = $1
        WHERE (l.is_trial IS NULL OR l.is_trial = false)
      )`
    ];
    if (customer_email) {
      paidCheckParams.push(customer_email);
      paidCheckClauses.push(
        `EXISTS (
          SELECT 1 FROM licenses l
          WHERE l.customer_email = $${paidCheckParams.length} AND (l.is_trial IS NULL OR l.is_trial = false)
        )`
      );
    }
    const paidCheckQuery = `SELECT (${paidCheckClauses.join(' OR ')}) AS has_paid_license`;
    const paidCheck = await client.query(paidCheckQuery, paidCheckParams);
    if (paidCheck.rows[0]?.has_paid_license) {
      client.release();
      return NextResponse.json({
        active: false,
        error: "A paid license is associated with this hardware. Trial is not available."
      }, { status: 400 });
    }
    
    // ============================================================
    // 2. GET TRIAL TEMPLATE ID
    // ============================================================
    
    // ============================================================
    // 3. DETERMINE TRIAL DURATION
    // ============================================================
    
    let trialPlanId = plan_id || null;
    let trialDuration = 7;
    let trialTemplateId = null;
    
    // Priority 1: Universal Trial template (source of truth)
    const universalTrial = await getUniversalTrial(client);
    if (universalTrial) {
      trialTemplateId = universalTrial.id;
      trialDuration = universalTrial.duration_days;
    }
    
    // Priority 2: Plan-level trial configuration (fallback)
    if (product_id && !trialPlanId) {
      trialPlanId = await getTrialPlanId(client, product_id);
    }
    
    if (trialPlanId) {
      trialDuration = await getTrialDuration(client, trialPlanId, trialTemplateId);
    } else if (trialTemplateId) {
      trialDuration = await getTrialDuration(client, 0, trialTemplateId);
    }
    
    // ============================================================
    // 4. CALCULATE EXPIRY DATE
    // ============================================================
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + trialDuration);
    const expiryDateISO = expiryDate.toISOString();
    
    const installTimestamp = installation_timestamp || nowISO;
    
    // ============================================================
    // 5. CREATE OR UPDATE CUSTOMER ROW
    // ============================================================
    if (customer_email) {
      try {
        const existingCustomer = await client.query(
          `SELECT id FROM customers WHERE email = $1`,
          [customer_email]
        );
        if (existingCustomer.rows.length === 0) {
          await client.query(
            `INSERT INTO customers (email, name, phone, country_code, hardware_id, company_name, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              customer_email,
              customer_name || '',
              mobile_number || '',
              '',
              hardware_id,
              '',
              now,
              now,
            ]
          );
        } else {
          await client.query(
            `UPDATE customers SET name = COALESCE($1, name), phone = COALESCE($2, phone),
             hardware_id = COALESCE($3, hardware_id), updated_at = $4
             WHERE email = $5`,
            [
              customer_name || null,
              mobile_number || null,
              hardware_id,
              now,
              customer_email,
            ]
          );
        }
      } catch (customerError) {
        console.warn('[trials/start] Customer upsert warning:', customerError);
      }
    }

    // ============================================================
    // 6. INSERT OR UPDATE TRIAL
    // ============================================================
    
    let trialId: number;
    
    if (existingTrial) {
      trialId = existingTrial.id;
      
      await client.query(
        `UPDATE trials 
         SET status = 'active',
             expiry_date = $1,
             started_at = $2,
             product_id = COALESCE($3, product_id),
             plan_id = COALESCE($4, plan_id),
             user_id = COALESCE($5, user_id),
             customer_name = COALESCE($6, customer_name),
             customer_email = COALESCE($7, customer_email),
             mobile_number = COALESCE($8, mobile_number),
             ip_address = $9,
             cpu_id = COALESCE($10, cpu_id),
             motherboard_id = COALESCE($11, motherboard_id),
             device_hash = COALESCE($12, device_hash),
             software_version = COALESCE($13, software_version),
             os_info = COALESCE($14, os_info),
             installation_timestamp = COALESCE($15, installation_timestamp),
             trial_template_id = COALESCE($16, trial_template_id),
             trial_duration_days = COALESCE($18, trial_duration_days)
         WHERE hardware_id = $17`,
        [
          expiryDateISO,
          nowISO,
          product_id || null,
          trialPlanId,
          user_id || null,
          customer_name || null,
          customer_email || null,
          mobile_number || null,
          clientIp,
          cpu_id || null,
          motherboard_id || null,
          device_hash || null,
          software_version || null,
          os_info || null,
          installTimestamp,
          trialTemplateId,
          hardware_id,
          trialDuration
        ]
      );
    } else {
      const insertResult = await client.query(
        `INSERT INTO trials (
          hardware_id,
          status,
          expiry_date,
          started_at,
          product_id,
          plan_id,
          user_id,
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
          trial_template_id,
          trial_duration_days
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING id`,
        [
          hardware_id,
          'active',
          expiryDateISO,
          nowISO,
          product_id || null,
          trialPlanId,
          user_id || null,
          customer_name || null,
          customer_email || null,
          mobile_number || null,
          clientIp,
          cpu_id || null,
          motherboard_id || null,
          device_hash || null,
          software_version || null,
          os_info || null,
          installTimestamp,
          trialTemplateId,
          trialDuration
        ]
      );
      
      trialId = insertResult.rows[0].id;
    }
    
    // ============================================================
    // 7. TRIAL AUDIT LOG
    // ============================================================
    
    let logMessage = `Trial started for hardware ${hardware_id}`;
    if (product_id) {
      logMessage += ` for product ${product_id}`;
    }
    if (customer_email) {
      logMessage += ` by ${customer_email}`;
    }
    if (trialDuration) {
      logMessage += ` (${trialDuration} days)`;
    }
    
    try {
      await client.query(
        `INSERT INTO trial_audit_logs (trial_id, event_type, message, timestamp, ip_address, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          trialId,
          "trial_started",
          logMessage,
          nowISO,
          clientIp,
          JSON.stringify({
            hardware_id,
            product_id,
            plan_id: trialPlanId,
            duration_days: trialDuration,
            customer_email,
            device_hash
          })
        ]
      );
    } catch (logError) {
      console.error("Failed to log trial_audit_logs:", logError);
    }
    
    // ============================================================
    // 8. GENERAL AUDIT LOG
    // ============================================================
    
    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, hardware_id, license_key)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "trial_started",
          logMessage,
          nowISO,
          clientIp,
          hardware_id,
          ''
        ]
      );
    } catch (auditError) {
      console.error("Failed to log audit_logs:", auditError);
    }
    
    client.release();

    triggerNotification(pool, 'trial_started', {
      customer_name: customer_name || '',
      customer_email: customer_email || '',
      hardware_id,
      product_id: product_id || '',
      trial_days: trialDuration,
      expiry_date: expiryDateISO.split('T')[0],
    }).catch(e => console.error('Trial notification error:', e));

    // ============================================================
    // 10. SUCCESS RESPONSE
    // ============================================================
    
    return NextResponse.json({
      active: true,
      days_left: trialDuration,
      expiry_date: expiryDateISO,
      product_id: product_id || null,
      plan_id: trialPlanId,
      trial_template_id: trialTemplateId,
      duration_days: trialDuration,
      message: `${trialDuration}-day trial started successfully`
    });
    
  } catch (error) {
    console.error("Trial start error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { active: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
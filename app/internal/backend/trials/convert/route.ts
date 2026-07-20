// FILE: app/internal/backend/trials/convert/route.ts
// PURPOSE: Convert trial to paid license with Notification

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { generateLicenseKey as generateLicenseKeyCentral, validateEmail } from '@/core/utils/validation-system';

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

function generateLicenseKey(): string {
  return generateLicenseKeyCentral();
}

async function getOrCreateCustomer(
  client: any,
  name: string,
  email: string
): Promise<string> {
  const normalizedEmail = email.toLowerCase();
  
  const customerResult = await client.query(
    `SELECT id FROM customers WHERE customer_email = $1`,
    [normalizedEmail]
  );
  
  if (customerResult.rows.length > 0) {
    return customerResult.rows[0].id;
  }
  
  const customerId = `cust_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();
  
  await client.query(
    `INSERT INTO customers (id, name, email, created_at)
     VALUES ($1, $2, $3, $4)`,
    [customerId, name, normalizedEmail, now]
  );
  
  return customerId;
}

// ============================================================
// MAIN: POST /trials/convert
// ============================================================

export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    // Get user from token
    const currentUser = getUserFromToken(request);
    
    const body = await request.json();
    const {
      hardware_id,
      customer_name,
      customer_email,
      selected_plan,
      product_id
    } = body;
    
    // ============================================================
    // VALIDATION
    // ============================================================
    
    if (!hardware_id) {
      return NextResponse.json(
        { success: false, error: "hardware_id is required" },
        { status: 400 }
      );
    }
    
    if (!customer_name || customer_name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Customer name is required" },
        { status: 400 }
      );
    }
    
    if (!customer_email || !validateEmail(customer_email).valid) {
      return NextResponse.json(
        { success: false, error: "Valid customer email is required" },
        { status: 400 }
      );
    }
    
    if (!selected_plan) {
      return NextResponse.json(
        { success: false, error: "Selected plan is required" },
        { status: 400 }
      );
    }
    
    if (!product_id) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const normalizedEmail = customer_email.toLowerCase();
    
    // ============================================================
    // 1. VERIFY TRIAL EXISTS
    // ============================================================
    
    const trialResult = await client.query(
      `SELECT 
        t.id,
        t.hardware_id,
        t.status,
        t.started_at,
        t.expiry_date,
        t.product_id,
        t.plan_id,
        t.customer_name as trial_customer_name,
        t.customer_email as trial_customer_email,
        p.name as product_name,
        p.is_active as product_is_active,
        p.is_deleted as product_is_deleted,
        pl.trial_days_limit,
        pl.default_expiry_days as plan_duration_days,
        pl.name as trial_plan_name
      FROM trials t
      LEFT JOIN products p ON t.product_id = p.product_id
      LEFT JOIN plans pl ON t.plan_id = pl.id
      WHERE t.hardware_id = $1`,
      [hardware_id]
    );
    
    if (trialResult.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Trial not found for this hardware" },
        { status: 404 }
      );
    }
    
    const trial = trialResult.rows[0];
    
    // ============================================================
    // 2. CHECK IF ALREADY CONVERTED
    // ============================================================
    
    if (trial.status === 'converted') {
      client.release();
      return NextResponse.json(
        { 
          success: false, 
          error: "Trial already converted to a license",
          already_converted: true
        },
        { status: 409 }
      );
    }
    
    // ============================================================
    // 3. CHECK TRIAL STATUS - Allow conversion of expired trials too
    // ============================================================
    
    const trialExpiryDate = new Date(trial.expiry_date);
    const currentDate = new Date();
    const isExpired = trialExpiryDate < currentDate || trial.status === 'expired';
    
    // ============================================================
    // 4. VERIFY PRODUCT EXISTS AND IS ACTIVE
    // ============================================================
    
    if (trial.product_is_deleted === true) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Product is archived" },
        { status: 403 }
      );
    }
    
    if (!trial.product_is_active || trial.product_is_active === null) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Product is not active" },
        { status: 403 }
      );
    }
    
    // ============================================================
    // 5. VERIFY SELECTED PLAN EXISTS
    // ============================================================
    
    const planResult = await client.query(
      `SELECT 
        id,
        product_id,
        name,
        price,
        default_expiry_days as duration_days,
        max_devices,
        is_active
      FROM plans 
      WHERE product_id = $1 AND name = $2 AND is_active = true`,
      [product_id, selected_plan]
    );
    
    if (planResult.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { 
          success: false, 
          error: `Plan "${selected_plan}" not found or inactive for this product` 
        },
        { status: 404 }
      );
    }
    
    const plan = planResult.rows[0];
    
    // ============================================================
    // 6. GET OR CREATE CUSTOMER
    // ============================================================
    
    let customerId = await getOrCreateCustomer(client, customer_name, normalizedEmail);
    
    // ============================================================
    // 7. GENERATE UNIQUE LICENSE KEY
    // ============================================================
    
    let licenseKey = generateLicenseKey();
    let isDuplicate = true;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (isDuplicate && attempts < maxAttempts) {
      const checkResult = await client.query(
        `SELECT license_key FROM licenses WHERE license_key = $1`,
        [licenseKey]
      );
      if (checkResult.rows.length === 0) {
        isDuplicate = false;
      } else {
        licenseKey = generateLicenseKey();
        attempts++;
      }
    }
    
    if (isDuplicate) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Failed to generate unique license key" },
        { status: 500 }
      );
    }
    
    // ============================================================
    // 8. CALCULATE LICENSE EXPIRY
    // ============================================================
    
    const licenseExpiryDate = new Date();
    licenseExpiryDate.setDate(licenseExpiryDate.getDate() + plan.duration_days);
    const licenseExpiryString = licenseExpiryDate.toISOString();
    
    // ============================================================
    // 9. CREATE LICENSE
    // ============================================================
    
    await client.query(
      `INSERT INTO licenses (
        license_key,
        product_id,
        plan,
        plan_id,
        customer_name,
        customer_email,
        customer_username,
        status,
        expiry_date,
        duration_days,
        max_devices,
        is_trial,
        inactive_reason,
        notes,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        licenseKey,
        product_id,
        plan.name,
        plan.id,
        customer_name,
        normalizedEmail,
        customer_name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        'inactive',
        licenseExpiryString,
        plan.duration_days,
        plan.max_devices,
        true,
        'Converted from trial',
        `Converted from trial (hardware: ${hardware_id}, trial started: ${trial.started_at})`,
        now
      ]
    );
    
    // ============================================================
    // 10. UPDATE TRIAL STATUS TO CONVERTED
    // ============================================================
    
    await client.query(
      `UPDATE trials 
       SET status = 'converted',
            converted_at = $1,
            converted_to_license_key = $2,
            product_id = $3,
            plan_id = $4
       WHERE hardware_id = $5`,
      [now, licenseKey, product_id, plan.id, hardware_id]
    );

    // Update customer_type to 'paid'
    try {
      await client.query(
        `UPDATE customers SET customer_type = 'paid', updated_at = CURRENT_TIMESTAMP WHERE email = $1`,
        [normalizedEmail]
      );
    } catch (custUpdateError) {
      console.error("Failed to update customer_type:", custUpdateError);
    }
    
    // ============================================================
    // 11. UPDATE HARDWARE TO LINK TO LICENSE
    // ============================================================
    
    const hardwareCheck = await client.query(
      `SELECT id FROM license_hardware WHERE hardware_id = $1`,
      [hardware_id]
    );
    
    if (hardwareCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO license_hardware (
          hardware_id,
          license_key,
          device_name,
          online_status,
          last_seen,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [hardware_id, licenseKey, `Device: ${hardware_id}`, 'offline', now, now]
      );
    } else {
      await client.query(
        `UPDATE license_hardware 
         SET license_key = $1, last_seen = $2, updated_at = $2
         WHERE hardware_id = $3`,
        [licenseKey, now, hardware_id]
      );
    }
    
    // ============================================================
    // 12. CREATE TRIAL CONVERTED NOTIFICATION
    // ============================================================
    try {
      // Get the admin user (or use system)
      const adminUserId = currentUser ? currentUser.id : 'user_001';
      const customerName = customer_name || 'Unknown User';
      
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, link, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          adminUserId,
          "Trial Converted to License",
          `Trial for ${customerName} (${normalizedEmail}) converted to license ${licenseKey} - Plan: ${plan.name}`,
          "trial_converted",
          `/internal/api/licenses/${licenseKey}`
        ]
      );
      console.log("✅ Trial converted notification created");
    } catch (notifError) {
      console.error("⚠️ Failed to create trial conversion notification:", notifError);
    }
    
    // ============================================================
    // 13. AUDIT LOG
    // ============================================================
    
    await client.query(
      `INSERT INTO audit_logs (
        event_type,
        message,
        timestamp,
        ip_address,
        license_key,
        hardware_id
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "trial_converted",
        `Trial converted to license ${licenseKey} for product ${trial.product_name || 'Unknown'} (plan: ${plan.name})`,
        now,
        clientIp,
        licenseKey,
        hardware_id
      ]
    );
    
    client.release();
    
    // ============================================================
    // 14. SUCCESS RESPONSE
    // ============================================================
    
    return NextResponse.json({
      success: true,
      message: "Trial successfully converted to license",
      trial_id: trial.id,
      license_key: licenseKey,
      product_id: product_id,
      product_name: trial.product_name,
      plan: plan.name,
      customer_name: customer_name,
      customer_email: normalizedEmail,
      expiry_date: licenseExpiryString.split('T')[0],
      duration_days: plan.duration_days,
      max_devices: plan.max_devices,
      converted_at: now,
      status: "converted",
      converted_by: currentUser ? currentUser.email : 'system'
    });
    
  } catch (error) {
    console.error("❌ Trial conversion error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to convert trial to license",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
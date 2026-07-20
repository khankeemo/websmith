// FILE: app/internal/backend/admin/create-license/route.ts
// PURPOSE: Create License API with Notification
// DATABASE: Neon PostgreSQL only

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { triggerNotification } from "@/lib/notification/notification-service";
import { validateLicenseCreationInput, generateLicenseKey } from "@/core/utils/validation-system";

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
// HELPERS
// ============================================================

function generateUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);
}

// ============================================================
// POST /internal/backend/admin/create-license
// ============================================================

export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    // Get user from proxy-set headers (proxy.ts authenticates and forwards context)
    const userEmail = request.headers.get("x-api-center-user-email") || "";
    const userId = request.headers.get("x-api-center-user-id") || "";
    const userName = request.headers.get("x-api-center-user-name") || "Admin";
    const userRole = request.headers.get("x-api-center-user-role") || "admin";
    
    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }
    
    console.log(`👤 Creating license by: ${userEmail} (${userId})`);
    
    const body = await request.json();
    
    const {
      name,
      email,
      username,
      product_id,
      plan,
      expiry_days = 365,
      max_devices = 1,
      notes = "",
      license_key = null,
      status = "inactive",
      phone = "",
      country = "",
      is_trial = false,
      trial_days_limit = null,
    } = body;

    // ============================================================
    // VALIDATION (Comprehensive)
    // ============================================================
    
    const validation = await validateLicenseCreationInput(pool, body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0].message, errors: validation.errors },
        { status: 400 }
      );
    }

    client = await pool.connect();
    
    const finalLicenseKey = license_key?.trim() || generateLicenseKey();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiry_days);
    const expiryDateString = expiryDate.toISOString();
    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = username?.trim() || generateUsername(name);

    // ============================================================
    // CHECK FOR EXISTING CUSTOMER
    // ============================================================
    
    const existingResult = await client.query(
      `SELECT license_key, customer_name, customer_email, plan, product_id, status 
       FROM licenses 
       WHERE customer_email = $1 AND deleted_at IS NULL`,
      [normalizedEmail]
    );
    
    const existingLicense = existingResult.rows[0] || null;

    // ============================================================
    // UPDATE EXISTING LICENSE (if found)
    // ============================================================
    
    if (existingLicense) {
      if (existingLicense.product_id === product_id && existingLicense.plan === plan) {
        client.release();
        return NextResponse.json({
          success: false,
          error: "Customer already has a license for this product and plan",
          existing_license: {
            license_key: existingLicense.license_key,
            status: existingLicense.status,
          },
          duplicate: true,
        }, { status: 409 });
      }

      await client.query(
        `UPDATE licenses 
         SET customer_name = $1,
             customer_username = $2,
             product_id = $3,
             plan = $4,
             expiry_date = $5,
             status = $6,
             max_devices = $7,
             notes = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE customer_email = $9`,
        [
          name,
          normalizedUsername,
          product_id,
          plan,
          expiryDateString,
          status,
          max_devices,
          notes,
          normalizedEmail
        ]
      );
      
      client.release();

      return NextResponse.json({
        success: true,
        license_key: existingLicense.license_key,
        expiry_date: expiryDateString.split("T")[0],
        message: `License updated for ${name}`,
        updated_existing: true,
      });
    }

    // ============================================================
    // CHECK FOR DUPLICATE LICENSE KEY
    // ============================================================
    
    if (license_key) {
      const keyCheckResult = await client.query(
        `SELECT license_key FROM licenses WHERE license_key = $1`,
        [finalLicenseKey]
      );
      
      if (keyCheckResult.rows.length > 0) {
        client.release();
        return NextResponse.json(
          { success: false, error: "License key already exists. Please use a different key." },
          { status: 409 }
        );
      }
    }

    // ============================================================
    // CREATE NEW LICENSE (ALL 18 COLUMNS)
    // ============================================================
    
    const result = await client.query(
      `INSERT INTO licenses (
        license_key,
        product_id,
        customer_name,
        customer_email,
        customer_username,
        customer_phone,
        plan,
        status,
        inactive_reason,
        is_trial,
        expiry_date,
        duration_days,
        max_devices,
        device_count,
        notes,
        is_activated,
        activated_at,
        last_validated,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING 
        license_key,
        product_id,
        customer_name,
        customer_email,
        customer_username,
        customer_phone,
        plan,
        status,
        inactive_reason,
        is_trial,
        expiry_date,
        duration_days,
        max_devices,
        device_count,
        notes,
        is_activated,
        activated_at,
        last_validated,
        created_at,
        updated_at`,
      [
        finalLicenseKey,
        product_id,
        name,
        normalizedEmail,
        normalizedUsername,
        phone,
        plan,
        status,
        status === 'inactive' ? 'Pending activation' : null,
        is_trial,
        expiryDateString,
        expiry_days,
        max_devices,
        0,
        notes,
        false,
        null,
        null,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
    
    const newLicense = result.rows[0];

    await client.query(
      `INSERT INTO customers (email, name, phone, company, country, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       ON CONFLICT (email) DO UPDATE SET name = COALESCE(NULLIF($2, ''), customers.name), phone = COALESCE(NULLIF($3, ''), customers.phone), updated_at = CURRENT_TIMESTAMP`,
      [normalizedEmail, name, phone, body.company || '', country, notes || '']
    );

    await client.query(
      `INSERT INTO customer_licenses (customer_email, license_key, product_id, plan_name, status, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (customer_email, license_key) DO NOTHING`,
      [normalizedEmail, finalLicenseKey, product_id, plan, 'active', expiryDateString]
    );

    // Audit log license creation
    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        ['license_created', `License ${finalLicenseKey} created for ${name} (${normalizedEmail})`, new Date().toISOString(), request.headers.get("x-forwarded-for") || "unknown", finalLicenseKey]
      );
    } catch (auditError) {
      console.error("Failed to audit license creation:", auditError);
    }

    // ============================================================
    // TRIGGER NOTIFICATIONS (await before response to ensure completion on Vercel)
    // ============================================================
    
    try {
      await triggerNotification(pool, 'license_created', {
        license_key: finalLicenseKey,
        customer_name: name,
        customer_email: normalizedEmail,
        customer_phone: phone,
        product_id,
        plan_name: plan,
        expiry_date: expiryDateString.split('T')[0],
        max_devices: max_devices,
      });
    } catch (notifError) {
      console.error('License notification error:', notifError);
    }

    client.release();

    // ============================================================
    // SUCCESS RESPONSE
    // ============================================================
    
    return NextResponse.json({
      success: true,
      license_key: finalLicenseKey,
      expiry_date: expiryDateString.split("T")[0],
      duration_days: expiry_days,
      plan: plan,
      customer_name: name,
      customer_email: normalizedEmail,
      customer_username: normalizedUsername,
      status: status,
      max_devices: max_devices,
      message: `License created successfully for ${name}`,
      created_by: userEmail,
      updated_existing: false,
    });
    
  } catch (error) {
    console.error("❌ Create license error:", error);
    
    if (client) {
      try { client.release(); } catch (_) {}
    }
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create license. Please try again.",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// ============================================================
// GET /internal/backend/admin/create-license
// ============================================================

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Admin create-license endpoint is ready",
    endpoint: "POST /internal/backend/admin/create-license",
    database: "Neon PostgreSQL",
    table: "licenses",
    columns: [
      "license_key",
      "product_id",
      "customer_name",
      "customer_email",
      "customer_username",
      "plan",
      "status",
      "expiry_date",
      "duration_days",
      "max_devices",
      "device_count",
      "notes",
      "is_activated",
      "activated_at",
      "last_validated",
      "created_at",
      "updated_at"
    ]
  });
}
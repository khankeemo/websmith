import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { triggerNotification } from '@/lib/notification/notification-service';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

function getUserFromToken(request: NextRequest): { id: string; email: string; name: string; role: string } | null {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;
    if (!JWT_SECRET) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return { id: decoded.id, email: decoded.email, name: decoded.name || "Admin", role: decoded.role || "admin" };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let client = null;

  try {
    const currentUser = getUserFromToken(request);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { license_key, customer_email, hardware_id, device_name, name, phone, email, plan_name, original_email } = body;

    if (!license_key || !hardware_id || !customer_email) {
      return NextResponse.json(
        { success: false, error: "license_key, customer_email, and hardware_id are required" },
        { status: 400 }
      );
    }

    client = await pool.connect();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const normalizedLicenseKey = license_key.toUpperCase();
    const normalizedEmail = (email || customer_email).toLowerCase();

    // Step 1: Find the license
    const licenseResult = await client.query(
      `SELECT license_key, customer_name, customer_email, plan, status, expiry_date,
              max_devices, device_count, product_id, duration_days, is_activated, is_trial
       FROM licenses WHERE license_key = $1`,
      [normalizedLicenseKey]
    );

    if (licenseResult.rows.length === 0) {
      client.release();
      return NextResponse.json({ success: false, error: "License key not found" }, { status: 404 });
    }

    const license = licenseResult.rows[0];

    // Step 2: Check if license is expired
    if (license.expiry_date && new Date(license.expiry_date) < new Date()) {
      client.release();
      return NextResponse.json({ success: false, error: "License has expired" }, { status: 403 });
    }

    // Step 3: Check if hardware is already activated on this license
    const existingResult = await client.query(
      `SELECT * FROM activations WHERE license_key = $1 AND hardware_id = $2 AND is_active = TRUE`,
      [license.license_key, hardware_id]
    );

    if (existingResult.rows.length > 0) {
      await client.query(
        `UPDATE activations SET last_seen = $1, ip_address = $2 WHERE license_key = $3 AND hardware_id = $4`,
        [now, clientIp, license.license_key, hardware_id]
      );
      client.release();
      return NextResponse.json({
        success: true,
        message: "License already activated on this device",
        already_activated: true,
        days_left: Math.max(0, Math.ceil((new Date(license.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
      });
    }

    // Step 4: Check device limit only after confirming device not already activated
    if (license.device_count >= license.max_devices) {
      client.release();
      return NextResponse.json({
        success: false,
        error: `Device limit reached (${license.max_devices} devices max)`,
        device_limit_reached: true,
      }, { status: 403 });
    }

    // Step 5: Create activation record
    await client.query(
      `INSERT INTO activations (license_key, hardware_id, device_name, ip_address, activated_at, last_seen, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
      [license.license_key, hardware_id, device_name || "Admin Activated", clientIp, now, now]
    );

    // Step 6: Update license status
    await client.query(
      `UPDATE licenses
       SET status = 'active',
           inactive_reason = NULL,
           is_activated = TRUE,
           activated_at = $1,
           device_count = device_count + 1,
           updated_at = $1,
           last_validated = $1
       WHERE license_key = $2`,
      [now, license.license_key]
    );

    // Step 7a: If email changed, migrate old records to new email (no duplicate emails)
    const originalEmail = (original_email || customer_email).toLowerCase();
    const emailChanged = originalEmail && originalEmail !== normalizedEmail;

    if (emailChanged) {
      // Check if target email already has a customer record
      const targetExists = await client.query(
        `SELECT id FROM customers WHERE LOWER(email) = $1 AND LOWER(email) != $2`,
        [normalizedEmail, originalEmail]
      );

      if (targetExists.rows.length > 0) {
        // Target customer exists — migrate old records to target, don't change customer email
        await client.query(
          `UPDATE trials SET customer_email = $1 WHERE LOWER(customer_email) = $2`,
          [normalizedEmail, originalEmail]
        );
        await client.query(
          `UPDATE customer_licenses SET customer_email = $1 WHERE LOWER(customer_email) = $2`,
          [normalizedEmail, originalEmail]
        );
      } else {
        // No conflict — safely migrate customer email + related records
        await client.query(
          `UPDATE customers SET email = $1, updated_at = $2 WHERE LOWER(email) = $3`,
          [normalizedEmail, now, originalEmail]
        );
        await client.query(
          `UPDATE customer_licenses SET customer_email = $1 WHERE LOWER(customer_email) = $2`,
          [normalizedEmail, originalEmail]
        );
        await client.query(
          `UPDATE trials SET customer_email = $1 WHERE LOWER(customer_email) = $2`,
          [normalizedEmail, originalEmail]
        );
      }
    }

    // Step 7b: If license email differs from provided email, update it
    if (normalizedEmail !== license.customer_email?.toLowerCase()) {
      await client.query(
        `UPDATE licenses SET customer_email = $1, updated_at = $2 WHERE license_key = $3`,
        [normalizedEmail, now, license.license_key]
      );
    }

    // Step 8: Upsert customer — ON CONFLICT handles existing records safely
    await client.query(
      `INSERT INTO customers (email, name, phone, mobile, status)
       VALUES ($1, $2, $3, $3, 'active')
       ON CONFLICT (email) DO UPDATE
       SET name = COALESCE(NULLIF($2, ''), customers.name),
           phone = COALESCE(NULLIF($3, ''), customers.phone),
           mobile = COALESCE(NULLIF($3, ''), customers.mobile),
           updated_at = CURRENT_TIMESTAMP`,
      [normalizedEmail, name || '', phone || '']
    );

    // Step 9: Link customer to license
    await client.query(
      `INSERT INTO customer_licenses (customer_email, license_key, product_id, plan_name, status, expiry_date)
       VALUES ($1, $2, $3, $4, 'active', $5)
       ON CONFLICT (customer_email, license_key) DO NOTHING`,
      [normalizedEmail, license.license_key, license.product_id, plan_name || license.plan, license.expiry_date]
    );

    // Step 10: If there is a trial for this customer, mark as converted
    try {
      await client.query(
        `UPDATE trials
         SET status = 'converted',
             converted_at = $1,
             converted_to_license_key = $2,
             updated_at = $1
         WHERE LOWER(customer_email) = $3
           AND status = 'active'
           AND is_converted = FALSE`,
        [now, license.license_key, normalizedEmail]
      );
    } catch (trialErr) {
      console.error("Failed to update trial conversion:", trialErr);
    }

    // Step 11: Audit log
    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        ['license_activated', `License ${license.license_key} activated by admin on hardware ${hardware_id}`,
         now, clientIp, license.license_key]
      );
    } catch (auditErr) {
      console.error("Failed to audit activation:", auditErr);
    }

    // Step 12: Notification
    triggerNotification(pool, 'activation_success', {
      license_key: license.license_key,
      customer_name: name || license.customer_name,
      customer_email: normalizedEmail,
      customer_phone: phone || '',
      product_id: license.product_id,
      plan_name: plan_name || license.plan,
      expiry_date: license.expiry_date?.split('T')[0],
      max_devices: license.max_devices,
      hardware_id,
      device_name: device_name || 'Admin Activated',
    }).catch(() => {});

    client.release();

    const daysLeft = Math.max(0, Math.ceil((new Date(license.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    return NextResponse.json({
      success: true,
      message: "License activated successfully",
      days_left: daysLeft,
      expiry_date: license.expiry_date?.split('T')[0],
      plan: license.plan,
      max_devices: license.max_devices,
      device_count: (license.device_count || 0) + 1,
    });
  } catch (error) {
    console.error("Admin activation error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

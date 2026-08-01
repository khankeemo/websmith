import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { validateCustomerName, validateMobile, validateCompany, validateCountry, validateNotes, normalizeEmail } from '@/core/utils/validation-system';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    if (!id || !id.includes("@")) {
      return NextResponse.json({ success: false, error: "Valid customer email is required" }, { status: 400 });
    }
    const email = decodeURIComponent(id).toLowerCase().trim();
    client = await pool.connect();

    const customerRes = await client.query(`SELECT * FROM customers WHERE email = $1`, [email]);
    const licensesRes = await client.query(
      `SELECT l.*, p.name as product_name, pl.name as plan_name, p.price as product_price
       FROM licenses l LEFT JOIN products p ON l.product_id = p.product_id LEFT JOIN plans pl ON l.plan_id = pl.id
       WHERE l.customer_email = $1 ORDER BY l.created_at DESC`, [email]
    );
    const licenseKeys = licensesRes.rows.map(l => l.license_key);
    let hardwareDevices: any[] = [];
    if (licenseKeys.length > 0) {
      const ph = licenseKeys.map((_, i) => `$${i + 1}`).join(", ");
      hardwareDevices = (await client.query(
        `SELECT hardware_id, device_name, ip_address, last_seen, status, activated_at, license_key
         FROM activations WHERE license_key IN (${ph}) AND (status IS NULL OR status != 'inactive') ORDER BY last_seen DESC`, licenseKeys
      )).rows;
    }

    // Phase 4: Renewals via license join
    const renewalsRes = await client.query(
      `SELECT rh.* FROM renewal_history rh
       JOIN licenses l ON rh.license_key = l.license_key
       WHERE l.customer_email = $1
       ORDER BY rh.renewed_at DESC`,
      [email]
    );

    // Phase 4: Email History via notification_logs
    const emailHistoryRes = await client.query(
      `SELECT * FROM notification_logs
       WHERE recipient = $1
       ORDER BY created_at DESC`,
      [email]
    );

    client.release();

    if (licensesRes.rows.length === 0 && !customerRes.rows[0]) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    const dbCustomer = customerRes.rows[0] || {};
    const licenses = licensesRes.rows;

    const totalRevenue = licenses.reduce((sum, l) => sum + (parseFloat(l.product_price) || 0), 0);
    const firstPurchase = licenses.length > 0 ? licenses[licenses.length - 1].issue_date || licenses[licenses.length - 1].created_at : null;
    const lastActivity = hardwareDevices[0]?.last_seen || licenses[0]?.created_at || null;

    return NextResponse.json({
      success: true,
      customer: {
        id: email,
        name: dbCustomer.name || licenses[0]?.customer_name || "Unknown",
        email,
        phone: dbCustomer.phone || null,
        mobile: dbCustomer.mobile || null,
        alternative_mobile: dbCustomer.alternative_mobile || null,
        company: dbCustomer.company || null,
        country: dbCustomer.country || null,
        address_line1: dbCustomer.address_line1 || null,
        address_line2: dbCustomer.address_line2 || null,
        city: dbCustomer.city || null,
        state: dbCustomer.state || null,
        postal_code: dbCustomer.postal_code || null,
        notes: dbCustomer.notes || null,
        status: dbCustomer.status || 'active',
        last_login: dbCustomer.last_login || null,
        total_licenses: licenses.length,
        active_licenses: licenses.filter(l => l.status === 'active').length,
        expired_licenses: licenses.filter(l => l.status === 'expired').length,
        revoked_licenses: licenses.filter(l => l.status === 'revoked').length,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        first_purchase: firstPurchase,
        last_activity: lastActivity,
        licenses: licenses.map(l => ({
          license_key: l.license_key,
          product_name: l.product_name || "Unknown",
          plan_name: l.plan_name || l.plan || "N/A",
          status: l.status,
          issue_date: l.created_at,
          expiry_date: l.expiry_date,
        })),
        hardware: hardwareDevices.map(d => ({
          hardware_id: d.hardware_id,
          device_name: d.device_name || "Unknown",
          license_key: d.license_key,
          last_seen: d.last_seen,
          status: d.status || "active",
        })),
        renewals: renewalsRes.rows.map(r => ({
          id: r.id,
          license_key: r.license_key,
          old_plan: r.old_plan,
          new_plan: r.new_plan,
          old_expiry_date: r.old_expiry_date,
          new_expiry_date: r.new_expiry_date,
          extra_days: r.extra_days,
          renewed_by: r.renewed_by,
          renewed_at: r.renewed_at,
          notes: r.notes,
        })),
        emailHistory: emailHistoryRes.rows.map(e => ({
          id: e.id,
          event_type: e.event_type,
          channel: e.channel,
          recipient: e.recipient,
          subject: e.subject,
          status: e.status,
          created_at: e.created_at,
        })),
      },
    });

  } catch (error) {
    console.error("GET /customers/[id] error:", error);
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to fetch customer details" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    if (!id || !id.includes("@")) {
      return NextResponse.json({ success: false, error: "Valid email is required" }, { status: 400 });
    }
    const email = decodeURIComponent(id).toLowerCase().trim();
    const body = await request.json();
    const allowed = ['name', 'phone', 'mobile', 'alternative_mobile', 'company', 'country', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'notes', 'status'];
    const updateFields = allowed.filter(k => body[k] !== undefined);

    if (updateFields.length === 0) {
      return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
    }

    const errors: { field: string; message: string }[] = [];

    if (body.name !== undefined) {
      const result = validateCustomerName(body.name);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.phone !== undefined && body.phone) {
      const result = validateMobile(body.phone);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.company !== undefined) {
      const result = validateCompany(body.company);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.country !== undefined && body.country) {
      const result = validateCountry(body.country);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.mobile !== undefined && body.mobile) {
      const result = validateMobile(body.mobile);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.alternative_mobile !== undefined && body.alternative_mobile) {
      const result = validateMobile(body.alternative_mobile);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.notes !== undefined) {
      const result = validateNotes(body.notes);
      if (!result.valid) errors.push(...result.errors);
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, error: errors[0].message, errors }, { status: 400 });
    }

    const normalizedValues = updateFields.map(k => {
      if (k === 'name') return body.name.trim();
      if (k === 'phone') return body.phone ? body.phone.replace(/[\s\-\(\)]/g, '') : null;
      if (k === 'mobile') return body.mobile ? body.mobile.replace(/[\s\-\(\)]/g, '') : null;
      if (k === 'alternative_mobile') return body.alternative_mobile ? body.alternative_mobile.replace(/[\s\-\(\)]/g, '') : null;
      if (k === 'company') return body.company ? body.company.trim() : null;
      if (k === 'country') return body.country ? body.country.trim().toUpperCase() : null;
      if (k === 'address_line1') return body.address_line1 ? body.address_line1.trim() : null;
      if (k === 'address_line2') return body.address_line2 ? body.address_line2.trim() : null;
      if (k === 'city') return body.city ? body.city.trim() : null;
      if (k === 'state') return body.state ? body.state.trim() : null;
      if (k === 'postal_code') return body.postal_code ? body.postal_code.trim() : null;
      if (k === 'notes') return body.notes ? body.notes.trim() : null;
      return body[k];
    });

    const sets = updateFields.map((key, i) => `${key} = $${i + 2}`);
    sets.push(`updated_at = CURRENT_TIMESTAMP`);

    client = await pool.connect();
    const queryParams = [email, ...normalizedValues];
    const result = await client.query(
      `INSERT INTO customers (email, ${updateFields.join(', ')})
       VALUES ($1, ${updateFields.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (email) DO UPDATE SET ${sets.join(', ')}
       RETURNING *`,
      queryParams
    );
    client.release();

    return NextResponse.json({ success: true, customer: result.rows[0] });

  } catch (error) {
    console.error("PUT customer error:", error);
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    if (!id || !id.includes("@")) {
      return NextResponse.json({ success: false, error: "Valid email is required" }, { status: 400 });
    }
    const email = decodeURIComponent(id).toLowerCase().trim();

    const authEmail = request.headers.get("x-api-center-user-email")?.toLowerCase().trim();
    if (authEmail && email === authEmail) {
      return NextResponse.json({ success: false, error: "Cannot delete your own customer record" }, { status: 403 });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    await client.query(`DELETE FROM wishlist WHERE LOWER(customer_email) = LOWER($1)`, [email]);
    await client.query(`DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE LOWER(customer_email) = LOWER($1))`, [email]);
    await client.query(`DELETE FROM carts WHERE LOWER(customer_email) = LOWER($1)`, [email]);
    await client.query(`DELETE FROM invoices WHERE LOWER(customer_email) = LOWER($1)`, [email]);
    await client.query(`DELETE FROM subscriptions WHERE LOWER(customer_email) = LOWER($1)`, [email]);
    await client.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE LOWER(customer_email) = LOWER($1))`, [email]);
    await client.query(`DELETE FROM orders WHERE LOWER(customer_email) = LOWER($1)`, [email]);
    await client.query(`DELETE FROM customer_licenses WHERE LOWER(customer_email) = LOWER($1)`, [email]);
    await client.query(`DELETE FROM trials WHERE LOWER(customer_email) = LOWER($1) AND customer_email IS NOT NULL`, [email]);

    // Clean license-dependent records then licenses
    const licenseKeys = (await client.query(
      `SELECT license_key FROM licenses WHERE LOWER(customer_email) = LOWER($1) AND customer_email IS NOT NULL`, [email]
    )).rows.map(r => r.license_key);

    if (licenseKeys.length > 0) {
      const ph = licenseKeys.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(`DELETE FROM renewal_history WHERE license_key IN (${ph})`, licenseKeys);
      await client.query(`DELETE FROM license_hardware WHERE license_key IN (${ph})`, licenseKeys);
      await client.query(`DELETE FROM license_bindings WHERE license_key IN (${ph})`, licenseKeys);
      await client.query(`DELETE FROM activations WHERE license_key IN (${ph})`, licenseKeys);
      await client.query(`DELETE FROM licenses WHERE license_key IN (${ph})`, licenseKeys);
    }

    await client.query(`DELETE FROM customers WHERE email = $1`, [email]);
    await client.query("COMMIT");
    client.release();
    return NextResponse.json({ success: true, message: "Customer and all associated records deleted" });

  } catch (error) {
    if (client) {
      try { await client.query("ROLLBACK"); client.release(); } catch {}
    }
    console.error("DELETE customer error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete customer" }, { status: 500 });
  }
}
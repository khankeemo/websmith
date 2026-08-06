// FILE: app/internal/backend/licenses/[key]/route.ts
// PURPOSE: Get, update, and delete a single license
// DATABASE: Neon PostgreSQL only
// ENDPOINTS:
//   - GET /internal/backend/licenses/[key] - Get license details
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { triggerNotification } from '@/lib/notification/notification-service';
import { VALID_LICENSE_STATUSES, validateEmail, validatePlanMaxDevices } from '@/core/utils/validation-system';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// GET: Get license details by key
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  let client = null;
  
  try {
    const { key } = await params;

    if (!key || key.trim() === '') {
      return NextResponse.json(
        { success: false, error: "License key is required" },
        { status: 400 }
      );
    }

    const normalizedKey = key.toUpperCase();

    client = await pool.connect();

    const result = await client.query(
      `SELECT 
        l.license_key,
        l.product_id,
        p.name as product_name,
        l.customer_name,
        l.customer_email,
        l.customer_username,
        l.plan,
        l.status,
        l.inactive_reason,
        l.is_trial,
        l.expiry_date,
        l.max_devices,
        l.duration_days,
        l.notes,
        l.created_at,
        l.updated_at,
        l.deleted_at,
        l.deleted_by,
        l.is_activated,
        l.activated_at
      FROM licenses l
      LEFT JOIN products p ON l.product_id = p.product_id
      WHERE l.license_key = $1`,
      [normalizedKey]
    );

    if (result.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "License not found" },
        { status: 404 }
      );
    }

    client.release();

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Get license error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to get license" },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE: Hard delete license (with cascade)
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  let client = null;
  
  try {
    const { key } = await params;

    if (!key || key.trim() === '') {
      return NextResponse.json(
        { success: false, error: "License key is required" },
        { status: 400 }
      );
    }

    const normalizedKey = key.toUpperCase();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const userEmail = request.headers.get("x-user-email") || "admin";

    client = await pool.connect();

    // Check if license exists
    const licenseCheck = await client.query(
      `SELECT license_key, customer_name FROM licenses WHERE license_key = $1`,
      [normalizedKey]
    );

    if (licenseCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "License not found" },
        { status: 404 }
      );
    }

    const license = licenseCheck.rows[0];

    // Cascade delete related records then hard delete the license
    await client.query(`DELETE FROM activations WHERE license_key = $1`, [normalizedKey]);
    await client.query(`DELETE FROM license_bindings WHERE license_key = $1`, [normalizedKey]);
    await client.query(`DELETE FROM license_hardware WHERE license_key = $1`, [normalizedKey]);
    await client.query(`DELETE FROM renewal_history WHERE license_key = $1`, [normalizedKey]);
    await client.query(`DELETE FROM renewal_requests WHERE license_key = $1`, [normalizedKey]);
    await client.query(`DELETE FROM reactivation_requests WHERE license_key = $1`, [normalizedKey]);
    await client.query(`DELETE FROM customer_licenses WHERE license_key = $1`, [normalizedKey]);
    await client.query(`UPDATE communication_conversations SET license_key = NULL WHERE license_key = $1`, [normalizedKey]);
    await client.query(`UPDATE notification_logs SET license_key = NULL WHERE license_key = $1`, [normalizedKey]);
    await client.query(`UPDATE requests SET license_key = NULL WHERE license_key = $1`, [normalizedKey]);

    // Hard delete the license
    await client.query(`DELETE FROM licenses WHERE license_key = $1`, [normalizedKey]);

    // Log to audit_logs
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "license_deleted",
        `License ${normalizedKey} permanently deleted by ${userEmail}`,
        now,
        clientIp,
        normalizedKey,
        ""
      ]
    );

    client.release();

    return NextResponse.json({
      success: true,
      message: `License ${normalizedKey} permanently deleted`,
      data: {
        license_key: normalizedKey,
        deleted_at: now,
        deleted_by: userEmail
      }
    });

  } catch (error) {
    console.error("Delete license error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to delete license" },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH: Restore a soft-deleted license
// ============================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  let client = null;
  
  try {
    const { key } = await params;

    if (!key || key.trim() === '') {
      return NextResponse.json(
        { success: false, error: "License key is required" },
        { status: 400 }
      );
    }

    const normalizedKey = key.toUpperCase();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const userEmail = request.headers.get("x-user-email") || "admin";

    client = await pool.connect();

    // Check if license exists and is deleted
    const licenseCheck = await client.query(
      `SELECT license_key, customer_name, status, deleted_at, deleted_by 
       FROM licenses 
       WHERE license_key = $1`,
      [normalizedKey]
    );

    if (licenseCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "License not found" },
        { status: 404 }
      );
    }

    const license = licenseCheck.rows[0];

    if (license.deleted_at === null) {
      client.release();
      return NextResponse.json(
        { success: false, error: "License is not deleted. Nothing to restore." },
        { status: 400 }
      );
    }

    // Restore the license
    await client.query(
      `UPDATE licenses 
       SET deleted_at = NULL,
           deleted_by = NULL,
           status = 'active',
           updated_at = CURRENT_TIMESTAMP
       WHERE license_key = $1`,
      [normalizedKey]
    );

    // Log to audit_logs
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "license_restored",
        `License ${normalizedKey} restored by ${userEmail} (was deleted at ${license.deleted_at} by ${license.deleted_by || "unknown"})`,
        now,
        clientIp,
        normalizedKey,
        ""
      ]
    );

    // Get restored license details
    const result = await client.query(
      `SELECT 
        l.license_key,
        l.product_id,
        p.name as product_name,
        l.customer_name,
        l.customer_email,
        l.customer_username,
        l.plan,
        l.status,
        l.inactive_reason,
        l.is_trial,
        l.expiry_date,
        l.max_devices,
        l.duration_days,
        l.notes,
        l.created_at,
        l.updated_at,
        l.deleted_at,
        l.deleted_by,
        l.is_activated,
        l.activated_at
      FROM licenses l
      LEFT JOIN products p ON l.product_id = p.product_id
      WHERE l.license_key = $1`,
      [normalizedKey]
    );

    client.release();

    triggerNotification(pool, 'product_restored', {
      license_key: normalizedKey,
      customer_name: result.rows[0]?.customer_name || '',
      admin_message: `License ${normalizedKey} restored by ${userEmail}`,
    }).catch(e => console.error('Restore notification error:', e));

    return NextResponse.json({
      success: true,
      message: `License ${normalizedKey} restored successfully`,
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Restore license error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to restore license" },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT: Update license details
// ============================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  let client = null;
  
  try {
    const { key } = await params;
    const body = await request.json();
    const {
      customer_name,
      customer_email,
      customer_username,
      plan,
      status,
      expiry_date,
      max_devices,
      notes,
      duration_days
    } = body;

    if (!key || key.trim() === '') {
      return NextResponse.json(
        { success: false, error: "License key is required" },
        { status: 400 }
      );
    }

    const normalizedKey = key.toUpperCase();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    client = await pool.connect();

    // Check if license exists and is not deleted
    const licenseCheck = await client.query(
      `      SELECT 
        license_key,
        customer_name,
        customer_email,
        customer_username,
        plan,
        status,
        expiry_date,
        max_devices,
        notes,
        duration_days,
        product_id,
        activated_at,
        created_at
      FROM licenses 
      WHERE license_key = $1 AND deleted_at IS NULL`,
      [normalizedKey]
    );

    if (licenseCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "License not found or has been deleted" },
        { status: 404 }
      );
    }

    const oldLicense = licenseCheck.rows[0];

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    const changes: string[] = [];

    if (customer_name !== undefined && customer_name.trim() !== '') {
      updates.push(`customer_name = $${paramIndex++}`);
      values.push(customer_name.trim());
      if (customer_name.trim() !== oldLicense.customer_name) {
        changes.push(`customer_name: ${oldLicense.customer_name} → ${customer_name.trim()}`);
      }
    }

    if (customer_email !== undefined) {
      const emailValidation = validateEmail(customer_email);
      if (!emailValidation.valid) {
        client.release();
        return NextResponse.json(
          { success: false, error: emailValidation.errors[0]?.message || "Valid email address is required" },
          { status: 400 }
        );
      }
      updates.push(`customer_email = $${paramIndex++}`);
      values.push(customer_email.trim().toLowerCase());
      if (customer_email.trim().toLowerCase() !== oldLicense.customer_email) {
        changes.push(`customer_email: ${oldLicense.customer_email} → ${customer_email.trim()}`);
      }
    }

    if (customer_username !== undefined && customer_username.trim() !== '') {
      updates.push(`customer_username = $${paramIndex++}`);
      values.push(customer_username.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (customer_username.trim() !== oldLicense.customer_username) {
        changes.push(`customer_username: ${oldLicense.customer_username} → ${customer_username.trim()}`);
      }
    }

    if (plan !== undefined) {
      if (plan && plan.trim() !== '') {
        const planCheck = await client.query(
          `SELECT id, name, max_devices, default_expiry_days 
           FROM plans 
           WHERE name = $1 AND product_id = $2 AND is_active = true`,
          [plan.trim(), oldLicense.product_id]
        );

        if (planCheck.rows.length === 0) {
          client.release();
          return NextResponse.json(
            { success: false, error: `Plan "${plan}" not found or inactive for this product` },
            { status: 400 }
          );
        }

        const planData = planCheck.rows[0];
        updates.push(`plan = $${paramIndex++}`);
        values.push(plan.trim());
        
        if (plan.trim() !== oldLicense.plan) {
          changes.push(`plan: ${oldLicense.plan} → ${plan.trim()}`);
        }
        
        // Auto-update max_devices based on plan
        if (max_devices === undefined || max_devices === null) {
          updates.push(`max_devices = $${paramIndex++}`);
          values.push(planData.max_devices);
          if (planData.max_devices !== oldLicense.max_devices) {
            changes.push(`max_devices: ${oldLicense.max_devices} → ${planData.max_devices} (auto from plan)`);
          }
        }
        
        // Auto-update duration_days based on plan
        if (duration_days === undefined || duration_days === null) {
          updates.push(`duration_days = $${paramIndex++}`);
          values.push(planData.default_expiry_days);
          if (planData.default_expiry_days !== oldLicense.duration_days) {
            changes.push(`duration_days: ${oldLicense.duration_days} → ${planData.default_expiry_days} (auto from plan)`);
          }
        }
      } else {
        updates.push(`plan = $${paramIndex++}`);
        values.push(null);
        if (oldLicense.plan !== null) {
          changes.push(`plan: ${oldLicense.plan} → (removed)`);
        }
      }
    }

    if (status !== undefined) {
      const lowerStatuses = VALID_LICENSE_STATUSES.map(s => s.toLowerCase());
      if (!lowerStatuses.includes(status.toLowerCase())) {
        client.release();
        return NextResponse.json(
          { success: false, error: `Invalid status. Must be one of: ${VALID_LICENSE_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.push(`status = $${paramIndex++}`);
      values.push(status.toLowerCase());
      if (status.toLowerCase() !== oldLicense.status) {
        changes.push(`status: ${oldLicense.status} → ${status}`);
      }
      // Sync inactive_reason on manual status change
      const newStatusLower = status.toLowerCase();
      if (newStatusLower === 'active') {
        updates.push(`inactive_reason = $${paramIndex++}`);
        values.push(null);
        changes.push('inactive_reason cleared');
      } else if (newStatusLower === 'expired') {
        updates.push(`inactive_reason = $${paramIndex++}`);
        values.push('Manually expired');
      } else if (newStatusLower === 'revoked') {
        updates.push(`inactive_reason = $${paramIndex++}`);
        values.push('Manually revoked');
      } else if (newStatusLower === 'suspended') {
        updates.push(`inactive_reason = $${paramIndex++}`);
        values.push('Manually suspended');
      } else if (newStatusLower === 'disabled') {
        updates.push(`inactive_reason = $${paramIndex++}`);
        values.push('Manually disabled');
      } else if (newStatusLower === 'pending') {
        updates.push(`inactive_reason = $${paramIndex++}`);
        values.push(null);
      }
    }

    if (expiry_date !== undefined) {
      if (!expiry_date || expiry_date.trim() === '') {
        client.release();
        return NextResponse.json(
          { success: false, error: "Expiry date is required" },
          { status: 400 }
        );
      }
      const parsedDate = new Date(expiry_date);
      if (isNaN(parsedDate.getTime())) {
        client.release();
        return NextResponse.json(
          { success: false, error: "Invalid expiry date format. Use ISO format (YYYY-MM-DD)" },
          { status: 400 }
        );
      }
      const newExpiry = parsedDate.toISOString();
      updates.push(`expiry_date = $${paramIndex++}`);
      values.push(newExpiry);
      if (newExpiry !== oldLicense.expiry_date) {
        changes.push(`expiry_date: ${oldLicense.expiry_date} → ${newExpiry}`);
      }
    }

    if (max_devices !== undefined) {
      const devices = parseInt(max_devices);
      const devicesValidation = validatePlanMaxDevices(devices);
      if (!devicesValidation.valid) {
        client.release();
        return NextResponse.json(
          { success: false, error: devicesValidation.errors[0]?.message || "Max devices must be between 1 and 100" },
          { status: 400 }
        );
      }
      updates.push(`max_devices = $${paramIndex++}`);
      values.push(devices);
      if (devices !== oldLicense.max_devices) {
        changes.push(`max_devices: ${oldLicense.max_devices} → ${devices}`);
      }
    }

    if (duration_days !== undefined) {
      const days = parseInt(duration_days);
      if (isNaN(days) || days < 1 || days > 7300) {
        client.release();
        return NextResponse.json(
          { success: false, error: "Duration days must be between 1 and 7300" },
          { status: 400 }
        );
      }
      updates.push(`duration_days = $${paramIndex++}`);
      values.push(days);
      if (days !== oldLicense.duration_days) {
        changes.push(`duration_days: ${oldLicense.duration_days} → ${days}`);
      }
    }

    // Auto-recompute expiry_date when the duration changes but no explicit
    // expiry was supplied: new expiry = (activated_at ?? created_at) + duration_days.
    // Matches the client-side recompute in LicenseManagerTab and keeps the
    // backend authoritative (AWS-01 Rule 1 — backend is the source of truth).
    if (expiry_date === undefined && duration_days !== undefined) {
      const days = parseInt(duration_days);
      const anchorStr = oldLicense.activated_at ?? oldLicense.created_at;
      let anchor = anchorStr ? new Date(anchorStr) : new Date();
      if (isNaN(anchor.getTime())) anchor = new Date();
      const newExpiry = new Date(anchor);
      newExpiry.setDate(newExpiry.getDate() + days);
      const newExpiryIso = newExpiry.toISOString();
      updates.push(`expiry_date = $${paramIndex++}`);
      values.push(newExpiryIso);
      if (newExpiryIso !== oldLicense.expiry_date) {
        changes.push(`expiry_date: ${oldLicense.expiry_date} → ${newExpiryIso.split('T')[0]} (auto from duration)`);
      }
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes || null);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) {
      client.release();
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    values.push(normalizedKey);
    const query = `
      UPDATE licenses 
      SET ${updates.join(', ')}
      WHERE license_key = $${paramIndex}
      RETURNING 
        license_key,
        customer_name,
        customer_email,
        customer_username,
        plan,
        status,
        expiry_date,
        max_devices,
        notes,
        duration_days,
        product_id,
        created_at,
        updated_at
    `;

    const result = await client.query(query, values);

    if (changes.length > 0) {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "license_updated",
          `License updated: ${changes.join(', ')}`,
          now,
          clientIp,
          normalizedKey,
          ""
        ]
      );
    }

    client.release();

    if (status === 'expired' || status === 'revoked') {
      triggerNotification(pool, status === 'expired' ? 'license_expired' : 'license_revoked', {
        license_key: normalizedKey,
        customer_name: result.rows[0]?.customer_name || '',
        customer_email: result.rows[0]?.customer_email || '',
        product_id: result.rows[0]?.product_id || '',
        plan_name: result.rows[0]?.plan || '',
      }).catch(e => console.error('License status notification error:', e));
    }

    return NextResponse.json({
      success: true,
      message: `License ${normalizedKey} updated successfully. ${changes.length} field(s) changed.`,
      data: result.rows[0],
      changes: changes
    });

  } catch (error) {
    console.error("Update license error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to update license" },
      { status: 500 }
    );
  }
}
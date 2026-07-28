// FILE: app/internal/backend/licenses/validate/route.ts
// PURPOSE: Validate a license key (check status, expiry, product status)
// DATABASE: Neon PostgreSQL only
// ENDPOINT: POST /internal/backend/licenses/validate
// BODY: { license_key: string, hardware_id?: string }
// NOTE: This endpoint only validates - does NOT auto-activate devices
// UPDATED: Added last_validated update on successful validation
// UPDATED: Added device_count to response
// UPDATED: All 17 columns properly maintained

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateLicenseBeforeAction, computeLicenseStatus, computeInactiveReason } from '@/core/utils/validation-system';
import { buildLicenseResponse, buildNoLicenseResponse, buildErrorResponse } from '@/lib/license/serializer';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// POST /internal/backend/licenses/validate
// ============================================================

export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    const body = await request.json();
    const { license_key, hardware_id } = body;
    
    if (!license_key) {
      return NextResponse.json(
        { valid: false, error: "License key is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const normalizedLicenseKey = license_key.toUpperCase();
    const now = new Date();
    const nowISO = now.toISOString();
    
    // Find the license with product status check
    const licenseResult = await client.query(
      `SELECT 
        l.license_key, 
        l.customer_name, 
        l.customer_email, 
        l.customer_username,
        l.plan, 
        l.status, 
        l.expiry_date, 
        l.max_devices,
        l.device_count,
        l.duration_days,
        l.product_id,
        l.created_at,
        l.is_activated,
        l.is_trial,
        l.inactive_reason,
        l.activated_at,
        l.last_validated,
        p.name as product_name,
        p.is_active as product_is_active,
        p.is_deleted as product_is_deleted
      FROM licenses l
      LEFT JOIN products p ON l.product_id = p.product_id
      WHERE l.license_key = $1`,
      [normalizedLicenseKey]
    );
    
    if (licenseResult.rows.length === 0) {
      client.release();
      return NextResponse.json(buildNoLicenseResponse(undefined, 'Invalid license key'));
    }
    
    const license = licenseResult.rows[0];
    
    // Check if product exists
    if (!license.product_id) {
      client.release();
      return NextResponse.json({ 
        valid: false, 
        error: "No product associated with this license" 
      });
    }
    
    // Check if product is active
    if (!license.product_is_active || license.product_is_active === null) {
      client.release();
      return NextResponse.json({ 
        valid: false, 
        error: "Product is currently inactive. Please contact support." 
      });
    }
    
    // Check if product is deleted
    if (license.product_is_deleted) {
      client.release();
      return NextResponse.json({ 
        valid: false, 
        error: "Product has been deleted. License cannot be validated." 
      });
    }
    
    // Compute business status
    const computedStatus = computeLicenseStatus(
      license.status,
      license.expiry_date,
      false,
      license.is_activated,
      license.is_trial || false,
      license.inactive_reason
    );
    
    const inactiveReason = computeInactiveReason(license);
    
    // Check computed status
    if (computedStatus === 'Expired') {
      // Auto-update status and inactive_reason
      await client.query(
        `UPDATE licenses SET status = $1, inactive_reason = $2, updated_at = $3 WHERE license_key = $4`,
        ['expired', inactiveReason || 'Subscription Expired', nowISO, normalizedLicenseKey]
      );
      client.release();
      return NextResponse.json(buildErrorResponse('expired', 'LICENSE_EXPIRED', 'License has expired', inactiveReason || 'Subscription Expired'));
    }
    
    if (computedStatus === 'Revoked') {
      client.release();
      return NextResponse.json(buildErrorResponse('revoked', 'LICENSE_REVOKED', 'License has been revoked', 'License Revoked'));
    }
    
    if (computedStatus === 'Suspended') {
      client.release();
      return NextResponse.json(buildErrorResponse('suspended', 'LICENSE_SUSPENDED', 'License is suspended', license.inactive_reason || 'Suspended'));
    }
    
    if (computedStatus === 'Disabled') {
      client.release();
      return NextResponse.json(buildErrorResponse('disabled', 'LICENSE_DISABLED', 'License is disabled', license.inactive_reason || 'Manual Deactivation'));
    }

    if (computedStatus === 'Inactive') {
      client.release();
      return NextResponse.json(buildErrorResponse('inactive', 'LICENSE_INACTIVE', 'Your license is inactive. Please contact support.', license.inactive_reason || 'License Deactivated'));
    }

    if (computedStatus === 'Deleted') {
      client.release();
      return NextResponse.json(buildErrorResponse('deleted', 'LICENSE_DELETED', 'Your license is inactive. Please contact support.', 'License Deleted'));
    }
    
    // Check expiry
    const expiryDate = new Date(license.expiry_date);
    if (expiryDate < now) {
      // Update status to expired
      await client.query(
        `UPDATE licenses SET status = $1, inactive_reason = $2, updated_at = $3 WHERE license_key = $4`,
        ['expired', 'Subscription Expired', nowISO, normalizedLicenseKey]
      );
      client.release();
      return NextResponse.json(buildErrorResponse('expired', 'LICENSE_EXPIRED', 'License expired', 'Subscription Expired'));
    }
    
    // ✅ UPDATE last_validated on successful validation
    await client.query(
      `UPDATE licenses 
       SET last_validated = $1, 
           updated_at = $2 
       WHERE license_key = $3`,
      [nowISO, nowISO, normalizedLicenseKey]
    );
    
    // Get product name (already in license object from join)
    const productName = license.product_name;
    
    // Check device activation status (if hardware_id provided)
    let isDeviceActivated = false;
    let deviceCount = 0;
    
    if (hardware_id) {
      const deviceResult = await client.query(
        `SELECT hardware_id FROM activations WHERE license_key = $1 AND hardware_id = $2`,
        [normalizedLicenseKey, hardware_id]
      );
      isDeviceActivated = deviceResult.rows.length > 0;
      
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM activations WHERE license_key = $1`,
        [normalizedLicenseKey]
      );
      deviceCount = parseInt(countResult.rows[0]?.count || "0");
    }
    
    // Log validation attempt
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "validate",
        `License ${license_key} validated`,
        nowISO,
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        normalizedLicenseKey,
        hardware_id || ""
      ]
    );
    
    client.release();
    
    // Calculate days left
    const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Determine message based on status
    let message = "License is active";
    if (license.status === 'inactive') {
      message = "License is available but not activated yet";
    }
    
    const hasActiveLicenseOnOtherDevice = !isDeviceActivated && deviceCount > 0;

    const serialized = buildLicenseResponse(
      {
        ...license,
        device_count: license.device_count || 0,
      },
      hardware_id,
      isDeviceActivated,
      hasActiveLicenseOnOtherDevice,
    );

    return NextResponse.json({
      ...serialized,
      license: {
        ...serialized.license,
        product_id: license.product_id,
        product_name: productName || '',
        days_left: daysLeft,
        is_activated: license.is_activated,
        activated_at: license.activated_at,
        last_validated: nowISO,
        created_at: license.created_at,
        duration_days: license.duration_days,
        customer_username: license.customer_username,
      },
      message: serialized.message,
      hardware: hardware_id
        ? {
            hardware_id,
            is_activated: isDeviceActivated,
            device_name: '',
          }
        : undefined,
    });
    
  } catch (error) {
    console.error("❌ License validation error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
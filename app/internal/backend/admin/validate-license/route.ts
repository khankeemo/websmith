// FILE: D:\websmith\app\internal\backend\admin\validate-license\route.ts
// PURPOSE: POST validate a license key (admin version)
// DATABASE: Neon PostgreSQL only
// ENDPOINT: POST /internal/backend/admin/validate-license
// BODY: { license_key: string, name?: string, email?: string, hardware_id?: string }
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only
// UPDATED: Inactive licenses now return valid (not activated yet)

import { NextResponse } from "next/server";
import { Pool } from "pg";

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(request: Request) {
  let client = null;
  
  try {
    const body = await request.json();
    const { license_key, hardware_id } = body;
    
    if (!license_key) {
      return NextResponse.json(
        { success: false, valid: false, error: "License key is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const normalizedLicenseKey = license_key.toUpperCase();
    const now = new Date();
    
    // Find the license
    const licenseResult = await client.query(
      `SELECT * FROM licenses WHERE license_key = $1`,
      [normalizedLicenseKey]
    );
    
    if (licenseResult.rows.length === 0) {
      client.release();
      return NextResponse.json({
        success: true,
        valid: false,
        error: "License key not found",
        status: "not_found",
      });
    }
    
    const license = licenseResult.rows[0];
    
    // Check status - only expired and revoked are invalid
    // inactive licenses are valid (just not activated yet)
    if (license.status === 'expired') {
      client.release();
      return NextResponse.json({
        success: true,
        valid: false,
        error: "License has expired",
        status: license.status,
        license_key: license.license_key,
        plan: license.plan,
        max_devices: license.max_devices,
      });
    }
    
    if (license.status === 'revoked') {
      client.release();
      return NextResponse.json({
        success: true,
        valid: false,
        error: "License has been revoked",
        status: license.status,
        license_key: license.license_key,
        plan: license.plan,
        max_devices: license.max_devices,
      });
    }
    
    // Check expiry
    const expiryDate = new Date(license.expiry_date);
    if (expiryDate < now) {
      // Update status to expired
      await client.query(
        `UPDATE licenses SET status = $1 WHERE license_key = $2`,
        ['expired', normalizedLicenseKey]
      );
      client.release();
      return NextResponse.json({
        success: true,
        valid: false,
        error: "License has expired",
        status: "expired",
        license_key: license.license_key,
        plan: license.plan,
        max_devices: license.max_devices,
        expiry_date: license.expiry_date,
      });
    }
    
    // Get activations for this license
    const activationsResult = await client.query(
      `
      SELECT hardware_id, device_name, ip_address, activated_at, last_seen
      FROM activations
      WHERE license_key = $1
      ORDER BY last_seen DESC
      `,
      [license.license_key]
    );
    
    const activations = activationsResult.rows;
    const hardwareIds = activations.map((a: any) => a.hardware_id);
    
    // Calculate days left
    let daysLeft = 0;
    if (license.expiry_date) {
      const expiry = new Date(license.expiry_date);
      const today = new Date();
      daysLeft = Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    // Determine message based on status
    let message = "License is active";
    if (license.status === 'inactive') {
      message = "License is available but not activated yet";
    }
    
    // Log validation attempt
    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "validate_license",
          `License ${license_key} validated by admin`,
          new Date().toISOString(),
          request.headers.get("x-forwarded-for") || "unknown",
          license_key,
          hardware_id || ""
        ]
      );
    } catch (logError) {
      console.error("Failed to log validation:", logError);
    }
    
    client.release();
    
    return NextResponse.json({
      success: true,
      valid: true,
      message: message,
      status: license.status,
      days_left: daysLeft,
      plan: license.plan,
      max_devices: license.max_devices,
      hardware_ids: hardwareIds,
      license_key: license.license_key,
      customer_name: license.customer_name,
      customer_email: license.customer_email,
      expiry_date: license.expiry_date?.split('T')[0],
    });
    
  } catch (error) {
    console.error("Validate license error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
// FILE: D:\websmith\app\internal\backend\admin\search\license\route.ts
// PURPOSE: GET search for license by license key (with product isolation)
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/admin/search/license?license_key=XXXX-XXXX
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only
// UPDATED: Added product isolation (only active, non-deleted products)

import { NextResponse } from "next/server";
import { Pool } from "pg";

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  let client = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const license_key = searchParams.get("license_key");
    
    if (!license_key) {
      return NextResponse.json(
        { success: false, error: "license_key parameter is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const normalizedLicenseKey = license_key.toUpperCase();
    
    // Find license by key with product isolation
    // Only show licenses for active, non-deleted products
    const licenseResult = await client.query(
      `
      SELECT 
        l.license_key, 
        l.customer_name, 
        l.customer_email, 
        l.customer_mobile,
        l.customer_phone,
        l.plan, 
        l.status, 
        l.expiry_date, 
        l.max_devices, 
        l.notes, 
        l.created_at,
        p.is_active as product_is_active,
        p.is_deleted as product_is_deleted,
        p.name as product_name
      FROM licenses l
      LEFT JOIN products p ON l.product_id = p.product_id
      WHERE l.license_key = $1
        AND (p.is_active = TRUE OR p.is_active IS NULL)
        AND (p.is_deleted = false OR p.is_deleted IS NULL)
      `,
      [normalizedLicenseKey]
    );
    
    if (licenseResult.rows.length === 0) {
      client.release();
      return NextResponse.json({
        success: false,
        error: "License not found",
      });
    }
    
    const license = licenseResult.rows[0];
    
    // Check if product is inactive or deleted (return warning but still show)
    let productWarning = null;
    if (!license.product_is_active) {
      productWarning = "Associated product is currently inactive";
    }
    if (license.product_is_deleted === true) {
      productWarning = "Associated product has been archived";
    }
    
    // Get activations for this license
    const activationsResult = await client.query(
      `
      SELECT 
        hardware_id, 
        device_name, 
        ip_address, 
        activated_at, 
        last_seen,
        os_version,
        product_version,
        company_name,
        status as device_status
      FROM activations
      WHERE license_key = $1
      ORDER BY last_seen DESC
      `,
      [license.license_key]
    );
    
    client.release();
    
    const activations = activationsResult.rows;
    
    // Calculate days left
    let daysLeft = 0;
    if (license.expiry_date) {
      const expiry = new Date(license.expiry_date);
      const today = new Date();
      daysLeft = Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    const mobile = license.customer_mobile || license.customer_phone || '';

    const responseData: any = {
      success: true,
      license_key: license.license_key,
      customer_name: license.customer_name,
      customer_email: license.customer_email,
      customer_mobile: mobile,
      plan: license.plan,
      status: license.status,
      max_devices: license.max_devices,
      expiry_date: license.expiry_date?.split('T')[0],
      days_left: daysLeft,
      notes: license.notes,
      created_at: license.created_at,
      activations_detail: activations,
    };
    
    if (productWarning) {
      responseData.product_warning = productWarning;
    }
    
    if (license.product_name) {
      responseData.product_name = license.product_name;
    }
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error("Search by license error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to search license" },
      { status: 500 }
    );
  }
}
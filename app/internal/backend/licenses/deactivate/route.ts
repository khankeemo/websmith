// FILE: D:\websmith\app\internal\backend\licenses\deactivate\route.ts
// PURPOSE: Deactivate a device from a license with Notification

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

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
// POST /internal/backend/licenses/deactivate
// ============================================================

export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    // Get user from token
    const currentUser = getUserFromToken(request);
    
    const body = await request.json();
    const { license_key, hardware_id } = body;
    
    if (!license_key) {
      return NextResponse.json(
        { success: false, error: "License key is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const normalizedLicenseKey = license_key.toUpperCase();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    
    // Verify the license exists
    const licenseCheck = await client.query(
      `SELECT license_key, customer_name, plan, status FROM licenses WHERE license_key = $1`,
      [normalizedLicenseKey]
    );
    
    if (licenseCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "License not found" },
        { status: 404 }
      );
    }
    
    const license = licenseCheck.rows[0];

    if (license.status === 'inactive') {
      client.release();
      return NextResponse.json(
        { success: false, error: "License is already inactive" },
        { status: 409 }
      );
    }

    if (license.status === 'revoked') {
      client.release();
      return NextResponse.json(
        { success: false, error: "Cannot deactivate a revoked license" },
        { status: 409 }
      );
    }
    
    if (hardware_id) {
      // Device-level deactivation
      const hardwareCheck = await client.query(
        `SELECT device_name FROM activations WHERE license_key = $1 AND hardware_id = $2`,
        [normalizedLicenseKey, hardware_id]
      );
      
      const deviceName = hardwareCheck.rows.length > 0 && hardwareCheck.rows[0].device_name 
        ? hardwareCheck.rows[0].device_name 
        : hardware_id;
      
      const deleteResult = await client.query(
        `DELETE FROM activations WHERE license_key = $1 AND hardware_id = $2`,
        [normalizedLicenseKey, hardware_id]
      );
      
      if (deleteResult.rowCount === 0) {
        client.release();
        return NextResponse.json(
          { success: false, error: "Device not found for this license" },
          { status: 404 }
        );
      }
      
      await client.query(
        `UPDATE licenses 
         SET device_count = GREATEST(device_count - 1, 0),
             updated_at = $1
         WHERE license_key = $2`,
        [now, normalizedLicenseKey]
      );
      
      try {
        const adminUserId = currentUser ? currentUser.id : 'system';
        await client.query(
          `INSERT INTO notifications (user_id, title, message, type, link, created_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [adminUserId, "License Deactivated", `License ${license.license_key} (${license.customer_name}) deactivated from device: ${deviceName}`, "license_deactivated", `/internal/api/licenses/${license.license_key}`]
        );
      } catch (notifError) {
        console.error("Failed to create deactivation notification:", notifError);
      }
      
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ["deactivate", `Device ${hardware_id} deactivated from license ${license_key}`, now, clientIp, normalizedLicenseKey, hardware_id]
      );
      
      client.release();
      
      return NextResponse.json({
        success: true,
        message: "Device deactivated successfully"
      });
    } else {
      // License-level deactivation (no hardware_id provided)
      // Deactivate all active activations
      await client.query(
        `UPDATE activations SET is_active = false, last_seen = $1 WHERE license_key = $2 AND is_active = true`,
        [now, normalizedLicenseKey]
      );
      
      // Set license status to inactive
      await client.query(
        `UPDATE licenses SET status = 'inactive', inactive_reason = 'License Deactivated', device_count = 0, updated_at = $1 WHERE license_key = $2`,
        [now, normalizedLicenseKey]
      );
      
      try {
        const adminUserId = currentUser ? currentUser.id : 'system';
        await client.query(
          `INSERT INTO notifications (user_id, title, message, type, link, created_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [adminUserId, "License Deactivated", `License ${license.license_key} (${license.customer_name}) deactivated`, "license_deactivated", `/internal/api/licenses/${license.license_key}`]
        );
      } catch (notifError) {
        console.error("Failed to create deactivation notification:", notifError);
      }
      
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        ["license_deactivated", `License ${normalizedLicenseKey} deactivated`, now, clientIp, normalizedLicenseKey]
      );
      
      client.release();
      
      return NextResponse.json({
        success: true,
        message: "License deactivated successfully",
        license_key: normalizedLicenseKey,
        status: 'inactive'
      });
    }
    
  } catch (error) {
    console.error("Deactivation error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
// FILE: D:\websmith\app\internal\backend\admin\reset-device\route.ts
// ONE-SHOT FINAL VERSION

import { NextResponse } from "next/server";
import { Pool } from "pg";
import jwt from 'jsonwebtoken';
import { triggerNotification } from "@/lib/notification/notification-service";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function getUserFromToken(request: Request): { id: string; email: string; name: string; role: string } | null {
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

export async function POST(request: Request) {
  const currentUser = getUserFromToken(request);
  if (!currentUser) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let client = null;
  
  try {
    const body = await request.json();
    const { license_key, hardware_id } = body;
    
    if (!license_key || typeof license_key !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid license key is required" },
        { status: 400 }
      );
    }
    
    if (hardware_id !== undefined && typeof hardware_id !== "string") {
      return NextResponse.json(
        { success: false, error: "Hardware ID must be a string" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const normalizedLicenseKey = license_key.toUpperCase().trim();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    
    const licenseCheck = await client.query(
      `SELECT license_key, status FROM licenses WHERE license_key = $1`,
      [normalizedLicenseKey]
    );
    
    if (licenseCheck.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json(
        { success: false, error: "License not found" },
        { status: 404 }
      );
    }
    
    let removedCount = 0;
    
    if (hardware_id) {
      const result = await client.query(
        `DELETE FROM activations 
         WHERE license_key = $1 AND hardware_id = $2`,
        [normalizedLicenseKey, hardware_id]
      );
      removedCount = result.rowCount || 0;
    } else {
      const result = await client.query(
        `DELETE FROM activations WHERE license_key = $1`,
        [normalizedLicenseKey]
      );
      removedCount = result.rowCount || 0;
    }
    
    // Also clear license_bindings (unbind devices)
    await client.query(
      `UPDATE license_bindings 
       SET status = 'unbound', last_seen = $1 
       WHERE license_key = $2`,
      [now, normalizedLicenseKey]
    );
    
    // Deactivate license - set to inactive so SDK detects no valid activation
    await client.query(
      `UPDATE licenses 
       SET status = 'inactive', 
           inactive_reason = 'Hardware Reset by Admin',
           is_activated = false,
           activated_at = NULL,
           device_count = 0,
           updated_at = $1
       WHERE license_key = $2`,
      [now, normalizedLicenseKey]
    );
    
    // Log the reset
    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "reset_device",
          `Hardware reset: ${removedCount} device(s) removed, license deactivated for ${normalizedLicenseKey}`,
          now,
          clientIp,
          normalizedLicenseKey,
          hardware_id || null
        ]
      );
    } catch (logError) {
      console.error("Failed to log reset:", logError);
    }
    
    triggerNotification(pool, 'device_reset', {
      license_key: normalizedLicenseKey,
      hardware_id: hardware_id || '',
    }).catch(e => console.error('Device reset notification error:', e));
    
    client.release();
    client = null;
    
    return NextResponse.json({
      success: true,
      message: `Successfully reset ${removedCount} device(s) and deactivated license`,
      removed_count: removedCount,
      license_status: 'inactive'
    });
    
  } catch (error) {
    console.error("Reset device error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to reset devices" },
      { status: 500 }
    );
  }
}
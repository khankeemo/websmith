// FILE: D:\websmith\app\internal\backend\admin\bind-device\route.ts
// PURPOSE: Bind a hardware ID to a license (Universal Hardware Manager)
// DATABASE: Neon PostgreSQL only
// ENDPOINT: POST /internal/backend/admin/bind-device
// BODY: { license_key: string, hardware_id: string, device_name?: string }
// RULE 02: All code stays inside /internal - no main website interference
// FR1: Single Database Policy - Neon PostgreSQL only
// FR2: No SQLite, no local database, online only
// FR3: Database first - license_bindings table must exist

import { NextResponse } from "next/server";
import { Pool } from "pg";
import jwt from 'jsonwebtoken';

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
    const { license_key, hardware_id, device_name } = body;
    
    // Validation
    if (!license_key) {
      return NextResponse.json(
        { success: false, error: "License key is required" },
        { status: 400 }
      );
    }
    
    if (!hardware_id) {
      return NextResponse.json(
        { success: false, error: "Hardware ID is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const normalizedLicenseKey = license_key.toUpperCase();
    const normalizedHardwareId = hardware_id.trim();
    const now = new Date();
    const nowISO = now.toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    
    // Verify license exists
    const licenseCheck = await client.query(
      `SELECT license_key, max_devices, customer_name, status FROM licenses WHERE license_key = $1`,
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
    
    // Check license status (cannot bind to expired or revoked licenses)
    if (license.status === 'expired') {
      client.release();
      return NextResponse.json(
        { success: false, error: "Cannot bind device to expired license" },
        { status: 403 }
      );
    }
    
    if (license.status === 'revoked') {
      client.release();
      return NextResponse.json(
        { success: false, error: "Cannot bind device to revoked license" },
        { status: 403 }
      );
    }
    
    // Check if hardware is already bound to this license
    const existingBind = await client.query(
      `SELECT id, hardware_id, status FROM license_bindings 
       WHERE license_key = $1 AND hardware_id = $2`,
      [normalizedLicenseKey, normalizedHardwareId]
    );
    
    if (existingBind.rows.length > 0) {
      // Update existing binding
      await client.query(
        `UPDATE license_bindings 
         SET status = 'bound', last_seen = $1 
         WHERE license_key = $2 AND hardware_id = $3`,
        [nowISO, normalizedLicenseKey, normalizedHardwareId]
      );
      
      // Log the rebind
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ["rebind_device", `Device ${hardware_id} rebound to license ${license_key}`, nowISO, clientIp, normalizedLicenseKey, normalizedHardwareId]
      );
      
      client.release();
      
      return NextResponse.json({
        success: true,
        message: "Device rebound successfully",
        already_bound: true
      });
    }
    
    // Check device limit
    const boundCount = await client.query(
      `SELECT COUNT(*) as count FROM license_bindings 
       WHERE license_key = $1 AND status = 'bound'`,
      [normalizedLicenseKey]
    );
    
    const currentCount = parseInt(boundCount.rows[0]?.count || "0");
    const maxDevices = license.max_devices || 0;
    
    if (maxDevices > 0 && currentCount >= maxDevices) {
      client.release();
      return NextResponse.json(
        { 
          success: false, 
          error: `Device limit reached (${maxDevices} devices max). Unbind a device first.`,
          current_devices: currentCount,
          max_devices: maxDevices
        },
        { status: 409 }
      );
    }
    
    // Create new binding
    await client.query(
      `INSERT INTO license_bindings (license_key, hardware_id, status, bound_at, last_seen)
       VALUES ($1, $2, $3, $4, $5)`,
      [normalizedLicenseKey, normalizedHardwareId, 'bound', nowISO, nowISO]
    );
    
    // Update license status to active if it was inactive
    if (license.status === 'inactive') {
      await client.query(
        `UPDATE licenses SET status = 'active', inactive_reason = NULL, is_activated = TRUE, activated_at = $1 
         WHERE license_key = $2`,
        [nowISO, normalizedLicenseKey]
      );
    }
    
    // Log the bind
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ["bind_device", `Device ${hardware_id} bound to license ${license_key}`, nowISO, clientIp, normalizedLicenseKey, normalizedHardwareId]
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: "Device bound successfully",
      device_name: device_name || null,
      bound_at: nowISO,
      current_devices: currentCount + 1,
      max_devices: maxDevices
    });
    
  } catch (error) {
    console.error("Bind device error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Admin bind-device endpoint is ready",
    endpoint: "POST /internal/backend/admin/bind-device",
    body: { license_key: "string", hardware_id: "string", device_name: "optional string" }
  });
}
// FILE: D:\websmith\app\internal\backend\admin\replace-device\route.ts
// PURPOSE: Replace a bound hardware ID with a new hardware ID (Universal Hardware Manager)
// DATABASE: Neon PostgreSQL only
// ENDPOINT: POST /internal/backend/admin/replace-device
// BODY: { license_key: string, old_hardware_id: string, new_hardware_id: string, device_name?: string }
// RULE 02: All code stays inside /internal - no main website interference
// FR1: Single Database Policy - Neon PostgreSQL only
// FR2: No SQLite, no local database, online only
// FR3: Database first - license_bindings table must exist

import { triggerNotification } from '@/lib/notification/notification-service';

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
    const { license_key, old_hardware_id, new_hardware_id, device_name } = body;
    
    // Validation
    if (!license_key) {
      return NextResponse.json(
        { success: false, error: "License key is required" },
        { status: 400 }
      );
    }
    
    if (!old_hardware_id) {
      return NextResponse.json(
        { success: false, error: "Old hardware ID is required" },
        { status: 400 }
      );
    }
    
    if (!new_hardware_id) {
      return NextResponse.json(
        { success: false, error: "New hardware ID is required" },
        { status: 400 }
      );
    }
    
    if (old_hardware_id === new_hardware_id) {
      return NextResponse.json(
        { success: false, error: "Old and new hardware IDs cannot be the same" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    const normalizedLicenseKey = license_key.toUpperCase();
    const normalizedOldHardwareId = old_hardware_id.trim();
    const normalizedNewHardwareId = new_hardware_id.trim();
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
    
    // Check license status
    if (license.status === 'expired') {
      client.release();
      return NextResponse.json(
        { success: false, error: "Cannot replace device on expired license" },
        { status: 403 }
      );
    }
    
    if (license.status === 'revoked') {
      client.release();
      return NextResponse.json(
        { success: false, error: "Cannot replace device on revoked license" },
        { status: 403 }
      );
    }
    
    // Verify old hardware is currently bound
    const oldBindCheck = await client.query(
      `SELECT id, hardware_id, status FROM license_bindings 
       WHERE license_key = $1 AND hardware_id = $2 AND status = 'bound'`,
      [normalizedLicenseKey, normalizedOldHardwareId]
    );
    
    if (oldBindCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: `Hardware ID ${old_hardware_id} is not bound to this license` },
        { status: 404 }
      );
    }
    
    // Check if new hardware is already bound to this license
    const newBindCheck = await client.query(
      `SELECT id, hardware_id, status FROM license_bindings 
       WHERE license_key = $1 AND hardware_id = $2`,
      [normalizedLicenseKey, normalizedNewHardwareId]
    );
    
    let wasAlreadyBound = false;
    
    if (newBindCheck.rows.length > 0) {
      // New hardware already exists - update its status to bound
      await client.query(
        `UPDATE license_bindings 
         SET status = 'bound', last_seen = $1 
         WHERE license_key = $2 AND hardware_id = $3`,
        [nowISO, normalizedLicenseKey, normalizedNewHardwareId]
      );
      wasAlreadyBound = true;
    } else {
      // Create new binding for new hardware
      await client.query(
        `INSERT INTO license_bindings (license_key, hardware_id, status, bound_at, last_seen)
         VALUES ($1, $2, $3, $4, $5)`,
        [normalizedLicenseKey, normalizedNewHardwareId, 'bound', nowISO, nowISO]
      );
    }
    
    // Unbind the old hardware (set status to 'unbound' or delete)
    await client.query(
      `UPDATE license_bindings 
       SET status = 'unbound', last_seen = $1 
       WHERE license_key = $2 AND hardware_id = $3`,
      [nowISO, normalizedLicenseKey, normalizedOldHardwareId]
    );
    
    // Record the replacement in activations table for history
    await client.query(
      `INSERT INTO activations (license_key, hardware_id, device_name, ip_address, activated_at, last_seen, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [normalizedLicenseKey, normalizedNewHardwareId, device_name || null, clientIp, nowISO, nowISO, 'active']
    );
    
    // Log the replacement
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "replace_device", 
        `Device replaced: ${old_hardware_id} → ${new_hardware_id} for license ${license_key}`, 
        nowISO, 
        clientIp, 
        normalizedLicenseKey, 
        normalizedNewHardwareId
      ]
    );
    
    // Get current bound count
    const boundCount = await client.query(
      `SELECT COUNT(*) as count FROM license_bindings 
       WHERE license_key = $1 AND status = 'bound'`,
      [normalizedLicenseKey]
    );
    
    triggerNotification(pool, 'device_changed', {
      license_key: normalizedLicenseKey,
      hardware_id: normalizedNewHardwareId,
      device_name: body.device_name || '',
    }).catch(e => console.error('Device change notification error:', e));

    client.release();
    
    return NextResponse.json({
      success: true,
      message: wasAlreadyBound 
        ? `Device replaced successfully (${old_hardware_id} → ${new_hardware_id})` 
        : `Device replaced successfully. New hardware bound.`,
      old_hardware_id: normalizedOldHardwareId,
      new_hardware_id: normalizedNewHardwareId,
      replaced_at: nowISO,
      current_bound_devices: parseInt(boundCount.rows[0]?.count || "0")
    });
    
  } catch (error) {
    console.error("Replace device error:", error);
    
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
    message: "Admin replace-device endpoint is ready",
    endpoint: "POST /internal/backend/admin/replace-device",
    body: { 
      license_key: "string", 
      old_hardware_id: "string", 
      new_hardware_id: "string", 
      device_name: "optional string" 
    }
  });
}
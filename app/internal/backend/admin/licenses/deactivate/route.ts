// FILE: app/internal/backend/admin/licenses/deactivate/route.ts
// PURPOSE: Admin deactivate a license (set status to inactive)
// ENDPOINT: POST /internal/backend/admin/licenses/deactivate

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

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
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const currentUser = getUserFromToken(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const body = await request.json();
    const { license_key } = body;

    if (!license_key) {
      return NextResponse.json({ success: false, error: "License key is required" }, { status: 400 });
    }

    client = await pool.connect();
    const normalizedKey = license_key.toUpperCase();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    const licenseCheck = await client.query(
      `SELECT license_key, customer_name, customer_email, status FROM licenses WHERE license_key = $1`,
      [normalizedKey]
    );

    if (licenseCheck.rows.length === 0) {
      client.release();
      return NextResponse.json({ success: false, error: "License not found" }, { status: 404 });
    }

    const license = licenseCheck.rows[0];

    if (license.status === 'inactive') {
      client.release();
      return NextResponse.json({ success: false, error: "License is already inactive" }, { status: 409 });
    }

    if (license.status === 'revoked') {
      client.release();
      return NextResponse.json({ success: false, error: "Cannot deactivate a revoked license" }, { status: 409 });
    }

    if (license.status === 'suspended') {
      client.release();
      return NextResponse.json({ success: false, error: "Cannot deactivate a suspended license" }, { status: 409 });
    }

    if (license.status === 'expired') {
      client.release();
      return NextResponse.json({ success: false, error: "Cannot deactivate an expired license" }, { status: 409 });
    }

    if (license.status === 'deleted') {
      client.release();
      return NextResponse.json({ success: false, error: "Cannot deactivate a deleted license" }, { status: 409 });
    }

    // Set license status to inactive
    await client.query(
      `UPDATE licenses SET status = 'inactive', inactive_reason = 'License Deactivated', updated_at = $1 WHERE license_key = $2`,
      [now, normalizedKey]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
       VALUES ($1, $2, $3, $4, $5)`,
      ['license_deactivated', `License ${normalizedKey} deactivated by admin ${currentUser.email}`, now, clientIp, normalizedKey]
    );

    client.release();

    return NextResponse.json({
      success: true,
      message: "License deactivated successfully",
      license_key: normalizedKey,
      status: 'inactive',
    });

  } catch (error) {
    console.error("Admin deactivate error:", error);
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

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
    const { activation_id, hardware_id, license_key } = body;

    if (!activation_id && (!hardware_id || !license_key)) {
      return NextResponse.json(
        { success: false, error: "Provide activation_id or (hardware_id + license_key)" },
        { status: 400 }
      );
    }

    client = await pool.connect();
    const now = new Date().toISOString();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    let targetActivation: any = null;

    if (activation_id) {
      const actRes = await client.query(
        `SELECT id, license_key, hardware_id, device_name FROM activations WHERE id = $1 AND is_active = TRUE`,
        [parseInt(activation_id)]
      );
      if (actRes.rows.length > 0) targetActivation = actRes.rows[0];
    } else {
      const nk = license_key!.toUpperCase();
      const actRes = await client.query(
        `SELECT id, license_key, hardware_id, device_name FROM activations WHERE license_key = $1 AND hardware_id = $2 AND is_active = TRUE`,
        [nk, hardware_id]
      );
      if (actRes.rows.length > 0) targetActivation = actRes.rows[0];
    }

    if (!targetActivation) {
      client.release();
      return NextResponse.json({ success: false, error: "Active activation not found" }, { status: 404 });
    }

    await client.query(
      `UPDATE activations SET is_active = FALSE, status = 'inactive', last_seen = $1 WHERE id = $2`,
      [now, targetActivation.id]
    );

    await client.query(
      `UPDATE licenses SET device_count = GREATEST(device_count - 1, 0), updated_at = $1 WHERE license_key = $2`,
      [now, targetActivation.license_key]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['device_deactivated', `Device ${targetActivation.hardware_id} (${targetActivation.device_name || 'unknown'}) deactivated by admin ${currentUser.email}`,
       now, clientIp, targetActivation.license_key, targetActivation.hardware_id]
    );

    client.release();

    return NextResponse.json({
      success: true,
      message: "Device deactivated successfully",
      activation_id: targetActivation.id,
      hardware_id: targetActivation.hardware_id,
      license_key: targetActivation.license_key,
    });
  } catch (error) {
    console.error("Device deactivate error:", error);
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

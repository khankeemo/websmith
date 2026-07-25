import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function GET(request: NextRequest) {
  let client = null;

  try {
    const { searchParams } = new URL(request.url);
    const licenseKey = searchParams.get('license_key')?.toUpperCase();
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!licenseKey) {
      return NextResponse.json(
        { success: false, error: "license_key is required" },
        { status: 400 }
      );
    }

    client = await pool.connect();

    const validLimit = Math.min(Math.max(limit, 1), 200);

    const existingLicense = await client.query(
      `SELECT license_key FROM licenses WHERE license_key = $1`,
      [licenseKey]
    );
    if (existingLicense.rows.length === 0) {
      client.release();
      return NextResponse.json({ success: false, error: "License not found" }, { status: 404 });
    }

    const eventsResult = await client.query(
      `SELECT id, event_type, message, timestamp, ip_address, hardware_id
       FROM audit_logs
       WHERE license_key = $1
       ORDER BY timestamp DESC
       LIMIT $2 OFFSET $3`,
      [licenseKey, validLimit, offset]
    );

    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE license_key = $1`,
      [licenseKey]
    );
    const total = parseInt(countResult.rows[0].total);

    const eventTypeColors: Record<string, string> = {
      license_created: 'blue',
      trial_started: 'purple',
      trial_converted: 'emerald',
      activation_success: 'emerald',
      activation_failed: 'red',
      license_activated: 'emerald',
      license_deactivated: 'red',
      license_revoked: 'pink',
      license_renewed: 'amber',
      device_replaced: 'orange',
      device_reset: 'yellow',
      device_changed: 'orange',
      license_expired: 'gray',
      reactivation_approved: 'emerald',
      reactivation_rejected: 'red',
      admin_note: 'blue',
    };

    const events = eventsResult.rows.map((row: any) => ({
      id: row.id,
      type: row.event_type,
      message: row.message,
      timestamp: row.timestamp,
      ip_address: row.ip_address,
      hardware_id: row.hardware_id,
      color: eventTypeColors[row.event_type as string] || 'gray',
      label: (row.event_type as string)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    }));

    client.release();

    return NextResponse.json({
      success: true,
      data: {
        events,
        pagination: {
          total,
          limit: validLimit,
          offset,
          has_more: offset + validLimit < total,
        },
      },
    });
  } catch (error) {
    console.error("Activation timeline error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

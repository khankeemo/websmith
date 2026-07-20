import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ALL_EVENTS = [
  'otp_verification', 'license_created', 'trial_started', 'trial_ending_reminder',
  'activation_success', 'activation_failed', 'license_renewed', 'license_expired',
  'license_revoked', 'device_changed', 'device_reset', 'payment_success',
  'subscription_reminder', 'product_purchased', 'welcome_customer',
  'admin_notification', 'product_archived', 'product_restored',
  'sdk_generated', 'api_key_generated', 'security_alert', 'audit_summary'
];

const DEFAULT_CONFIGS: Record<string, { email: boolean; sms: boolean }> = {
  otp_verification: { email: true, sms: true },
  license_created: { email: true, sms: true },
  trial_started: { email: true, sms: true },
  trial_ending_reminder: { email: true, sms: true },
  activation_success: { email: true, sms: true },
  activation_failed: { email: true, sms: true },
  license_renewed: { email: true, sms: true },
  license_expired: { email: true, sms: true },
  license_revoked: { email: true, sms: true },
  device_changed: { email: true, sms: true },
  device_reset: { email: true, sms: true },
  payment_success: { email: true, sms: true },
  subscription_reminder: { email: true, sms: true },
  product_purchased: { email: true, sms: true },
  welcome_customer: { email: true, sms: true },
  admin_notification: { email: true, sms: false },
  product_archived: { email: true, sms: false },
  product_restored: { email: true, sms: false },
  sdk_generated: { email: true, sms: false },
  api_key_generated: { email: true, sms: false },
  security_alert: { email: true, sms: false },
  audit_summary: { email: true, sms: false },
};

export async function GET() {
  let client = null;
  try {
    client = await pool.connect();

    await client.query(`CREATE TABLE IF NOT EXISTS event_notification_config (
      id SERIAL PRIMARY KEY,
      event_type TEXT NOT NULL UNIQUE,
      email_enabled BOOLEAN DEFAULT TRUE,
      sms_enabled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const r = await client.query(`SELECT * FROM event_notification_config ORDER BY event_type`);

    if (r.rows.length === 0) {
      for (const ev of ALL_EVENTS) {
        const cfg = DEFAULT_CONFIGS[ev];
        await client.query(
          `INSERT INTO event_notification_config (event_type, email_enabled, sms_enabled)
           VALUES ($1, $2, $3)
           ON CONFLICT (event_type) DO NOTHING`,
          [ev, cfg?.email ?? true, cfg?.sms ?? false]
        );
      }
      const r2 = await client.query(`SELECT * FROM event_notification_config ORDER BY event_type`);
      client.release();
      return NextResponse.json({ success: true, configs: r2.rows, seeded: true });
    }

    client.release();
    return NextResponse.json({ success: true, configs: r.rows });
  } catch (error) {
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to fetch event configs" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { event_type, email_enabled, sms_enabled } = body;
    if (!event_type) {
      return NextResponse.json({ success: false, error: "event_type required" }, { status: 400 });
    }
    client = await pool.connect();
    const r = await client.query(
      `INSERT INTO event_notification_config (event_type, email_enabled, sms_enabled, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (event_type) DO UPDATE SET email_enabled = COALESCE($2, event_notification_config.email_enabled), sms_enabled = COALESCE($3, event_notification_config.sms_enabled), updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [event_type, email_enabled !== undefined ? email_enabled : true, sms_enabled !== undefined ? sms_enabled : false]
    );
    client.release();
    return NextResponse.json({ success: true, config: r.rows[0] });
  } catch (error) {
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to update event config" }, { status: 500 });
  }
}

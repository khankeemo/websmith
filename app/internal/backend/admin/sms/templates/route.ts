import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SMS_TYPES = [
  'otp_verification', 'license_created', 'trial_started', 'trial_ending_reminder',
  'activation_success', 'activation_failed', 'license_renewed', 'license_expired',
  'license_revoked', 'device_changed', 'device_reset', 'payment_success',
  'subscription_reminder', 'product_purchased', 'welcome_customer',
  'admin_notification', 'product_archived', 'product_restored',
  'sdk_generated', 'api_key_generated', 'security_alert', 'audit_summary'
];

const DEFAULT_MESSAGES: Record<string, string> = {
  otp_verification: 'Your WebSmith verification code is: {{otp_code}}. Valid for 5 minutes. Do not share this code.',
  license_created: 'Hi {{customer_name}}, your {{product}} license has been created! Key: {{license_key}}. Expires: {{expiry_date}}. Welcome to WebSmith!',
  trial_started: 'Hi {{customer_name}}, your {{product}} trial has started! You have {{trial_days}} days to explore. Expires: {{expiry_date}}. Upgrade anytime!',
  trial_ending_reminder: 'Hi {{customer_name}}, your {{product}} trial ends in {{days_remaining}} days ({{expiry_date}}). Upgrade now to keep access!',
  activation_success: 'Hi {{customer_name}}, {{product}} activated on {{device_name}}. License: {{license_key}}. Expires: {{expiry_date}}. Enjoy!',
  activation_failed: 'Hi {{customer_name}}, {{product}} activation failed for {{device_name}}. Please contact support at {{support_email}}.',
  license_renewed: 'Hi {{customer_name}}, your {{product}} license has been renewed! New expiry: {{expiry_date}}. Thank you for your continued trust.',
  license_expired: 'Hi {{customer_name}}, your {{product}} license ({{license_key}}) has expired. Renew now to regain access.',
  license_revoked: 'Hi {{customer_name}}, your {{product}} license ({{license_key}}) has been revoked. Contact {{support_email}} for details.',
  device_changed: 'Hi {{customer_name}}, {{product}} license was activated on a new device ({{device_name}}). If not you, contact {{support_email}}.',
  device_reset: 'Hi {{customer_name}}, devices for {{product}} license ({{license_key}}) were reset. Re-activate your devices to continue.',
  payment_success: 'Hi {{customer_name}}, payment of {{amount}} for {{product}} ({{plan_name}}) was successful. Thank you!',
  subscription_reminder: 'Hi {{customer_name}}, your {{product}} subscription renews on {{renewal_date}}. Amount: {{amount}}.',
  product_purchased: 'Hi {{customer_name}}, thank you for purchasing {{product}} ({{plan_name}})! License: {{license_key}}.',
  welcome_customer: 'Welcome to WebSmith, {{customer_name}}! Your {{product}} journey begins now. Contact {{support_email}}.',
  admin_notification: '[Admin] {{admin_message}}',
  product_archived: '[Admin] Product {{product}} has been archived.',
  product_restored: '[Admin] Product {{product}} has been restored.',
  sdk_generated: '[Admin] SDK generated for {{product}} ({{product_version}}).',
  api_key_generated: '[Admin] New API key generated for {{product}}.',
  security_alert: '[Alert] {{alert_message}}',
  audit_summary: '[Admin] Audit summary: {{summary_details}}'
};

export async function GET() {
  let client = null;
  try {
    client = await pool.connect();

    await client.query(`CREATE TABLE IF NOT EXISTS sms_templates (
      id SERIAL PRIMARY KEY,
      sms_type TEXT NOT NULL UNIQUE,
      message TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const r = await client.query(`SELECT * FROM sms_templates ORDER BY sms_type`);

    if (r.rows.length === 0) {
      for (const st of SMS_TYPES) {
        await client.query(
          `INSERT INTO sms_templates (sms_type, message, is_active)
           VALUES ($1, $2, true)
           ON CONFLICT (sms_type) DO NOTHING`,
          [st, DEFAULT_MESSAGES[st] || '']
        );
      }
      const r2 = await client.query(`SELECT * FROM sms_templates ORDER BY sms_type`);
      client.release();
      return NextResponse.json({ success: true, templates: r2.rows, seeded: true });
    }

    client.release();
    return NextResponse.json({ success: true, templates: r.rows });
  } catch (error) {
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to fetch SMS templates" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { sms_type, message, is_active } = body;
    if (!sms_type || !message) {
      return NextResponse.json({ success: false, error: "sms_type and message required" }, { status: 400 });
    }
    client = await pool.connect();
    const r = await client.query(
      `INSERT INTO sms_templates (sms_type, message, is_active, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (sms_type) DO UPDATE SET message = $2, is_active = COALESCE($3, sms_templates.is_active), updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [sms_type, message, is_active !== undefined ? is_active : true]
    );
    client.release();
    return NextResponse.json({ success: true, template: r.rows[0] });
  } catch (error) {
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to update SMS template" }, { status: 500 });
  }
}

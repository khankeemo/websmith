import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export const dynamic = 'force-dynamic';

const DEFAULT_COMM_SETTINGS = {
  mail_accounts: [
    {
      id: 'no-reply',
      name: 'No-Reply',
      email: process.env.MAIL_FROM_ADDRESS || 'no-reply@websmithdigital.com',
      display_name: process.env.MAIL_FROM_NAME || 'Websmith Support',
      type: 'system',
      reply_to: '',
      signature: '',
      is_active: true,
      templates: ['otp_verification', 'license_created', 'trial_started', 'activation_success', 'license_renewed', 'license_expired', 'license_revoked', 'welcome_customer', 'reactivation_approved', 'reactivation_rejected', 'payment_success', 'subscription_reminder', 'password_reset', 'device_reset', 'device_changed'],
    },
    {
      id: 'support',
      name: 'Support',
      email: process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com',
      display_name: process.env.MAIL_SUPPORT_NAME || 'Websmith Support Team',
      type: 'support',
      reply_to: process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com',
      signature: 'Best regards,\nThe Support Team',
      is_active: true,
      templates: ['admin_notification', 'support_reply', 'conversation_created'],
    },
    {
      id: 'sales',
      name: 'Sales',
      email: process.env.MAIL_SALES_ADDRESS || 'sales@websmithdigital.com',
      display_name: process.env.MAIL_SALES_NAME || 'Websmith Sales Team',
      type: 'sales',
      reply_to: process.env.MAIL_SALES_ADDRESS || 'sales@websmithdigital.com',
      signature: 'Best regards,\nThe Sales Team',
      is_active: true,
      templates: ['new_sales_enquiry', 'sales_reply'],
    },
  ],
  general: {
    retry_max_attempts: 5,
    retry_base_delay_minutes: 1,
    attachment_max_size_mb: 10,
    attachment_max_per_message: 5,
    auto_resolve_days: 30,
    bcc_admin_on_all: false,
    default_template_language: 'en',
  },
  routing: {
    support_categories: ['support', 'activation', 'renewal', 'reactivation', 'hardware_replacement', 'general'],
    sales_categories: ['sales'],
  },
  signatures: [],
  // Admin toggle for the Mail Delete feature. When false, the backend rejects
  // every permanent conversation-delete request (UI hiding is never enough).
  allow_email_deletion: true,
};

export async function GET() {
  let client = null;
  try {
    client = await (await getDb()).connect();

    const tableCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'system_settings') as exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      client.release();
      return NextResponse.json({ success: true, settings: DEFAULT_COMM_SETTINGS, message: 'Using default settings.' });
    }

    const result = await client.query(
      `SELECT settings FROM system_settings ORDER BY id DESC LIMIT 1`
    );

    client.release();
    client = null;

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, settings: DEFAULT_COMM_SETTINGS, message: 'Using default settings.' });
    }

    const allSettings = result.rows[0].settings;
    const commSettings = allSettings.communications || {};

    const merged = {
      mail_accounts: commSettings.mail_accounts || DEFAULT_COMM_SETTINGS.mail_accounts,
      general: { ...DEFAULT_COMM_SETTINGS.general, ...(commSettings.general || {}) },
      routing: { ...DEFAULT_COMM_SETTINGS.routing, ...(commSettings.routing || {}) },
      // Reusable email signatures managed from the Communication Center
      // (stored in the same system_settings record — no new table).
      signatures: commSettings.signatures || [],
      // Default ENABLED so existing installs keep current behaviour; the merge
      // only flips to disabled when an admin explicitly saved it as false.
      allow_email_deletion: commSettings.allow_email_deletion !== false,
    };

    return NextResponse.json({ success: true, settings: merged });

  } catch (error: any) {
    console.error('Communications settings GET error:', error);
    if (client) { client.release(); }
    return NextResponse.json({ success: true, settings: DEFAULT_COMM_SETTINGS, message: 'Using default settings (error).' });
  }
}

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    client = await (await getDb()).connect();

    const tableCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'system_settings') as exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id SERIAL PRIMARY KEY,
          settings JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    const existing = await client.query(
      `SELECT id, settings FROM system_settings ORDER BY id DESC LIMIT 1`
    );

    const now = new Date().toISOString();

    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO system_settings (settings, updated_at) VALUES ($1, $2)`,
        [JSON.stringify({ communications: body }), now]
      );
    } else {
      const currentSettings = existing.rows[0].settings || {};
      await client.query(
        `UPDATE system_settings SET settings = $1, updated_at = $2 WHERE id = $3`,
        [JSON.stringify({ ...currentSettings, communications: body }), now, existing.rows[0].id]
      );
    }

    try {
      const logClient = await (await getDb()).connect();
      await logClient.query(
        `INSERT INTO audit_logs (event_type, message, timestamp) VALUES ($1, $2, $3)`,
        ['communication_settings_updated', 'Communication settings were updated.', now]
      );
      logClient.release();
    } catch {}

    client.release();
    client = null;

    return NextResponse.json({ success: true, message: 'Communication settings saved.' });

  } catch (error: any) {
    console.error('Communications settings POST error:', error);
    if (client) { client.release(); }
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save settings.' } }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export const dynamic = 'force-dynamic';

const getAuthHeaders = (request: NextRequest) => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const logAudit = async (eventType: string, message: string) => {
  try {
    const auditClient = await (await getDb()).connect();
    await auditClient.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      [eventType, message, new Date().toISOString()]
    );
    auditClient.release();
  } catch {}
};

export async function GET(request: NextRequest) {
  let client = null;
  try {
    client = await (await getDb()).connect();

    // Auto-reply template/signature references (new mailbox fields —
    // ADD COLUMN IF NOT EXISTS keeps existing databases in sync).
    await client.query(`ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS auto_reply_template_key TEXT DEFAULT ''`);
    await client.query(`ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS auto_reply_signature TEXT DEFAULT ''`);

    const result = await client.query(
      `SELECT * FROM mailboxes ORDER BY is_default_sender DESC, created_at DESC`
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: { mailboxes: result.rows }
    });

  } catch (error: any) {
    console.error('Mailboxes list error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list mailboxes.' }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const {
      provider,
      email_address,
      display_name,
      imap_host,
      imap_port,
      imap_secure,
      imap_username,
      imap_password,
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_username,
      smtp_password,
      signature,
      auto_reply_enabled,
      auto_reply_message,
      auto_reply_template_key,
      auto_reply_signature,
    } = body;

    if (!provider || !email_address || !imap_host || !imap_username || !imap_password || !smtp_host || !smtp_username || !smtp_password) {
      await logAudit('mailbox_create_failed', `Mailbox creation failed for ${email_address || '(no email)'}: missing required fields.`);
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Required fields: provider, email_address, imap_host, imap_username, imap_password, smtp_host, smtp_username, smtp_password' }
      }, { status: 400 });
    }

    const normalizedEmail = email_address.trim().toLowerCase();
    const mailboxId = `MBX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    client = await (await getDb()).connect();

    const existing = await client.query('SELECT id FROM mailboxes WHERE email_address = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      client.release();
      client = null;
      await logAudit('mailbox_create_failed', `Mailbox creation failed for ${normalizedEmail}: duplicate email address.`);
      return NextResponse.json({
        success: false,
        error: { code: 'DUPLICATE_EMAIL', message: 'A mailbox with this email address already exists.' }
      }, { status: 400 });
    }

    if (body.is_default_sender) {
      await client.query('UPDATE mailboxes SET is_default_sender = FALSE');
    }

    await client.query(
      `INSERT INTO mailboxes (
        id, provider, email_address, display_name,
        imap_host, imap_port, imap_secure, imap_username, imap_password,
        smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password,
        connection_status, sync_status, is_default_sender, is_enabled,
        signature, auto_reply_enabled, auto_reply_message,
        auto_reply_template_key, auto_reply_signature,
        queue_size, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'unknown','never',$15,$16,$17,$18,$19,$20,$21,0,$22,$22)`,
      [
        mailboxId, provider, normalizedEmail, display_name || '',
        imap_host, imap_port || 993, imap_secure !== false, imap_username, imap_password,
        smtp_host, smtp_port || 465, smtp_secure !== false, smtp_username, smtp_password,
        body.is_default_sender === true, true,
        signature || '', auto_reply_enabled === true, auto_reply_message || '',
        auto_reply_template_key || '', auto_reply_signature || '',
        now
      ]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['mailbox_created', `Mailbox ${normalizedEmail} (${provider}) created`, now]
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      message: 'Mailbox created successfully.',
      mailbox_id: mailboxId
    });

  } catch (error: any) {
    console.error('Mailbox create error:', error);
    if (client) { client.release(); }
    await logAudit('mailbox_create_failed', `Mailbox creation failed: ${error?.message || 'internal error'}.`);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create mailbox.' }
    }, { status: 500 });
  }
}

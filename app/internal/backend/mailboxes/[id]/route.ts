import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import {
  MailboxRemovalError,
  removeMailboxIntegration,
  cleanupOrphanedAttachmentFiles,
} from '@/lib/communications/remove-mailbox';

export const dynamic = 'force-dynamic';

const getAuthHeaders = (request: NextRequest) => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    client = await (await getDb()).connect();

    const result = await client.query('SELECT * FROM mailboxes WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'MAILBOX_NOT_FOUND', message: 'Mailbox not found.' }
      }, { status: 404 });
    }

    const mailbox = result.rows[0];
    const maskedMailbox = {
      ...mailbox,
      imap_password: '********',
      smtp_password: '********',
    };

    const logsResult = await client.query(
      `SELECT * FROM mailbox_sync_logs WHERE mailbox_id = $1 ORDER BY started_at DESC LIMIT 20`,
      [id]
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: { mailbox: maskedMailbox, sync_logs: logsResult.rows }
    });

  } catch (error: any) {
    console.error('Mailbox detail error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load mailbox.' }
    }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
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
      is_enabled,
      is_default_sender,
    } = body;

    client = await (await getDb()).connect();

    // Auto-reply template/signature references (new mailbox fields —
    // ADD COLUMN IF NOT EXISTS keeps existing databases in sync).
    await client.query(`ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS auto_reply_template_key TEXT DEFAULT ''`);
    await client.query(`ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS auto_reply_signature TEXT DEFAULT ''`);

    const existing = await client.query('SELECT * FROM mailboxes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'MAILBOX_NOT_FOUND', message: 'Mailbox not found.' }
      }, { status: 404 });
    }

    if (email_address) {
      const normalizedEmail = email_address.trim().toLowerCase();
      const duplicate = await client.query('SELECT id FROM mailboxes WHERE email_address = $1 AND id != $2', [normalizedEmail, id]);
      if (duplicate.rows.length > 0) {
        client.release();
        client = null;
        return NextResponse.json({
          success: false,
          error: { code: 'DUPLICATE_EMAIL', message: 'A mailbox with this email address already exists.' }
        }, { status: 400 });
      }
    }

    if (is_default_sender === true) {
      await client.query('UPDATE mailboxes SET is_default_sender = FALSE');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = [
      'provider', 'email_address', 'display_name',
      'imap_host', 'imap_port', 'imap_secure', 'imap_username', 'imap_password',
      'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_username', 'smtp_password',
      'signature', 'auto_reply_enabled', 'auto_reply_message',
      'auto_reply_template_key', 'auto_reply_signature',
      'is_enabled', 'is_default_sender'
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(body[field]);
      }
    }

    if (updates.length > 0) {
      updates.push(`updated_at = $${paramIndex++}`);
      values.push(new Date().toISOString());
      values.push(id);

      await client.query(
        `UPDATE mailboxes SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['mailbox_updated', `Mailbox ${existing.rows[0].email_address} updated`, new Date().toISOString()]
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      message: 'Mailbox updated successfully.'
    });

  } catch (error: any) {
    console.error('Mailbox update error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update mailbox.' }
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    client = await (await getDb()).connect();

    // Integration-level removal: deletes every conversation synced from this
    // mailbox (messages, attachments via FK cascade, queue records), its sync
    // history, and the mailbox row itself — all in ONE transaction. A
    // protected system mailbox (support/sales/no-reply) is rejected.
    // `cleanupLegacyEmail=true` also sweeps legacy unowned conversations whose
    // customer_email matches the mailbox address (one-time migration helper).
    const searchParams = new URL(request.url).searchParams;
    const cleanupLegacyEmail = searchParams.get('cleanup_legacy_email') === 'true';

    const result = await removeMailboxIntegration(client, id, { cleanupLegacyEmail });
    // Attachment files are unlinked only after commit and only when no
    // remaining record (conversation_attachments / email_attachments) still
    // references them — shared files are never deleted.
    await cleanupOrphanedAttachmentFiles(client, result.attachmentPaths);

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      message: `Mailbox ${result.email} removed. ${result.conversationsDeleted} conversation(s) deleted${result.legacyDeleted ? `, ${result.legacyDeleted} legacy conversation(s) cleaned` : ''}.`,
      data: result,
    });

  } catch (error: any) {
    console.error('Mailbox delete error:', error);
    if (client) { client.release(); }
    if (error instanceof MailboxRemovalError) {
      return NextResponse.json({
        success: false,
        error: { code: error.code, message: error.message }
      }, { status: error.status });
    }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete mailbox.' }
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

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
      is_enabled,
      is_default_sender,
    } = body;

    client = await (await getDb()).connect();

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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    client = await (await getDb()).connect();

    const existing = await client.query('SELECT * FROM mailboxes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'MAILBOX_NOT_FOUND', message: 'Mailbox not found.' }
      }, { status: 404 });
    }

    const email = existing.rows[0].email_address;

    await client.query('DELETE FROM mailbox_sync_logs WHERE mailbox_id = $1', [id]);
    await client.query('DELETE FROM mailboxes WHERE id = $1', [id]);

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['mailbox_deleted', `Mailbox ${email} permanently deleted`, new Date().toISOString()]
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      message: 'Mailbox permanently deleted.'
    });

  } catch (error: any) {
    console.error('Mailbox delete error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete mailbox.' }
    }, { status: 500 });
  }
}
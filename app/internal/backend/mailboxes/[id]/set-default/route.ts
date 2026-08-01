import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export async function POST(
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

    const now = new Date().toISOString();
    await client.query('UPDATE mailboxes SET is_default_sender = FALSE');
    await client.query(
      `UPDATE mailboxes SET is_default_sender = TRUE, updated_at = $1 WHERE id = $2`,
      [now, id]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['mailbox_set_default', `Mailbox ${result.rows[0].email_address} set as default sender`, now]
    );

    client.release();
    client = null;

    return NextResponse.json({ success: true, message: 'Default sender updated.' });

  } catch (error: any) {
    console.error('Mailbox set default error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to set default mailbox.' }
    }, { status: 500 });
  }
}
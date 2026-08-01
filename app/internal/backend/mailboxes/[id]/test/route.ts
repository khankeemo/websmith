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

    const mailbox = result.rows[0];
    const now = new Date().toISOString();

    let imapConnected = false;
    let smtpConnected = false;
    let imapError = '';
    let smtpError = '';

    // Test IMAP connection
    try {
      const Imap = (await import('imap')).default;
      const imap = new Imap({
        host: mailbox.imap_host,
        port: mailbox.imap_port,
        tls: mailbox.imap_secure,
        tlsOptions: { rejectUnauthorized: false },
        user: mailbox.imap_username,
        password: mailbox.imap_password,
        connTimeout: 10000,
        authTimeout: 10000,
      });

      await new Promise<void>((resolve, reject) => {
        imap.once('ready', () => {
          imapConnected = true;
          imap.end();
          resolve();
        });
        imap.once('error', (err: Error) => {
          imapError = err.message;
          reject(err);
        });
        imap.connect();
      });
    } catch (err: any) {
      imapError = err?.message || 'IMAP connection failed';
    }

    // Test SMTP connection
    try {
      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({
        host: mailbox.smtp_host,
        port: mailbox.smtp_port,
        secure: mailbox.smtp_secure,
        auth: {
          user: mailbox.smtp_username,
          pass: mailbox.smtp_password,
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });

      await transporter.verify();
      smtpConnected = true;
    } catch (err: any) {
      smtpError = err?.message || 'SMTP connection failed';
    }

    const connectionStatus = (imapConnected && smtpConnected) ? 'connected' : 'failed';
    const lastError = [imapError, smtpError].filter(Boolean).join('; ') || '';

    await client.query(
      `UPDATE mailboxes SET connection_status = $1, last_error = $2, updated_at = $3 WHERE id = $4`,
      [connectionStatus, lastError, now, id]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['mailbox_test_connection', `Connection test for ${mailbox.email_address}: IMAP=${imapConnected ? 'ok' : 'fail'}, SMTP=${smtpConnected ? 'ok' : 'fail'}`, now]
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: {
        imap: { connected: imapConnected, error: imapError },
        smtp: { connected: smtpConnected, error: smtpError },
        overall: connectionStatus,
      }
    });

  } catch (error: any) {
    console.error('Mailbox test connection error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to test connection.' }
    }, { status: 500 });
  }
}
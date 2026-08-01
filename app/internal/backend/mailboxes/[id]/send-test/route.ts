import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    const body = await request.json();
    const { to_email } = body;

    if (!to_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'A valid recipient email is required.' }
      }, { status: 400 });
    }

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
      });

      const testSubject = `Test Email from ${mailbox.display_name || mailbox.email_address}`;
      const testMessage = `This is a test email sent from the Websmith Communication Center.\n\nMailbox: ${mailbox.email_address}\nProvider: ${mailbox.provider}\nTime: ${new Date().toLocaleString()}\n\nIf you received this email, your mailbox configuration is working correctly.`;

      await transporter.sendMail({
        from: `"${mailbox.display_name || 'Websmith'}" <${mailbox.email_address}>`,
        to: to_email,
        subject: testSubject,
        text: testMessage,
      });

      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp)
         VALUES ($1, $2, $3)`,
        ['mailbox_test_email', `Test email sent from ${mailbox.email_address} to ${to_email}`, now]
      );

      client.release();
      client = null;

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully.'
      });

    } catch (sendError: any) {
      console.error('Test email send error:', sendError);

      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp)
         VALUES ($1, $2, $3)`,
        ['mailbox_test_email_failed', `Test email from ${mailbox.email_address} to ${to_email} failed: ${sendError?.message || 'Unknown error'}`, now]
      );

      client.release();
      client = null;

      return NextResponse.json({
        success: false,
        error: { code: 'SEND_FAILED', message: sendError?.message || 'Failed to send test email.' }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Mailbox test email error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send test email.' }
    }, { status: 500 });
  }
}
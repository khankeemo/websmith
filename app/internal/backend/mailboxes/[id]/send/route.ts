// FILE: app/internal/backend/mailboxes/[id]/send/route.ts
// PURPOSE: Send an email through a mailbox's SMTP server (nodemailer).
//          On delivery failure the email is queued in message_queue for retry
//          by POST /internal/backend/communications/queue/process.
// ACCESS: Internal admin (proxy auth headers)

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

const TYPE_CATEGORY: Record<string, string> = {
  admin_notification: 'sales',
  welcome_customer: 'sales',
  new_sales_enquiry: 'sales',
  payment_success: 'sales',
  license_created: 'sales',
  sdk_generated: 'sales',
  support_reply: 'support',
  conversation_created: 'support',
  activation_success: 'support',
  activation_failed: 'support',
  license_renewed: 'support',
  license_expired: 'support',
  reactivation_approved: 'support',
  reactivation_rejected: 'support',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const userEmail = request.headers.get("x-api-center-user-email") || "";
    if (!userEmail) {
      return NextResponse.json({ success: false, error: "Unauthorized - Please login" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const toEmail = String(body.to_email || "").trim().toLowerCase();
    const toName = String(body.to_name || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const emailType = String(body.email_type || "admin_notification").trim();
    const licenseKey = String(body.license_key || "").trim();
    const productId = String(body.product_id || "").trim();

    if (!toEmail) {
      return NextResponse.json({ success: false, error: "Recipient email is required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return NextResponse.json({ success: false, error: "A valid recipient email is required" }, { status: 400 });
    }
    if (!subject && !message) {
      return NextResponse.json({ success: false, error: "Subject or message is required" }, { status: 400 });
    }

    client = await (await getDb()).connect();

    const mbResult = await client.query('SELECT * FROM mailboxes WHERE id = $1', [id]);
    if (mbResult.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({ success: false, error: "Mailbox not found" }, { status: 404 });
    }
    const mailbox = mbResult.rows[0];
    if (!mailbox.is_enabled) {
      client.release();
      client = null;
      return NextResponse.json({ success: false, error: "Mailbox is disabled" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const category = TYPE_CATEGORY[emailType] || 'sales';
    const fromLabel = mailbox.display_name ? `"${mailbox.display_name}" <${mailbox.email_address}>` : mailbox.email_address;
    const fullMessage = message + (mailbox.signature ? `\n\n${mailbox.signature}` : "");
    const htmlBody = `<p>${fullMessage.replace(/\n/g, '<br/>')}</p>`;

    // Ensure a conversation thread exists so queue retries and logs can attach to it
    const convRes = await client.query(
      `SELECT id FROM communication_conversations
       WHERE customer_email = $1 AND category = $2 AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [toEmail, category]
    );
    let conversationId = convRes.rows[0]?.id || null;
    if (!conversationId) {
      conversationId = `CONV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await client.query(
        `INSERT INTO communication_conversations
         (id, category, status, customer_email, customer_name, subject, product_id, license_key, created_at, updated_at)
         VALUES ($1,$2,'open',$3,$4,$5,$6,$7,$8,$8)`,
        [conversationId, category, toEmail, toName || '', subject, productId || '', licenseKey || '', now]
      );
    } else {
      await client.query(
        `UPDATE communication_conversations SET updated_at = $2, license_key = COALESCE(NULLIF($3,''), license_key) WHERE id = $1`,
        [conversationId, now, licenseKey || '']
      );
    }

    let delivered = false;
    let messageId = '';
    let smtpError = '';

    try {
      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({
        host: mailbox.smtp_host,
        port: mailbox.smtp_port,
        secure: mailbox.smtp_secure,
        auth: { user: mailbox.smtp_username, pass: mailbox.smtp_password },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 30000,
      });
      const info = await transporter.sendMail({
        from: fromLabel,
        to: toName ? `"${toName}" <${toEmail}>` : toEmail,
        subject,
        text: fullMessage,
        html: htmlBody,
      });
      delivered = true;
      messageId = String(info.messageId || '');
    } catch (err: any) {
      smtpError = err?.message || 'SMTP send failed';
    }

    if (delivered) {
      // Notification log
      await client.query(
        `INSERT INTO notification_logs (event_type, channel, recipient, subject, status, response, error, license_key, created_at)
         VALUES ($1,'smtp',$2,$3,'sent',$4,NULL,$5,$6)`,
        [emailType, toEmail, subject, messageId || null, licenseKey || null, now]
      );

      // Conversation message (sent)
      await client.query(
        `INSERT INTO conversation_messages
         (conversation_id, sender_type, sender_name, sender_email, message, is_internal, email_sent, created_at)
         VALUES ($1,'admin',$2,$3,$4,FALSE,TRUE,$5)`,
        [conversationId, userEmail, userEmail, message, now]
      );

      // Audit
      try {
        await client.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, license_key)
           VALUES ($1,$2,$3,$4)`,
          [
            'email_sent',
            `Email "${subject}" (${emailType}) sent to ${toEmail} via SMTP (${mailbox.email_address}) by ${userEmail}`,
            now,
            licenseKey || null,
          ]
        );
      } catch (e) {
        console.error('email audit failed:', e);
      }

      client.release();
      client = null;

      return NextResponse.json({
        success: true,
        delivered: true,
        queued: false,
        message_id: messageId,
        message: "Email sent successfully",
        conversation_id: conversationId,
      });
    }

    // Delivery failed → queue for retry (real retry logic in queue/process)
    const maxRetries = 5;
    await client.query(
      `INSERT INTO message_queue
       (conversation_id, category, customer_email, customer_name, subject, message, status, retry_count, max_retries, last_error, next_retry_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',0,$7,$8,$9,$10,$10)`,
      [conversationId, category, toEmail, toName || '', subject, message, maxRetries, smtpError, now]
    );

    try {
      await client.query(
        `UPDATE mailboxes SET last_failure = $2, last_error = $3, updated_at = $4 WHERE id = $1`,
        [id, now, smtpError, now]
      );
    } catch (e) {
      console.error('mailbox failure marker failed:', e);
    }

    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, license_key)
         VALUES ($1,$2,$3,$4)`,
        [
          'email_queued',
          `Email "${subject}" to ${toEmail} queued for retry (SMTP error: ${smtpError}) by ${userEmail}`,
          now,
          licenseKey || null,
        ]
      );
    } catch (e) {
      console.error('email audit failed:', e);
    }

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      delivered: false,
      queued: true,
      error: smtpError,
      message: "SMTP delivery failed — email queued for automatic retry",
      conversation_id: conversationId,
    });
  } catch (error: any) {
    console.error('Mailbox send error:', error);
    if (client) { client.release(); }
    return NextResponse.json({ success: false, error: "Failed to send email. Please try again." }, { status: 500 });
  }
}

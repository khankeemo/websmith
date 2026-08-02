// FILE: app/internal/backend/communications/queue/process/route.ts
// PURPOSE: Process the message_queue — deliver due emails through the default
//          sender mailbox's SMTP server (nodemailer) with exponential backoff.
//          Called by the Communication Center client periodically (no cron on
//          serverless) and manually via the "Process Queue" button.
// ACCESS: Internal admin (proxy auth headers)

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

const BATCH_SIZE = 20;

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const userEmail = request.headers.get("x-api-center-user-email") || "";
    if (!userEmail) {
      return NextResponse.json({ success: false, error: "Unauthorized - Please login" }, { status: 401 });
    }

    client = await (await getDb()).connect();

    const mbResult = await client.query(
      `SELECT * FROM mailboxes WHERE is_default_sender = TRUE AND is_enabled = TRUE LIMIT 1`
    );
    const mailbox = mbResult.rows[0] || null;

    const due = await client.query(
      `SELECT * FROM message_queue
       WHERE status IN ('pending','sending')
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [BATCH_SIZE]
    );

    let delivered = 0;
    let failed = 0;
    const results: { id: number; status: string; last_error: string | null }[] = [];

    for (const item of due.rows) {
      const nextRetryCount = (item.retry_count || 0) + 1;

      if (!mailbox) {
        // No SMTP mailbox configured — cannot deliver; keep in queue until one exists
        const maxReached = nextRetryCount >= (item.max_retries || 5);
        await client.query(
          `UPDATE message_queue SET status = $2, retry_count = $3, last_error = $4, updated_at = NOW()
           WHERE id = $1`,
          [
            item.id,
            maxReached ? 'failed' : 'pending',
            nextRetryCount,
            'No SMTP mailbox configured — set a default sender mailbox first',
          ]
        );
        failed += 1;
        results.push({ id: item.id, status: maxReached ? 'failed' : 'pending', last_error: 'No SMTP mailbox configured' });
        continue;
      }

      const now = new Date().toISOString();
      const fromLabel = mailbox.display_name ? `"${mailbox.display_name}" <${mailbox.email_address}>` : mailbox.email_address;
      const fullMessage = item.message + (mailbox.signature ? `\n\n${mailbox.signature}` : "");

      let ok = false;
      let sendError = '';
      let messageId = '';
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
          to: item.customer_name ? `"${item.customer_name}" <${item.customer_email}>` : item.customer_email,
          subject: item.subject || '(No Subject)',
          text: fullMessage,
          html: `<p>${fullMessage.replace(/\n/g, '<br/>')}</p>`,
        });
        ok = true;
        messageId = String(info.messageId || '');
      } catch (err: any) {
        sendError = err?.message || 'SMTP send failed';
      }

      if (ok) {
        delivered += 1;
        await client.query(
          `UPDATE message_queue SET status = 'sent', retry_count = $2, last_error = NULL, sent_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [item.id, nextRetryCount]
        );

        try {
          await client.query(
            `INSERT INTO notification_logs (event_type, channel, recipient, subject, status, response, error, license_key, created_at)
             VALUES ($1,'smtp',$2,$3,'sent',$4,NULL,$5,$6)`,
            [item.category, item.customer_email, item.subject || '(No Subject)', messageId || null, null, now]
          );
        } catch (logError) {
          console.error('queue notification log failed:', logError);
        }

        try {
          await client.query(
            `INSERT INTO conversation_messages
             (conversation_id, sender_type, sender_name, sender_email, message, is_internal, email_sent, created_at)
             VALUES ($1,'admin',$2,$3,$4,FALSE,TRUE,$5)`,
            [item.conversation_id, userEmail, userEmail, item.message, now]
          );
        } catch (msgError) {
          console.error('queue conversation message insert failed:', msgError);
        }

        try {
          await client.query(
            `INSERT INTO audit_logs (event_type, message, timestamp, license_key)
             VALUES ($1,$2,$3,$4)`,
            [
              'email_sent',
              `Queued email "${item.subject || '(No Subject)'}" delivered to ${item.customer_email} via SMTP (${mailbox.email_address})`,
              now,
              null,
            ]
          );
        } catch (auditError) {
          console.error('queue audit failed:', auditError);
        }

        results.push({ id: item.id, status: 'sent', last_error: null });
      } else {
        failed += 1;
        const maxReached = nextRetryCount >= (item.max_retries || 5);
        const backoffMinutes = Math.min(60, Math.pow(2, Math.max(0, nextRetryCount - 1))); // 1,2,4,8... capped 60min
        await client.query(
          `UPDATE message_queue SET status = $2, retry_count = $3, last_error = $4,
             next_retry_at = NOW() + make_interval(mins => $5), updated_at = NOW()
           WHERE id = $1`,
          [item.id, maxReached ? 'failed' : 'pending', nextRetryCount, sendError, backoffMinutes]
        );
        results.push({ id: item.id, status: maxReached ? 'failed' : 'pending', last_error: sendError });
      }
    }

    if (mailbox && (due.rows.length > 0 || delivered > 0)) {
      try {
        await client.query(
          `UPDATE mailboxes SET queue_size = (SELECT COUNT(*) FROM message_queue WHERE status IN ('pending','sending')), updated_at = NOW() WHERE id = $1`,
          [mailbox.id]
        );
      } catch (queueSizeError) {
        console.warn('queue_size update failed:', queueSizeError.message);
      }
    }

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      processed: due.rows.length,
      delivered,
      failed,
      no_mailbox: !mailbox,
      results,
    });
  } catch (error: any) {
    console.error('Queue process error:', error);
    if (client) { client.release(); }
    return NextResponse.json({ success: false, error: "Failed to process queue." }, { status: 500 });
  }
}

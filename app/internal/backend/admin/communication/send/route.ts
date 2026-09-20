// FILE: app/internal/backend/admin/communication/send/route.ts
// PURPOSE: Universal email send — the ONE endpoint behind every email dialog
//          (sales, support, SDK, license, renewal, payment). Supports:
//          - custom subject/message (template optional)
//          - multiple file attachments (multipart) + SDK zip attachment
//          - attachment metadata stored in email_attachments
//          - communication-center conversation log
//          - audit log
// ACCESS: Internal admin (proxy auth headers)

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { sendEmail } from "@/lib/email/mailer";
import {
  linkConversationAttachments,
  linkEmailAttachments,
  storeUploadedFiles,
  toMailAttachments,
  toNodemailerAttachments,
  validateAttachmentFiles,
} from "@/lib/communications/attachments";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// email_type → communication category + sender routing
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

async function findLatestSdkJob(client: any, productId?: string, jobId?: string) {
  if (jobId) {
    const r = await client.query(
      `SELECT job_id, filename, product_name, result FROM sdk_jobs WHERE job_id = $1 AND status = 'completed'`,
      [jobId]
    );
    return r.rows[0] || null;
  }
  if (!productId) return null;
  const r = await client.query(
    `SELECT job_id, filename, product_name, result FROM sdk_jobs
     WHERE status = 'completed' AND payload->>'productId' = $1
     ORDER BY created_at DESC LIMIT 1`,
    [productId]
  );
  return r.rows[0] || null;
}

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const userEmail = request.headers.get("x-api-center-user-email") || "";
    if (!userEmail) {
      return NextResponse.json({ success: false, error: "Unauthorized - Please login" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    let body: Record<string, any> = {};
    const files: File[] = [];
    if (isMultipart) {
      const formData = await request.formData();
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          files.push(value);
        } else {
          body[key] = value;
        }
      }
    } else {
      body = await request.json().catch(() => ({}));
    }

    const toEmail = String(body.to_email || "").trim().toLowerCase();
    const toName = String(body.to_name || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const emailType = String(body.email_type || "admin_notification").trim();
    const licenseKey = String(body.license_key || "").trim();
    const productId = String(body.product_id || "").trim();
    const attachSdk = body.attach_sdk === true || body.attach_sdk === "true";
    const sdkJobId = String(body.sdk_job_id || "").trim();
    // Optional sender override from the compose From dropdown (account ID based).
    const fromEmail = String(body.from_email || "").trim();
    const fromName = String(body.from_name || "").trim();
    const fromMailboxId = String(body.from_mailbox_id || "").trim();
    // Optional CC/BCC recipients (comma or semicolon separated).
    const splitEmails = (raw: string): string[] =>
      String(raw || "").split(/[,;]/).map(e => e.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const ccList = splitEmails(body.cc);
    const bccList = splitEmails(body.bcc);

    if (!toEmail) {
      return NextResponse.json({ success: false, error: "Recipient email is required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return NextResponse.json({ success: false, error: "A valid recipient email is required" }, { status: 400 });
    }
    if (!subject && !message) {
      return NextResponse.json({ success: false, error: "Subject or message is required" }, { status: 400 });
    }

    const fileValidation = validateAttachmentFiles(files);
    if (!fileValidation.ok) {
      return NextResponse.json({ success: false, error: fileValidation.error }, { status: 400 });
    }

    // Uploaded files flow through the universal attachment service: validated,
    // stored (best-effort disk + durable DB bytes), and shaped for the email
    // providers below.
    const storedFiles = isMultipart ? await storeUploadedFiles(files) : [];
    const attachments = toMailAttachments(storedFiles);

    client = await pool.connect();

    // SDK zip attachment (fetched from stored job — not re-uploaded)
    let sdkJob = null;
    if (attachSdk || sdkJobId) {
      sdkJob = await findLatestSdkJob(client, productId, sdkJobId);
      if (sdkJob) {
        const zipData = sdkJob.result?.zipData || sdkJob.result?.zip_path || null;
        if (zipData) {
          const fileName = sdkJob.filename || `WSD_SDKToolkit_${sdkJob.product_name || 'Product'}.zip`;
          const buffer = Buffer.isBuffer(zipData) ? zipData : Buffer.from(String(zipData), 'base64');
          attachments.push({ filename: fileName, content: buffer, contentType: 'application/zip' });
        }
      }
    }

    const htmlMessage = `<p>${(message || '').replace(/\n/g, '<br/>')}</p>`;
    const now = new Date().toISOString();
    const category = TYPE_CATEGORY[emailType] || 'sales';

    // nodemailer payload for the mailbox-SMTP path (uploaded files + SDK zip).
    const nodemailerAttachments = attachments;

    // ---- Mailbox sender: send via the mailbox's SMTP (reuses the exact
    // nodemailer pattern from /mailboxes/[id]/send) so the email leaves FROM
    // the selected external mailbox account.
    if (fromMailboxId) {
      const mbResult = await client.query('SELECT * FROM mailboxes WHERE id = $1', [fromMailboxId]);
      if (mbResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Mailbox not found" }, { status: 404 });
      }
      const mailbox = mbResult.rows[0];
      if (!mailbox.is_enabled) {
        return NextResponse.json({ success: false, error: "Mailbox is disabled" }, { status: 400 });
      }

      const fromLabel = mailbox.display_name ? `"${mailbox.display_name}" <${mailbox.email_address}>` : mailbox.email_address;
      const fullMessage = message + (mailbox.signature ? `\n\n${mailbox.signature}` : "");

      // Ensure a conversation thread exists (same shape as /mailboxes/[id]/send)
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
      let smtpError = '';
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
          to: toName ? `"${toName}" <${toEmail}>` : toEmail,
          ...(ccList.length > 0 ? { cc: ccList } : {}),
          ...(bccList.length > 0 ? { bcc: bccList } : {}),
          subject,
          text: fullMessage,
          html: `<p>${fullMessage.replace(/\n/g, '<br/>')}</p>`,
          ...(nodemailerAttachments.length > 0
            ? { attachments: nodemailerAttachments }
            : {}),
        });
        delivered = true;
        messageId = String(info.messageId || '');
      } catch (err: any) {
        smtpError = err?.message || 'SMTP send failed';
      }

      if (!delivered) {
        // Queue for retry (same pattern as /mailboxes/[id]/send)
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
            [fromMailboxId, now, smtpError, now]
          );
        } catch (e) {
          console.error('mailbox failure marker failed:', e);
        }
        try {
          await client.query(
            `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
             VALUES ($1,$2,CURRENT_TIMESTAMP,$3,$4)`,
            ['email_queued', `Email "${subject}" to ${toEmail} queued for retry (SMTP error: ${smtpError}) by ${userEmail}`, request.headers.get("x-forwarded-for") || "unknown", licenseKey || null]
          );
        } catch (e) {
          console.error('email audit failed:', e);
        }
        return NextResponse.json({
          success: true,
          delivered: false,
          queued: true,
          error: smtpError,
          message: "SMTP delivery failed — email queued for automatic retry",
          conversation_id: conversationId,
        });
      }

      // Delivered via mailbox SMTP
      await client.query(
        `INSERT INTO notification_logs (event_type, channel, recipient, subject, status, response, error, license_key, created_at)
         VALUES ($1,'smtp',$2,$3,'sent',$4,NULL,$5,$6)`,
        [emailType, toEmail, subject, messageId || null, licenseKey || null, now]
      );
      const logRes = await client.query(
        `SELECT id FROM notification_logs WHERE recipient = $1 AND event_type = $2 ORDER BY id DESC LIMIT 1`,
        [toEmail, emailType]
      );
      const notificationLogId = logRes.rows[0]?.id || null;

      await linkEmailAttachments(client, notificationLogId, emailType, toEmail, licenseKey || null, storedFiles);
      if (sdkJob && sdkJob.result?.zipData) {
        await client.query(
          `INSERT INTO email_attachments (notification_log_id, email_type, recipient, license_key, file_name, file_size, mime_type, storage_path)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            notificationLogId, emailType, toEmail, licenseKey || null,
            sdkJob.filename || `SDK-${sdkJob.job_id}.zip`,
            Buffer.from(String(sdkJob.result.zipData), 'base64').length,
            'application/zip',
            `sdk_jobs:${sdkJob.job_id}`,
          ]
        );
      }

      const convMsgRes = await client.query(
        `INSERT INTO conversation_messages
         (conversation_id, sender_type, sender_name, sender_email, message, is_internal, email_sent, created_at)
         VALUES ($1,'admin',$2,$3,$4,FALSE,TRUE,$5) RETURNING id`,
        [conversationId, mailbox.display_name || mailbox.email_address, mailbox.email_address, message, now]
      );
      const convMsgId = convMsgRes.rows[0]?.id;

      // Link uploaded attachments to the conversation message (universal
      // service — durable DB bytes + best-effort disk) so the reader thread
      // shows + downloads them under this send.
      await linkConversationAttachments(client, convMsgId, storedFiles);

      try {
        await client.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
           VALUES ($1,$2,CURRENT_TIMESTAMP,$3,$4)`,
          [
            'email_sent',
            `Email "${subject}" (${emailType}) sent to ${toEmail}${attachments.length > 0 ? ` with ${attachments.length} attachment(s)` : ''} via SMTP (${mailbox.email_address}) by ${userEmail}`,
            request.headers.get("x-forwarded-for") || "unknown",
            licenseKey || null,
          ]
        );
      } catch (e) {
        console.error('email audit failed:', e);
      }

      return NextResponse.json({
        success: true,
        message: "Email sent successfully",
        message_id: messageId,
        conversation_id: conversationId,
        attachments_sent: attachments.length,
      });
    }

    // ---- System-account sender (default): Nodemailer SMTP with optional from override ----
    const sendResult = await sendEmail(
      client,
      emailType,
      { email: toEmail, name: toName || 'Valued Customer' },
      { license_key: licenseKey, product_id: productId, customer_email: toEmail, customer_name: toName },
      {
        custom: { subject, html: htmlMessage, plainText: message },
        attachments,
        from: fromEmail ? { email: fromEmail, name: fromName || undefined } : null,
        ...(ccList.length > 0 ? { cc: ccList.map(e => ({ email: e })) } : {}),
        ...(bccList.length > 0 ? { bcc: bccList.map(e => ({ email: e })) } : {}),
      }
    );

    if (!sendResult.success) {
      return NextResponse.json({
        success: false,
        error: sendResult.error || 'Failed to send email',
      }, { status: 500 });
    }

    // Link attachment metadata to the notification log
    const logRes = await client.query(
      `SELECT id FROM notification_logs WHERE recipient = $1 AND event_type = $2 ORDER BY id DESC LIMIT 1`,
      [toEmail, emailType]
    );
    const notificationLogId = logRes.rows[0]?.id || null;

    await linkEmailAttachments(client, notificationLogId, emailType, toEmail, licenseKey || null, storedFiles);
    if (sdkJob && sdkJob.result?.zipData) {
      await client.query(
        `INSERT INTO email_attachments (notification_log_id, email_type, recipient, license_key, file_name, file_size, mime_type, storage_path)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          notificationLogId, emailType, toEmail, licenseKey || null,
          sdkJob.filename || `SDK-${sdkJob.job_id}.zip`,
          Buffer.from(String(sdkJob.result.zipData), 'base64').length,
          'application/zip',
          `sdk_jobs:${sdkJob.job_id}`,
        ]
      );
    }

    // Communication center log — one conversation thread per customer
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
    const convMsgRes = await client.query(
      `INSERT INTO conversation_messages
       (conversation_id, sender_type, sender_name, sender_email, message, is_internal, email_sent, created_at)
       VALUES ($1,'admin',$2,$3,$4,FALSE,TRUE,$5) RETURNING id`,
      [conversationId, userEmail, userEmail, message, now]
    );
    const convMsgId = convMsgRes.rows[0]?.id;

    // Link uploaded attachments to the conversation message (universal service)
    await linkConversationAttachments(client, convMsgId, storedFiles);

    // Audit log
    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1,$2,CURRENT_TIMESTAMP,$3,$4)`,
        [
          'email_sent',
          `Email "${subject}" (${emailType}) sent to ${toEmail}${attachments.length > 0 ? ` with ${attachments.length} attachment(s)` : ''} by ${userEmail}`,
          request.headers.get("x-forwarded-for") || "unknown",
          licenseKey || null,
        ]
      );
    } catch (e) {
      console.error('email audit failed:', e);
    }

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      message_id: sendResult.messageId,
      conversation_id: conversationId,
      attachments_sent: attachments.length,
    });
  } catch (error: any) {
    console.error("Universal email send error:", error);
    return NextResponse.json({ success: false, error: "Failed to send email. Please try again." }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

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
import fs from "fs";
import path from "path";
import { sendEmail } from "@/lib/email/brevo";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const ALLOWED_MIME_TYPES = [
  'text/plain', 'text/csv', 'text/html', 'text/xml',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/json', 'application/pdf',
  'application/zip', 'application/x-zip-compressed',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

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

    if (!toEmail) {
      return NextResponse.json({ success: false, error: "Recipient email is required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return NextResponse.json({ success: false, error: "A valid recipient email is required" }, { status: 400 });
    }
    if (!subject && !message) {
      return NextResponse.json({ success: false, error: "Subject or message is required" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ success: false, error: `Maximum ${MAX_FILES} attachments allowed` }, { status: 400 });
    }

    const attachments: { name: string; content: string; type?: string }[] = [];
    const storedFiles: { fileName: string; fileSize: number; mimeType: string; storagePath: string }[] = [];

    // Uploaded files
    if (isMultipart) {
      const storagePath = process.env.ATTACHMENT_STORAGE_PATH || path.join(process.cwd(), 'public', 'attachments', 'email');
      fs.mkdirSync(storagePath, { recursive: true });
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ success: false, error: `File "${file.name}" exceeds the 10MB limit` }, { status: 400 });
        }
        const mimeType = file.type || 'application/octet-stream';
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
          return NextResponse.json({ success: false, error: `File type "${mimeType}" for "${file.name}" is not supported` }, { status: 400 });
        }
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${sanitizedName}`;
        const filePath = path.join(storagePath, uniqueName);
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, buffer);
        attachments.push({ name: sanitizedName, content: buffer.toString('base64'), type: mimeType });
        storedFiles.push({ fileName: sanitizedName, fileSize: file.size, mimeType, storagePath: filePath });
      }
    }

    client = await pool.connect();

    // SDK zip attachment (fetched from stored job — not re-uploaded)
    let sdkJob = null;
    if (attachSdk || sdkJobId) {
      sdkJob = await findLatestSdkJob(client, productId, sdkJobId);
      if (sdkJob) {
        const zipData = sdkJob.result?.zipData || sdkJob.result?.zip_path || null;
        if (zipData) {
          const fileName = sdkJob.filename || `WSD_SDKToolkit_${sdkJob.product_name || 'Product'}.zip`;
          attachments.push({ name: fileName, content: String(zipData), type: 'application/zip' });
        }
      }
    }

    const htmlMessage = `<p>${(message || '').replace(/\n/g, '<br/>')}</p>`;
    const sendResult = await sendEmail(
      client,
      emailType,
      { email: toEmail, name: toName || 'Valued Customer' },
      { license_key: licenseKey, product_id: productId, customer_email: toEmail, customer_name: toName },
      { custom: { subject, html: htmlMessage, plainText: message }, attachments }
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

    for (const sf of storedFiles) {
      await client.query(
        `INSERT INTO email_attachments (notification_log_id, email_type, recipient, license_key, file_name, file_size, mime_type, storage_path)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [notificationLogId, emailType, toEmail, licenseKey || null, sf.fileName, sf.fileSize, sf.mimeType, sf.storagePath]
      );
    }
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
    const category = TYPE_CATEGORY[emailType] || 'sales';
    const now = new Date().toISOString();
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
    await client.query(
      `INSERT INTO conversation_messages
       (conversation_id, sender_type, sender_name, sender_email, message, is_internal, email_sent, created_at)
       VALUES ($1,'admin',$2,$3,$4,FALSE,TRUE,$5)`,
      [conversationId, userEmail, userEmail, message, now]
    );

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

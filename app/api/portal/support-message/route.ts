// FILE: app/api/portal/support-message/route.ts
// PURPOSE: Public customer-facing support message endpoint for the Universal
//          Email Center in customer mode — used by the Universal Buy & Renew
//          Portal (/internal/api/buy, /internal/api/renew) and the Software
//          Store Email Center (/software-store). The Email Center dialog posts
//          here so visitors WITHOUT an admin session can reach the sales and
//          support teams.
// ACCESS: Public (not gated by proxy.ts — the matcher only covers /internal).
//          The recipient is controlled SERVER-SIDE per action (sales requests
//          → sales@, all other customer requests → support@); the browser can
//          never supply an arbitrary address. Reuses the existing sendEmail +
//          communication_conversations infrastructure (same pattern as
//          /api/v1/communication/create and /internal/backend/store/enquiries).
// SECURITY: server-side validation (name/email/message) + per-IP throttle using
//          Redis-backed rate limiting for production reliability.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { sendEmail } from "@/lib/email/mailer";
import { redis } from "@/lib/redis-client";
import {
  linkConversationAttachments,
  linkEmailAttachments,
  storeUploadedFiles,
  toMailAttachments,
  validateAttachmentFiles,
} from "@/lib/communications/attachments";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const MAIL_SALES_ADDRESS = process.env.MAIL_SALES_ADDRESS || "sales@websmithdigital.com";
const MAIL_SUPPORT_ADDRESS = process.env.MAIL_SUPPORT_ADDRESS || "support@websmithdigital.com";

// Rate limits: 5 messages per 15 minutes per IP (Redis-backed for production)
const PORTAL_RATE_LIMIT = 5;
const PORTAL_RATE_WINDOW_SECONDS = 900;

async function isRateAllowed(ip: string): Promise<boolean> {
  try {
    const key = `portal_support:${ip}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, PORTAL_RATE_WINDOW_SECONDS);
    }
    return current <= PORTAL_RATE_LIMIT;
  } catch {
    // Fail open on Redis errors
    return true;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Recipient routing is fixed server-side — never taken from the browser.
// Buy / Renew / Software Store enquiries always go to the sales team; all
// other customer requests (Send Email, Activation, Reactivation, Device
// Replacement, Support, General) go to the support team.
const ACTION_ROUTES: Record<string, { recipient: string; category: string }> = {
  send: { recipient: MAIL_SUPPORT_ADDRESS, category: "support" },
  "buy-license": { recipient: MAIL_SALES_ADDRESS, category: "sales" },
  activate: { recipient: MAIL_SUPPORT_ADDRESS, category: "support" },
  renew: { recipient: MAIL_SALES_ADDRESS, category: "sales" },
  reactivation: { recipient: MAIL_SUPPORT_ADDRESS, category: "support" },
  "device-replacement": { recipient: MAIL_SUPPORT_ADDRESS, category: "support" },
  support: { recipient: MAIL_SUPPORT_ADDRESS, category: "support" },
  general: { recipient: MAIL_SUPPORT_ADDRESS, category: "support" },
  "software-store": { recipient: MAIL_SALES_ADDRESS, category: "sales" },
};
const VALID_ACTIONS = Object.keys(ACTION_ROUTES);

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                      request.headers.get("x-real-ip") || "unknown";

    if (!(await isRateAllowed(ipAddress))) {
      return NextResponse.json(
        { success: false, error: { message: "Too many messages. Please try again later." } },
        { status: 429 }
      );
    }

    let body: any = {};
    const files: File[] = [];
    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");
    try {
      if (isMultipart) {
        const formData = await request.formData();
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) files.push(value);
          else body[key] = value;
        }
      } else {
        body = await request.json();
      }
    } catch {
      return NextResponse.json(
        { success: false, error: { message: "Invalid request body" } },
        { status: 400 }
      );
    }

    // Uploaded files flow through the SAME universal attachment policy + service
    // as the admin composer (max 5 files / 10MB / extension allow-list), then
    // get attached to the outbound email and stored in the admin workflow.
    const fileValidation = validateAttachmentFiles(files);
    if (!fileValidation.ok) {
      return NextResponse.json(
        { success: false, error: { message: fileValidation.error } },
        { status: 400 }
      );
    }
    const storedFiles = isMultipart ? await storeUploadedFiles(files) : [];

    const action = String(body.action || "").trim();
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, error: { message: "Unsupported request type" } },
        { status: 400 }
      );
    }

    const customerName = String(body.customer_name || "").trim();
    const customerEmail = String(body.customer_email || "").trim().toLowerCase();
    const mobile = String(body.mobile || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const licenseKey = String(body.license_key || "").trim();

    if (!customerName) {
      return NextResponse.json({ success: false, error: { message: "Your name is required" } }, { status: 400 });
    }
    if (!customerEmail) {
      return NextResponse.json({ success: false, error: { message: "Your email is required" } }, { status: 400 });
    }
    if (!EMAIL_RE.test(customerEmail)) {
      return NextResponse.json({ success: false, error: { message: "Please enter a valid email address" } }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ success: false, error: { message: "A message is required" } }, { status: 400 });
    }
    if (subject.length > 300 || customerName.length > 200 || mobile.length > 40) {
      return NextResponse.json({ success: false, error: { message: "One or more fields are too long" } }, { status: 400 });
    }
    if (message.length > 20000) {
      return NextResponse.json({ success: false, error: { message: "Message is too long" } }, { status: 400 });
    }

    const route = ACTION_ROUTES[action];
    const now = new Date().toISOString();
    const conversationId = `CONV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    client = await pool.connect();

    await client.query(
      `INSERT INTO communication_conversations
       (id, category, status, customer_email, customer_name, subject, license_key, created_at, updated_at)
       VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $7)`,
      [conversationId, route.category, customerEmail, customerName, subject || '', licenseKey || '', now]
    );

    const msgRes = await client.query(
      `INSERT INTO conversation_messages
       (conversation_id, sender_type, sender_name, sender_email, message, created_at)
       VALUES ($1, 'customer', $2, $3, $4, $5) RETURNING id`,
      [conversationId, customerName, customerEmail, message, now]
    );
    const conversationMessageId = msgRes.rows[0]?.id || null;

    // Link uploaded files to the customer conversation message (universal
    // attachment service — durable DB bytes + best-effort disk) so the admin
    // reader shows + downloads them alongside the message.
    if (conversationMessageId && storedFiles.length > 0) {
      await linkConversationAttachments(client, conversationMessageId, storedFiles);
    }

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)`,
      ['conversation_created', `Support message ${conversationId} created (${action}) by ${customerEmail}`, ipAddress, licenseKey || null]
    );

    client.release();
    client = null;

    let emailDelivered = true;
    const isSales = route.category === "sales";
    const emailType = isSales ? 'new_sales_enquiry' : 'admin_notification';
    const sendResult = await sendEmail(
      pool,
      emailType,
      { email: route.recipient, name: isSales ? 'Sales' : 'Support' },
      {
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: mobile || 'Not provided',
        product_name: action === 'renew' ? 'License renewal' : action === 'software-store' ? 'Software Store' : isSales ? 'License purchase' : 'Support request',
        plan_name: action === 'renew' ? 'Renewal' : action === 'software-store' ? 'Store enquiry' : isSales ? 'Purchase' : 'Support',
        enquiry_id: conversationId,
        message,
        subject,
        license_key: licenseKey,
      },
      {
        custom: {
          subject: subject || (isSales
            ? (action === 'renew' ? 'License Renewal Request' : action === 'software-store' ? 'Software Store Enquiry' : 'License Purchase Inquiry')
            : 'Support Request'),
          html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
          plainText: message,
        },
        attachments: toMailAttachments(storedFiles),
      }
    );

    if (!sendResult.success) {
      emailDelivered = false;
      console.error(`[Portal support-message] email delivery failed for ${conversationId}:`, sendResult.error);
    } else if (storedFiles.length > 0) {
      // Persist attachment metadata against the notification log row that
      // sendEmail recorded (same pattern as the admin send route), so the
      // attachments are retrievable/downloadable in the admin workflow.
      try {
        const linkClient = await pool.connect();
        try {
          const logRes = await linkClient.query(
            `SELECT id FROM notification_logs WHERE recipient = $1 AND event_type = $2 ORDER BY id DESC LIMIT 1`,
            [route.recipient, emailType]
          );
          const notificationLogId = logRes.rows[0]?.id || null;
          await linkEmailAttachments(
            linkClient,
            notificationLogId,
            emailType,
            route.recipient,
            licenseKey || null,
            storedFiles
          );
        } finally {
          linkClient.release();
        }
      } catch (linkErr) {
        console.error('[Portal support-message] attachment link failed:', linkErr);
      }
    }

    return NextResponse.json({ success: true, conversation_id: conversationId, emailDelivered });
  } catch (error: any) {
    console.error("Portal support-message error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: { message: "Failed to submit your message. Please try again." } },
      { status: 500 }
    );
  }
}
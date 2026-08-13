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
// SECURITY: server-side validation (name/email/message) + per-IP throttle.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { sendEmail } from "@/lib/email/brevo";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const MAIL_SALES_ADDRESS = process.env.MAIL_SALES_ADDRESS || "sales@websmithdigital.com";
const MAIL_SUPPORT_ADDRESS = process.env.MAIL_SUPPORT_ADDRESS || "support@websmithdigital.com";

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

// Lightweight in-memory per-IP throttle (best-effort; not shared across
// serverless instances — a reasonable guard for a public endpoint).
const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
const ipHits = new Map<string, { count: number; resetAt: number }>();

function isRateAllowed(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT.max;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const ipAddress = request.headers.get("x-forwarded-for") ||
                      request.headers.get("x-real-ip") || "unknown";
    if (!isRateAllowed(ipAddress)) {
      return NextResponse.json(
        { success: false, error: { message: "Too many messages. Please try again later." } },
        { status: 429 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { message: "Invalid request body" } },
        { status: 400 }
      );
    }

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

    await client.query(
      `INSERT INTO conversation_messages
       (conversation_id, sender_type, sender_name, sender_email, message, created_at)
       VALUES ($1, 'customer', $2, $3, $4, $5)`,
      [conversationId, customerName, customerEmail, message, now]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)`,
      ['conversation_created', `Support message ${conversationId} created (${action}) by ${customerEmail}`, ipAddress, licenseKey || null]
    );

    client.release();
    client = null;

    let emailDelivered = true;
    const isSales = route.category === "sales";
    const sendResult = await sendEmail(
      pool,
      isSales ? 'new_sales_enquiry' : 'admin_notification',
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
      }
    );

    if (!sendResult.success) {
      emailDelivered = false;
      console.error(`[Portal support-message] email delivery failed for ${conversationId}:`, sendResult.error);
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
import { apiHandler, jsonBody, json } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/brevo";
import { validatePhoneNumber } from "@/core/utils/phoneValidation";
import crypto from "node:crypto";

// Lightweight in-memory per-IP throttle (best-effort guard for a public
// endpoint; mirrors the pattern used by the public portal support-message
// route). Not shared across serverless instances — a reasonable rate cap,
// never a security boundary on its own.
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

// Strip control characters (except newlines kept for message/description) so
// stored records never carry raw control bytes from the public form.
const sanitize = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

export const POST = apiHandler(async ({ db, request }) => {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!isRateAllowed(ipAddress)) {
    return json({ success: false, error: "Too many messages. Please try again later.", message: "Too many messages. Please try again later." }, { status: 429 });
  }

  const body = await jsonBody(request);
  const subject = sanitize(String(body.subject ?? "")).trim();
  const message = sanitize(String(body.message ?? "")).trim();
  const contactName = sanitize(String(body.name ?? "")).trim();
  const contactEmail = sanitize(String(body.email ?? "")).trim().toLowerCase();
  const contactCompany = sanitize(String(body.company ?? "")).trim();
  const contactCallingPhone = sanitize(String(body.callingPhone ?? body.phone ?? body.mobile ?? "")).trim();
  const contactWhatsappPhone = sanitize(String(body.whatsappPhone ?? body.whatsapp ?? "")).trim();
  const preferredContactDate = sanitize(String(body.preferredContactDate ?? body.preferredDate ?? "")).trim();

  if (!subject || !message || !contactName || !contactEmail) {
    return json({ success: false, error: "Name, email, subject and message are required", message: "Name, email, subject and message are required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(contactEmail)) {
    return json({ success: false, error: "Please enter a valid email address", message: "Please enter a valid email address" }, { status: 400 });
  }
  if (
    contactName.length > 200 ||
    contactEmail.length > 200 ||
    contactCompany.length > 200 ||
    contactCallingPhone.length > 50 ||
    contactWhatsappPhone.length > 50 ||
    preferredContactDate.length > 50 ||
    subject.length > 300 ||
    message.length > 20000
  ) {
    return json({ success: false, error: "One or more fields are too long", message: "One or more fields are too long" }, { status: 400 });
  }

  // Server-side phone anti-spam & format validation
  if (contactCallingPhone) {
    const callCheck = validatePhoneNumber(contactCallingPhone);
    if (!callCheck.valid) {
      return json({ success: false, error: callCheck.error || "Invalid calling phone number", message: callCheck.error || "Invalid calling phone number" }, { status: 400 });
    }
  }
  if (contactWhatsappPhone) {
    const waCheck = validatePhoneNumber(contactWhatsappPhone);
    if (!waCheck.valid) {
      return json({ success: false, error: waCheck.error || "Invalid WhatsApp phone number", message: waCheck.error || "Invalid WhatsApp phone number" }, { status: 400 });
    }
  }

  const now = new Date();
  const ticket = {
    source: "public_contact",
    clientId: null,
    contactName,
    contactEmail,
    contactCompany,
    contactPhone: contactCallingPhone || contactWhatsappPhone || "",
    contactCallingPhone,
    contactWhatsappPhone,
    preferredContactDate,
    developerId: null,
    projectId: null,
    subject,
    description: message,
    priority: "medium",
    status: "open",
    chatStatus: "open",
    resolution: null,
    closedAt: null,
    attachments: [],
    // Canonical two-way conversation thread (Phase: Query Inbox — message
    // bubbles). The initial client message is seeded here; admin replies and
    // inbound email replies are appended by the respective routes. `history`
    // stays the audit log (Resend snapshots, status changes, etc.).
    messages: [
      {
        id: crypto.randomUUID(),
        senderType: "client",
        direction: "inbound",
        senderEmail: contactEmail,
        senderName: contactName,
        recipientEmail: "",
        message,
        createdAt: now,
        source: "public_contact",
      },
    ],
    lastClientReplyAt: now,
    adminReadAt: null,
    history: [{ action: "created", actorRole: "client", message: "Ticket created from public contact form", createdAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection("tickets").insertOne(ticket);

  // Send admin alert notification (asynchronous, non-blocking for response)
  try {
    const settingsDoc = await db.collection("settings").findOne({ key: "contact_info" });
    const settingsContact = settingsDoc?.value || {};
    const adminEmail =
      process.env.ADMIN_ALERT_EMAIL ||
      settingsContact.email ||
      settingsContact.sales_email ||
      process.env.SUPPORT_EMAIL ||
      process.env.MAIL_SUPPORT_ADDRESS ||
      "digitalwebsmith@gmail.com";

    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer") ||
      process.env.WEBSITE_URL ||
      "https://websmithdigital.com";
    const adminUrl = `${origin.replace(/\/+$/, "")}/admin/messages`;

    await sendEmail(
      db,
      "admin_notification",
      { email: adminEmail, name: "Administrator" },
      {
        customer_name: contactName,
        customer_email: contactEmail,
        calling_phone: contactCallingPhone,
        whatsapp_phone: contactWhatsappPhone,
        preferred_date: preferredContactDate,
        company: contactCompany,
        subject: `New Inquiry: ${subject}`,
        message: message,
        admin_url: adminUrl,
      }
    );
  } catch (emailErr) {
    console.error("[Tickets/Public] Failed to send admin alert email:", emailErr);
  }

  return json({ data: { ...ticket, _id: result.insertedId.toString() } }, { status: 201 });
});

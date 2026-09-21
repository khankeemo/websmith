import { apiHandler, jsonBody, json, ObjectId } from "@/lib/server/api";
import { createClientAccount, ensureResolutionTemplates, findDefaultTemplate, renderResolutionTemplate, renderCustomerMessagePlain, resolutionHtmlBody, stripAdminMarkers, generateUniqueRequestId, ticketRequestLabel, FIRST_WELCOME_TEMPLATE_KEY, sendWelcomeEmail } from "@/lib/tickets/email";

import { buildChatUrl } from "@/lib/tickets/chat";
import { sendEmail } from "@/lib/email/mailer";
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

export const POST = apiHandler(async ({ db, client, request }) => {
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
  const preferredContactTime = sanitize(String(body.preferredContactTime ?? body.preferredTime ?? body.preferredSlot ?? "")).trim();
  const timeZone = sanitize(String(body.timeZone ?? body.timezone ?? body.clientTimeZone ?? "")).trim();
  const adminCallTimeIST = sanitize(String(body.adminCallTimeIST ?? "")).trim();

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
    preferredContactDate.length > 250 ||
    preferredContactTime.length > 100 ||
    timeZone.length > 100 ||
    adminCallTimeIST.length > 150 ||
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

  // Phase 3 — Client Onboarding: a successful Get in Touch submission
  // immediately creates (or reuses) the client account so it shows up in
  // Client Onboarding right away with its Client ID and temporary password —
  // WITHOUT sending any email and WITHOUT exposing the temporary password to
  // the public caller. The email is only sent when an admin explicitly clicks
  // "Send Credentials" in the Query Inbox.
  const existingAccount = await db.collection("users").findOne({ email: contactEmail, role: "client" });
  const account = existingAccount ?? (await createClientAccount(db, { name: contactName, email: contactEmail }));
  const clientAccountCreated = !existingAccount;

  // Customer-facing request reference (WSD-XXXXXX) — generated once, stored on
  // the ticket, and used in every customer-facing email instead of the internal
  // MongoDB ObjectId.
  const requestId = await generateUniqueRequestId(db);
  const source = body.source ? sanitize(String(body.source)).trim() : "public_contact";

  const budgetNum = body.budget != null && body.budget !== "" ? Number(body.budget) : null;
  const timelineVal = body.timeline ? sanitize(String(body.timeline)) : null;
  const servicesList = Array.isArray(body.services) ? body.services.map(String).filter(Boolean) : [];
  const cmsReqVal = body.cmsRequirement ? sanitize(String(body.cmsRequirement)) : null;
  const platformVal = body.appPlatform ? sanitize(String(body.appPlatform)) : null;

  const hasScoping = servicesList.length > 0 || budgetNum != null || !!timelineVal || !!cmsReqVal || !!platformVal;

  let formattedDescription = message;
  if (hasScoping || source === "lead_funnel") {
    const scopingLines = [
      servicesList.length > 0 ? `Selected Services: ${servicesList.join(", ")}` : null,
      budgetNum != null ? `Estimated Budget: $${budgetNum.toLocaleString()}` : null,
      timelineVal ? `Target Timeline: ${timelineVal}` : null,
      platformVal ? `Preferred Platform: ${platformVal}` : null,
      cmsReqVal ? `CMS Requirement: ${cmsReqVal}` : null,
      message ? `Project Notes & Message:\n${message}` : null,
    ].filter(Boolean);
    if (scopingLines.length > 0) {
      formattedDescription = scopingLines.join("\n\n");
    }
  }

  const ticket = {
    source,
    requestId,
    clientId: account._id.toString(),
    clientCustomId: String(account.customId ?? ""),
    clientAccountSource: clientAccountCreated ? "created" : "existing",
    clientAccountEmail: contactEmail,
    contactName,
    contactEmail,
    contactCompany,
    contactPhone: contactCallingPhone || contactWhatsappPhone || "",
    contactCallingPhone,
    contactWhatsappPhone,
    preferredContactDate,
    preferredContactTime,
    timeZone,
    clientTimeZone: timeZone,
    adminCallTimeIST,
    budget: budgetNum,
    timeline: timelineVal,
    services: servicesList,
    cmsRequirement: cmsReqVal,
    appPlatform: platformVal,
    developerId: null,
    projectId: null,
    subject,
    description: formattedDescription,
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
        message: formattedDescription,
        createdAt: now,
        source,
      },
    ],
    lastClientReplyAt: now,
    adminReadAt: null,
    history: [{ action: "created", actorRole: "client", message: `Ticket created from ${source}`, createdAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection("tickets").insertOne(ticket);
  const ticketId = result.insertedId.toString();

  // If this ticket is from lead funnel or carries scoping data, also record in leads collection
  if (source === "lead_funnel" || hasScoping) {
    try {
      await db.collection("leads").insertOne({
        ticketId,
        requestId,
        name: contactName,
        email: contactEmail,
        callingPhone: contactCallingPhone,
        whatsappPhone: contactWhatsappPhone,
        phone: contactCallingPhone || contactWhatsappPhone || "",
        company: contactCompany,
        budget: budgetNum,
        timeline: timelineVal,
        services: servicesList,
        cmsRequirement: cmsReqVal,
        appPlatform: platformVal,
        preferredContactDate,
        preferredContactTime,
        timeZone,
        adminCallTimeIST,
        notes: message,
        status: "new",
        createdAt: now,
      });
    } catch (leadErr) {
      console.error("[Tickets/Public] Failed to insert lead record:", leadErr);
    }
  }


  // Send admin alert notification (asynchronous, non-blocking for response)
  try {
    const settingsDoc = await db.collection("settings").findOne({ key: "contact_info" });
    const settingsContact = settingsDoc?.value || {};
    const adminEmail =
      process.env.ADMIN_ALERT_EMAIL ||
      "digitalwebsmith@gmail.com";

    const originHeader =
      request.headers.get("origin") ||
      request.headers.get("referer") ||
      process.env.WEBSITE_URL ||
      "https://websmithdigital.com";
    const adminUrl = `${originHeader.replace(/\/+$/, "")}/admin/messages`;

    await sendEmail(
      db,
      "admin_notification",
      { email: adminEmail, name: "Administrator" },
      {
        customer_name: contactName,
        customer_email: contactEmail,
        calling_phone: contactCallingPhone,
        whatsapp_phone: contactWhatsappPhone,
        timezone: timeZone,
        client_timezone: timeZone,
        preferred_date: preferredContactDate,
        admin_call_time_ist: adminCallTimeIST,
        company: contactCompany,
        subject: subject,
        message: formattedDescription,
        admin_url: adminUrl,
        request_id: requestId,
        source: source === "lead_funnel" ? "Lead Funnel (Get Started)" : "Get In Touch Contact",
        services: servicesList.length > 0 ? servicesList.join(", ") : undefined,
        budget: budgetNum != null ? `$${budgetNum.toLocaleString()}` : undefined,
        timeline: timelineVal || undefined,
        app_platform: platformVal || undefined,
        cms_requirement: cmsReqVal || undefined,
      },
      {
        from: { email: "no-reply@websmithdigital.com", name: "Websmith Digital Alerts" },
        replyTo: "support@websmithdigital.com",
        custom: {
          subject: `[New Inquiry Raised - ${requestId}] ${subject} (from ${contactName})`,
          html: "",
          plainText: "",
        },
      }
    );
  } catch (emailErr) {
    console.error("[Tickets/Public] Failed to send admin alert email:", emailErr);
  }

  // TODO 2 — Automatic Welcome + Login + Chat after Get In Touch: send the
  // First Welcome Message immediately, containing the Client Portal login link,
  // the customer's login email and the secure Messenger Chat link for THIS
  // conversation. The chat link is generated server-side from the real ticket
  // id + customer email (never exposed as a raw token). No duplicate client
  // account (existing account is reused above). The welcome email is sent once
  // per successful submission; the email body never exposes the JWT token.
  const origin = new URL(request.url).origin;
  try {
    await sendWelcomeEmail(db, client, {
      ticketId,
      requestId,
      contactName,
      contactEmail,
      subject,
      description: message,
      account: { customId: account.customId ?? null, _id: account._id.toString() },
      origin,
      createdAt: now,
    });
  } catch (emailError: any) {
    console.error("Failed to send welcome email:", emailError?.message || emailError);
  }

  return json(
    { data: { ...ticket, _id: ticketId }, clientId: account._id.toString(), clientAccountCreated },
    { status: 201 }
  );
});


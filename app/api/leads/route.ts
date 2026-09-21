import { apiHandler, jsonBody, json } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/mailer";
import { validatePhoneNumber } from "@/core/utils/phoneValidation";
import {
  createClientAccount,
  generateUniqueRequestId,
  sendWelcomeEmail,
} from "@/lib/tickets/email";
import crypto from "node:crypto";

const sanitize = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

export const POST = apiHandler(async ({ db, client, request }) => {
  const body = await jsonBody(request);
  const name = sanitize(body.name);
  const email = sanitize(body.email).toLowerCase();
  const callingPhone = sanitize(body.callingPhone ?? body.phone ?? "");
  const whatsappPhone = sanitize(body.whatsappPhone ?? body.whatsapp ?? "");
  const phone = callingPhone || whatsappPhone;

  if (!name || !email || !email.includes("@")) {
    return json(
      { success: false, error: "Name and valid email are required", message: "Name and valid email are required" },
      { status: 400 }
    );
  }

  if (callingPhone) {
    const callCheck = validatePhoneNumber(callingPhone);
    if (!callCheck.valid) {
      return json(
        { success: false, error: callCheck.error || "Invalid calling phone number", message: callCheck.error || "Invalid calling phone number" },
        { status: 400 }
      );
    }
  }

  if (whatsappPhone) {
    const waCheck = validatePhoneNumber(whatsappPhone);
    if (!waCheck.valid) {
      return json(
        { success: false, error: waCheck.error || "Invalid WhatsApp phone number", message: waCheck.error || "Invalid WhatsApp phone number" },
        { status: 400 }
      );
    }
  }

  const preferredContactDate = sanitize(body.preferredContactDate ?? body.preferredDate ?? "");
  const preferredContactTime = sanitize(body.preferredContactTime ?? body.preferredTime ?? body.preferredSlot ?? "");
  const timeZone = sanitize(body.timeZone ?? body.timezone ?? body.clientTimeZone ?? "");
  const adminCallTimeIST = sanitize(body.adminCallTimeIST ?? "");
  const company = sanitize(body.company);
  const notes = sanitize(body.notes);
  const cmsRequirement = sanitize(body.cmsRequirement);
  const appPlatform = sanitize(body.appPlatform);
  const services = Array.isArray(body.services) ? body.services.map(String) : [];
  const budget = body.budget == null || body.budget === "" ? null : Number(body.budget);
  const timeline = sanitize(body.timeline);

  const now = new Date();

  // Create or reuse client account
  const existingAccount = await db.collection("users").findOne({ email, role: "client" });
  const account = existingAccount ?? (await createClientAccount(db, { name, email }));
  const clientAccountCreated = !existingAccount;

  // Generate WSD-XXXXXX request ID
  const requestId = await generateUniqueRequestId(db);

  const servicesSummary = services.length ? services.join(", ") : "Custom Service Inquiry";
  const subject = `Project Inquiry: ${servicesSummary}`;

  const messageLines = [
    servicesSummary ? `Selected Services: ${servicesSummary}` : null,
    budget ? `Estimated Budget: $${budget.toLocaleString()}` : null,
    timeline ? `Target Timeline: ${timeline}` : null,
    cmsRequirement ? `CMS Requirement: ${cmsRequirement}` : null,
    appPlatform ? `Preferred Platform: ${appPlatform}` : null,
    notes ? `Project Notes & Scope:\n${notes}` : null,
  ].filter(Boolean);

  const formattedMessage = messageLines.join("\n\n") || `Project inquiry for ${servicesSummary}`;

  // 1. Create ticket in tickets collection (appears in Admin Query Inbox /admin/messages)
  const ticket = {
    source: "lead_funnel",
    requestId,
    clientId: account._id.toString(),
    clientCustomId: String(account.customId ?? ""),
    clientAccountSource: clientAccountCreated ? "created" : "existing",
    clientAccountEmail: email,
    contactName: name,
    contactEmail: email,
    contactCompany: company,
    contactPhone: callingPhone || whatsappPhone || "",
    contactCallingPhone: callingPhone,
    contactWhatsappPhone: whatsappPhone,
    preferredContactDate,
    preferredContactTime,
    timeZone,
    clientTimeZone: timeZone,
    adminCallTimeIST,
    budget,
    timeline,
    services,
    cmsRequirement,
    appPlatform,
    developerId: null,
    projectId: null,
    subject,
    description: formattedMessage,
    priority: "medium",
    status: "open",
    chatStatus: "open",
    resolution: null,
    closedAt: null,
    attachments: [],
    messages: [
      {
        id: crypto.randomUUID(),
        senderType: "client",
        direction: "inbound",
        senderEmail: email,
        senderName: name,
        recipientEmail: "",
        message: formattedMessage,
        createdAt: now,
        source: "lead_funnel",
      },
    ],
    lastClientReplyAt: now,
    adminReadAt: null,
    history: [{ action: "created", actorRole: "client", message: "Lead submitted via Get Started funnel", createdAt: now }],
    createdAt: now,
    updatedAt: now,
  };

  const ticketResult = await db.collection("tickets").insertOne(ticket);
  const ticketId = ticketResult.insertedId.toString();

  // 2. Also record in leads collection for scoping records
  const lead = {
    ticketId,
    requestId,
    name,
    email,
    phone,
    callingPhone,
    whatsappPhone,
    company,
    budget,
    timeline,
    preferredContactDate,
    preferredContactTime,
    timeZone,
    adminCallTimeIST,
    notes,
    cmsRequirement,
    appPlatform,
    services,
    status: "new",
    createdAt: now,
  };

  await db.collection("leads").insertOne(lead);

  // 3. Send Admin Alert Notification Email
  try {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || "digitalwebsmith@gmail.com";
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
        customer_name: name,
        customer_email: email,
        calling_phone: callingPhone,
        whatsapp_phone: whatsappPhone,
        timezone: timeZone,
        client_timezone: timeZone,
        preferred_date: preferredContactDate,
        admin_call_time_ist: adminCallTimeIST,
        company,
        subject,
        message: formattedMessage,
        admin_url: adminUrl,
        request_id: requestId,
        source: "Lead Funnel (Get Started)",
        services: services.length ? services.join(", ") : undefined,
        budget: budget != null ? `$${budget.toLocaleString()}` : undefined,
        timeline: timeline || undefined,
        app_platform: appPlatform || undefined,
        cms_requirement: cmsRequirement || undefined,
      },
      {
        from: { email: "no-reply@websmithdigital.com", name: "Websmith Digital Alerts" },
        replyTo: "support@websmithdigital.com",
        custom: {
          subject: `[New Qualified Lead - ${requestId}] ${servicesSummary} (from ${name})`,
          html: "",
          plainText: "",
        },
      }
    );
  } catch (emailErr) {
    console.error("[Leads] Failed to send admin alert email:", emailErr);
  }

  // 4. Send Customer Welcome / Thank-You Email with Direct Live Chat Link
  const origin = new URL(request.url).origin;
  try {
    await sendWelcomeEmail(db, client, {
      ticketId,
      requestId,
      contactName: name,
      contactEmail: email,
      subject,
      description: formattedMessage,
      account: { customId: account.customId ?? null, _id: account._id.toString() },
      origin,
      createdAt: now,
    });
  } catch (welcomeErr: any) {
    console.error("[Leads] Failed to send welcome email:", welcomeErr?.message || welcomeErr);
  }

  return json(
    {
      success: true,
      data: { ...lead, _id: ticketId, ticketId, requestId },
      clientId: account._id.toString(),
      clientAccountCreated,
    },
    { status: 201 }
  );
});

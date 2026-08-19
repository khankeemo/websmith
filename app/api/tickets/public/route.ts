import { ObjectId } from "mongodb";
import { apiHandler, jsonBody, json } from "@/lib/server/api";
import { createClientAccount, ensureResolutionTemplates, findDefaultTemplate, renderResolutionTemplate, renderCustomerMessagePlain, resolutionHtmlBody, stripAdminMarkers, FIRST_WELCOME_TEMPLATE_KEY } from "@/lib/tickets/email";
import { buildChatUrl } from "@/lib/tickets/chat";
import { sendEmail } from "@/lib/email/brevo";
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

  if (!subject || !message || !contactName || !contactEmail) {
    return json({ success: false, error: "Name, email, subject and message are required", message: "Name, email, subject and message are required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(contactEmail)) {
    return json({ success: false, error: "Please enter a valid email address", message: "Please enter a valid email address" }, { status: 400 });
  }
  if (contactName.length > 200 || contactEmail.length > 200 || contactCompany.length > 200 || subject.length > 300 || message.length > 20000) {
    return json({ success: false, error: "One or more fields are too long", message: "One or more fields are too long" }, { status: 400 });
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

  const ticket = {
    source: "public_contact",
    clientId: account._id.toString(),
    clientCustomId: String(account.customId ?? ""),
    clientAccountSource: clientAccountCreated ? "created" : "existing",
    clientAccountEmail: contactEmail,
    contactName,
    contactEmail,
    contactCompany,
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
  const ticketId = result.insertedId.toString();

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

/** Send the automatic First Welcome Message after a Get In Touch submission.
 * Reuses the database-backed `first-welcome` template (seeded, never
 * overwritten) and the existing sendEmail pipeline — no new email provider,
 * no new sender identity. The secure chat link is generated server-side and
 * embedded as a real URL (the raw JWT token is never exposed in the message). */
async function sendWelcomeEmail(
  db: any,
  client: any,
  input: {
    ticketId: string;
    contactName: string;
    contactEmail: string;
    subject: string;
    description: string;
    account: { customId?: string | null; _id: string };
    origin: string;
    createdAt: Date;
  }
) {
  const templates = await ensureResolutionTemplates(db);
  const template = templates.find((t) => t.key === FIRST_WELCOME_TEMPLATE_KEY) || findDefaultTemplate(templates);
  if (!template) return;

  const portalUrl = `${input.origin}/login`;
  const data: Record<string, string> = {
    client_name: input.contactName || "Valued Customer",
    client_email: input.contactEmail,
    client_id: String(input.account?.customId ?? ""),
    query_subject: input.subject,
    query_message: input.description,
    resolution_summary: "",
    portal_url: portalUrl,
    chat_url: buildChatUrl({ _id: input.ticketId, contactEmail: input.contactEmail, contactName: input.contactName }, input.origin),
    company_name: "Websmith Digital",
    request_id: input.ticketId,
    query_status: "open",
  };

  const rendered = renderResolutionTemplate(template, data);
  const bodyText = stripAdminMarkers(rendered.body);
  const subject = stripAdminMarkers(rendered.subject) || "We've received your request";

  const sendResult = await sendEmail(
    client,
    "support_reply",
    { email: input.contactEmail, name: input.contactName },
    data,
    { custom: { subject, html: resolutionHtmlBody(subject, bodyText), plainText: renderCustomerMessagePlain(bodyText) } }
  );

  const now = new Date();

  const historyEntry = {
    action: "welcome_email",
    actorRole: "system",
    message: "First Welcome Message sent automatically after Get in Touch submission.",
    templateKey: template.key,
    templateName: template.name,
    recipient: input.contactEmail,
    emailSubject: subject,
    emailBody: bodyText,
    emailDelivered: sendResult.success,
    emailError: sendResult.success ? undefined : sendResult.error,
    createdAt: now,
  };

  const welcomeMessage = {
    id: crypto.randomUUID(),
    senderType: "admin",
    direction: "outbound",
    senderEmail: "",
    senderName: "Websmith Digital Support",
    recipientEmail: input.contactEmail,
    message: bodyText,
    createdAt: now,
    source: "welcome_email",
    deliveryStatus: sendResult.success ? "sent" : "failed",
    deliveryError: sendResult.success ? undefined : sendResult.error,
    providerMessageId: sendResult.messageId || undefined,
  };

  await db.collection("tickets").updateOne(
    { _id: new ObjectId(input.ticketId) },
    {
      $set: {
        welcomeSentAt: now,
        updatedAt: now,
        adminReadAt: now,
      },
      $push: {
        history: historyEntry,
        messages: welcomeMessage,
      },
}
  );
}

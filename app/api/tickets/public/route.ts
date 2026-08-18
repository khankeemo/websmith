import { apiHandler, jsonBody, json } from "@/lib/server/api";
import { createClientAccount } from "@/lib/tickets/email";
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
  return json(
    { data: { ...ticket, _id: result.insertedId.toString() }, clientId: account._id.toString(), clientAccountCreated },
    { status: 201 }
  );
});

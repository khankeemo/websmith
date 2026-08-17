import { apiHandler, json, HttpError } from "@/lib/server/api";
import { processInboundEmail, type InboundAttachment, type InboundMessage } from "@/lib/tickets/inbound-core";

// ============================================================================
// BREVO INBOUND WEBHOOK — Query Inbox (Public Website, AWS-01 R01)
//
// The ONLY inbound receiver for native system mail. support@websmithdigital.com
// is a native/system account (IMAP = n/a, Sync = n/a — see the Communications
// Center), so the IMAP poller on `/api/tickets/inbound` can NEVER see client
// replies to support@. This route is the minimum Brevo inbound webhook/HTTP
// bridge required to receive that mail:
//
//   Client Gmail/Outlook
//        ↓
//   support@websmithdigital.com   (unchanged — domain MX still delivers here)
//        ↓ (forwarded copy)
//   support@<brevo-inbound-domain> (e.g. reply.websmithdigital.com, MX → Brevo)
//        ↓
//   Brevo inbound parsing webhook  →  POST /api/brevo/inbound  (this route)
//        ↓
//   existing inbound processing (lib/tickets/inbound-core.ts — the SAME
//   processInboundEmail used by the IMAP path: ticket matching by
//   In-Reply-To/References + sender-verified fallback, body cleaning,
//   Message-ID dedupe, `messages[]` structure, attachment handling)
//        ↓
//   Messenger Chat (auto-poll refreshes the open thread within ≤1 s)
//
// Security: the endpoint is public (Brevo calls it without a browser session),
// so it REQUIRES the `x-inbound-token` header (or `?token=` query param) to
// match the `BREVO_INBOUND_WEBHOOK_TOKEN` env var — configure the webhook in
// the Brevo dashboard with that exact header. Without the env var the route
// answers 503 (never silently accepts), so a missing configuration is loud.
//
// The complete original email is NOT consumed here: it still arrives at
// support@websmithdigital.com (Namecheap/domain MX) — this webhook only
// receives the parsed copy Brevo produces for the receiving domain.
// ============================================================================

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // mirrors lib/tickets/inbound-core.ts

const norm = (value: string) =>
  String(value || "").trim().replace(/^<|>$/g, "").replace(/\s+/g, "").toLowerCase();

// Resolve the Query Inbox support address (same resolution as the outbound
// Brevo sender): Manage Page contact_info.email → MAIL_SUPPORT_ADDRESS env →
// support@websmithdigital.com.
async function resolveSupportAddress(db: any): Promise<string> {
  try {
    const doc = await db.collection("settings").findOne({ key: "contact_info" });
    const email = doc?.value?.email;
    if (email && typeof email === "string" && email.trim()) return email.trim();
  } catch {
    // Fall through to env / default.
  }
  return process.env.MAIL_SUPPORT_ADDRESS || "support@websmithdigital.com";
}

// A recipient is a support recipient when it IS the resolved support address
// or it is the dedicated Brevo inbound address for support
// (support@<inbound-subdomain>.websmithdigital.com). sales@ / no-reply@ (and
// any other address) are never matched.
function isSupportRecipient(address: string, supportAddress: string): boolean {
  const a = norm(address);
  if (!a) return false;
  if (a === norm(supportAddress)) return true;
  const [local, domain] = a.split("@");
  if (!local || !domain) return false;
  return local === "support" && (domain === "websmithdigital.com" || domain.endsWith(".websmithdigital.com"));
}

// Fetch one attachment's bytes from Brevo (attachments are never embedded in
// the webhook payload — they carry a DownloadToken). Best-effort: a failed
// download never breaks the client message itself.
async function fetchBrevoAttachment(
  attachment: { Name?: string; ContentType?: string; ContentLength?: number; DownloadToken?: string }
): Promise<InboundAttachment | null> {
  try {
    const token = String(attachment.DownloadToken || "").trim();
    const size = Number(attachment.ContentLength || 0);
    if (!token) return null;
    if (size > MAX_ATTACHMENT_SIZE) {
      console.warn(`Brevo inbound attachment skipped (too large): ${attachment.Name}`);
      return null;
    }
    if (!process.env.BREVO_API_KEY) {
      console.warn("Brevo inbound attachment skipped: BREVO_API_KEY not configured");
      return null;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`https://api.brevo.com/v3/inbound/attachments/${encodeURIComponent(token)}`, {
        headers: { "api-key": process.env.BREVO_API_KEY },
        signal: controller.signal,
      });
      if (!response.ok) {
        console.warn(`Brevo inbound attachment download failed (${response.status}): ${attachment.Name}`);
        return null;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_ATTACHMENT_SIZE) return null;
      return {
        filename: typeof attachment.Name === "string" ? attachment.Name : "attachment",
        contentType: typeof attachment.ContentType === "string" ? attachment.ContentType : "application/octet-stream",
        content: buffer,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    console.error("Brevo inbound attachment fetch error:", error?.message || error);
    return null;
  }
}

type BrevoItem = {
  MessageId?: string;
  InReplyTo?: string | null;
  From?: { Address?: string; Name?: string } | null;
  To?: Array<{ Address?: string; Name?: string }> | null;
  Recipients?: string[] | null;
  SentAtDate?: string;
  Subject?: string;
  RawTextBody?: string | null;
  RawHtmlBody?: string | null;
  ExtractedMarkdownMessage?: string | null;
  Attachments?: Array<{
    Name?: string;
    ContentType?: string;
    ContentLength?: number;
    DownloadToken?: string;
  }> | null;
  Headers?: Record<string, string | string[]> | null;
};

async function processBrevoItem(db: any, item: BrevoItem, supportAddress: string) {
  const fromAddress = String(item.From?.Address || "").trim();
  const fromName = String(item.From?.Name || "").trim();
  const messageId = String(item.MessageId || "").trim();

  // Guard rails: no sender, or the sender IS the support account itself
  // (bounces / auto-loop) — never processed.
  if (!fromAddress || isSupportRecipient(fromAddress, supportAddress)) {
    return { skipped: true, reason: "no_sender_or_self" };
  }

  // Only mail addressed to the support account is processed (strict — the
  // webhook's receiving domain may carry other forwarded addresses).
  const recipients: string[] = [
    ...(Array.isArray(item.To) ? item.To.map((m) => String(m?.Address || "")) : []),
    ...(Array.isArray(item.Recipients) ? item.Recipients.map((r) => String(r || "")) : []),
  ];
  if (!recipients.some((r) => isSupportRecipient(r, supportAddress))) {
    return { skipped: true, reason: "not_addressed_to_support" };
  }

  // Thread identity: In-Reply-To + References (the Headers map carries
  // References; the item carries InReplyTo).
  const refs: string[] = [];
  const inReplyTo = String(item.InReplyTo || item.Headers?.["In-Reply-To"] || "").trim();
  if (inReplyTo) refs.push(inReplyTo);
  const references = item.Headers?.["References"];
  if (references) {
    if (Array.isArray(references)) refs.push(...references.map((r) => String(r || "")));
    else refs.push(String(references));
  }

  // Attachments: not embedded in the payload — download each via its
  // DownloadToken (best-effort; the original mail keeps them at support@).
  const attachments: InboundAttachment[] = [];
  if (Array.isArray(item.Attachments)) {
    for (const att of item.Attachments.slice(0, 20)) {
      const fetched = await fetchBrevoAttachment(att);
      if (fetched) attachments.push(fetched);
    }
  }

  const incoming: InboundMessage = {
    fromAddress,
    fromName,
    messageId,
    refs,
    subject: String(item.Subject || "").trim(),
    // Text first; fall back to Brevo's extracted markdown (signature already
    // removed by Brevo) so the body is never empty for HTML-only mail.
    text: String(item.RawTextBody || item.ExtractedMarkdownMessage || ""),
    html: String(item.RawHtmlBody || ""),
    date: item.SentAtDate ? new Date(item.SentAtDate) : new Date(),
    mailboxEmail: supportAddress,
    attachments,
  };
  return processInboundEmail(db, incoming);
}

export const POST = apiHandler(async ({ db, request }) => {
  // Secret gate: the public endpoint must never accept unauthenticated posts.
  const expected = process.env.BREVO_INBOUND_WEBHOOK_TOKEN;
  if (!expected) {
    throw new HttpError(
      503,
      "BREVO_INBOUND_WEBHOOK_TOKEN is not configured. Set the env var and configure the Brevo inbound webhook to send it in the x-inbound-token header."
    );
  }
  const headerToken = String(request.headers.get("x-inbound-token") || "").trim();
  const queryToken = new URL(request.url).searchParams.get("token") || "";
  const supplied = headerToken || queryToken;
  if (!supplied || supplied !== expected) {
    throw new HttpError(401, "Invalid inbound webhook token");
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  const items: BrevoItem[] = Array.isArray(body?.items) ? body.items : [];
  const supportAddress = await resolveSupportAddress(db);

  const totals = { processed: 0, matched: 0, duplicate: 0, senderMismatch: 0, unmatched: 0, attachmentsStored: 0 };
  let skipped = 0;
  for (const item of items) {
    try {
      const outcome = await processBrevoItem(db, item, supportAddress);
      if (!outcome || !("status" in outcome)) {
        skipped += 1;
        continue;
      }
      totals.processed += 1;
      if (outcome.status === "matched") {
        totals.matched += 1;
        totals.attachmentsStored += outcome.attachmentsStored || 0;
      } else if (outcome.status === "duplicate") totals.duplicate += 1;
      else if (outcome.status === "sender_mismatch") totals.senderMismatch += 1;
      else totals.unmatched += 1;
    } catch (itemError: any) {
      // One bad item must never fail the whole webhook delivery (Brevo
      // retries on non-2xx, which would re-deliver already-stored messages).
      console.error("Brevo inbound item processing error:", itemError?.message || itemError);
    }
  }

  return json({
    data: { ...totals, skipped, supportAddress },
  });
});
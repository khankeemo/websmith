import crypto from "node:crypto";

// ============================================================================
// INBOUND EMAIL CORE — Query Inbox (Public Website, AWS-01 R01)
//
// Shared, transport-agnostic inbound processing for client email replies. Used
// by BOTH inbound paths so they behave identically:
//   1. `POST /api/tickets/inbound`  — IMAP sync of enabled PG mailboxes
//      (external mailboxes only; support@websmithdigital.com is a native
//      system account with no IMAP, so it can never be polled).
//   2. `POST /api/brevo/inbound`    — Brevo inbound parsing webhook (native
//      support@ mail arrives here via the Brevo receiving domain).
//
// Matching rules (strict, never subject alone):
//   1. Match by thread: an inbound email whose In-Reply-To / References contain
//      the Message-ID of an outbound admin message stored on a ticket
//      (`messages.providerMessageId`).
//   2. Fallback: the inbound sender email equals the ticket's contactEmail
//      (thread identity honored: among the sender's tickets, the one whose
//      subject matches the inbound subject wins; most recently updated
//      non-deleted ticket as the tiebreak).
// Sender is ALWAYS verified against the ticket's contactEmail; a mismatched
// sender is never attached to a ticket. Duplicates (same inbound Message-ID
// already stored) are skipped.
//
// Inbound email bodies are cleaned at STORE time (cleanInboundBody): quoted
// previous emails, original-message blocks, signatures and reply-header
// blocks are stripped so the Messenger Chat shows ONLY the client's own words.
// ============================================================================

export const norm = (value: string) =>
  String(value || "").trim().replace(/^<|>$/g, "").replace(/\s+/g, "").toLowerCase();

// ---------------------------------------------------------------------------
// Clean inbound email body (R01 Phase 4 — Messenger Chat shows ONLY the
// client's own words). Strips quoted previous-email blocks, original-message
// sections, signature blocks and stray reply-header blocks at STORE time so
// the chat bubble, history entry and any consumer get the same clean body.
// Conservative: the first quote/signature/header boundary ends the message;
// legitimate body text before the boundary is preserved verbatim.
// ---------------------------------------------------------------------------
export function cleanInboundBody(text: string): string {
  let body = String(text || "");
  if (!body.trim()) return "";
  body = body.replace(/\r\n/g, "\n");
  const lines = body.split("\n");
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Quoted reply block (every line prefixed with ">").
    if (trimmed.startsWith(">")) {
      cut = i;
      break;
    }
    // Outlook / Apple Mail original-message separator.
    if (/^-----+\s*(original message|forwarded message|reply message|message)\s*-----+$/i.test(trimmed)) {
      cut = i;
      break;
    }
    // Gmail-style "On <date>, <name> wrote:" quote intro (after a blank line).
    if (i > 0 && lines[i - 1].trim() === "" && /^on .+ (wrote|said):\s*$/i.test(trimmed)) {
      cut = i;
      break;
    }
    // Mobile signatures ("Sent from my iPhone/Android/...").
    if (/^sent from (my )?(iphone|ipad|android|galaxy|blackberry|windows)/i.test(trimmed)) {
      cut = i;
      break;
    }
    // Signature separator ("-- ").
    if (trimmed === "--" || trimmed.startsWith("-- ")) {
      cut = i;
      break;
    }
    // Outlook reply header block ("From: ... / Sent: ... / To: ...").
    if (
      i > 0 &&
      lines[i - 1].trim() === "" &&
      /^(from|sent|to|cc|bcc|subject|date|reply-to|return-path|message-id|x-[a-z0-9-]+):/i.test(trimmed)
    ) {
      cut = i;
      break;
    }
  }
  return lines
    .slice(0, cut)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Normalize a subject for thread-identity comparison: strip repeated
// Re:/Fwd:/Fw:/Aw:/Sv:/VS: prefixes and punctuation, lowercase.
export function normSubject(value: string): string {
  let s = String(value || "");
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/^\s*(?:re|fwd|fw|aw|sv|vs|antwort|antw)\s*:\s*/i, "");
    if (next === s) break;
    s = next;
  }
  return s.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

export function collectIds(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

export type InboundAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export type InboundMessage = {
  fromAddress: string;
  fromName: string;
  messageId: string;
  refs: string[];
  subject: string;
  text: string;
  html: string;
  date: Date;
  mailboxEmail: string;
  attachments: InboundAttachment[];
};

export type InboundOutcome = {
  status: "matched" | "duplicate" | "sender_mismatch" | "unmatched";
  ticketId?: string;
  attachmentsStored?: number;
};

// Persist inbound email attachments into the shared `uploads` collection (same
// storage path as /api/tickets/upload + GET /api/uploads/<id>) so they are never
// lost from the support email and the Messenger Chat can render a compact link.
// Best-effort: a failed attachment never breaks the client message itself.
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB, mirrors the universal policy.
type StoredAttachment = { name: string; url: string; size: number; contentType: string };
export async function storeInboundAttachments(db: any, attachments: InboundAttachment[]): Promise<StoredAttachment[]> {
  const links: StoredAttachment[] = [];
  if (!Array.isArray(attachments) || attachments.length === 0) return links;
  for (const att of attachments) {
    try {
      if (!att.content || !Buffer.isBuffer(att.content) || att.content.length === 0) continue;
      if (att.content.length > MAX_ATTACHMENT_SIZE) continue;
      const doc = {
        name: att.filename || "attachment",
        contentType: att.contentType || "application/octet-stream",
        size: att.content.length,
        data: att.content.toString("base64"),
        createdAt: new Date(),
      };
      const result = await db.collection("uploads").insertOne(doc);
      links.push({
        name: att.filename || "attachment",
        url: `/api/uploads/${result.insertedId.toString()}`,
        size: att.content.length,
        contentType: att.contentType || "application/octet-stream",
      });
    } catch (storeError: any) {
      console.error("Inbound attachment store error:", storeError?.message || storeError);
    }
  }
  return links;
}

export async function processInboundEmail(db: any, incoming: InboundMessage): Promise<InboundOutcome> {
  const normalizedMessageId = norm(incoming.messageId);
  const refs = incoming.refs.map(norm).filter(Boolean);

  // 1. Match by thread (admin message Message-ID in In-Reply-To / References).
  let ticket: any = null;
  if (refs.length > 0) {
    ticket = await db.collection("tickets").findOne({
      deletedAt: { $exists: false },
      "messages.providerMessageId": { $in: refs },
    });
  }

  // 2. Fallback: sender email == ticket contactEmail (never subject alone).
  //    Thread identity is still honored: when the sender has multiple tickets,
  //    the ticket whose subject matches the inbound subject (Re:/Fwd: stripped)
  //    wins, newest-updated as the tiebreak.
  if (!ticket) {
    const fromLower = String(incoming.fromAddress || "").trim().toLowerCase();
    if (fromLower) {
      const candidates = await db
        .collection("tickets")
        .find({
          deletedAt: { $exists: false },
          contactEmail: { $regex: `^${fromLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        })
        .sort({ updatedAt: -1 })
        .limit(20)
        .toArray();
      if (candidates.length > 0) {
        const inboundSubject = normSubject(incoming.subject);
        ticket =
          (inboundSubject ? candidates.find((c) => normSubject(c.subject) === inboundSubject) : undefined) ||
          candidates[0];
      }
    }
  }

  if (!ticket) return { status: "unmatched" };

  // 3. Verify the sender is the ticket's contact (never attach a stranger's mail).
  const ticketEmail = String(ticket.contactEmail || "").trim().toLowerCase();
  if (!ticketEmail || norm(incoming.fromAddress) !== norm(ticketEmail)) {
    return { status: "sender_mismatch", ticketId: ticket._id.toString() };
  }

  // 4. Dedupe by the inbound email's own Message-ID.
  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  if (
    normalizedMessageId &&
    messages.some((m: any) => m.providerMessageId && norm(String(m.providerMessageId)) === normalizedMessageId)
  ) {
    return { status: "duplicate", ticketId: ticket._id.toString() };
  }

  const now = new Date();
  const createdAt = incoming.date && !Number.isNaN(new Date(incoming.date).getTime()) ? new Date(incoming.date) : now;
  // Body ONLY — quoted replies / signatures / reply-header blocks are stripped
  // here so the Messenger Chat shows only the client's own words (R01 Phase 4).
  const bodyText = cleanInboundBody(incoming.text || incoming.html || "") || "(No content)";

  // 5. Persist inbound attachments so they are never lost from the support
  //    email / chat. The original email (with its attachments) stays in the
  //    support mailbox untouched (IMAP is opened READ-ONLY), and the attachment
  //    bytes are linked to this message so the Messenger Chat can render a
  //    compact indicator. Only the body text is shown in Chat.
  const storedAttachments = await storeInboundAttachments(db, incoming.attachments || []);

  messages.push({
    id: crypto.randomUUID(),
    senderType: "client",
    direction: "inbound",
    senderEmail: String(incoming.fromAddress || "").trim(),
    senderName: String(incoming.fromName || ticket.contactName || "Customer").trim(),
    recipientEmail: String(incoming.mailboxEmail || "").trim(),
    message: bodyText,
    createdAt,
    source: "email",
    providerMessageId: normalizedMessageId || undefined,
    inReplyTo: refs.length ? refs : undefined,
    references: refs.length ? refs : undefined,
    attachments: storedAttachments.length ? storedAttachments : undefined,
  });

  const history = Array.isArray(ticket.history) ? ticket.history : [];
  history.push({
    action: "client_reply",
    actorRole: "client",
    message: bodyText,
    emailFrom: String(incoming.fromAddress || "").trim(),
    emailSubject: String(incoming.subject || "").trim(),
    providerMessageId: normalizedMessageId || undefined,
    createdAt,
    ...(storedAttachments.length ? { attachments: storedAttachments } : {}),
  });

  const update: any = {
    messages,
    history,
    lastClientReplyAt: createdAt,
    updatedAt: now,
  };
  // A customer reply reopens a closed conversation (same rule as an admin reply).
  if (ticket.status === "closed") {
    update.status = "in_progress";
    update.chatStatus = "open";
    update.closedAt = null;
  }
  await db.collection("tickets").updateOne({ _id: ticket._id }, { $set: update });

  return { status: "matched", ticketId: ticket._id.toString(), attachmentsStored: storedAttachments.length };
}
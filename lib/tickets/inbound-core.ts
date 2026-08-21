import crypto from "node:crypto";

// ============================================================================
// QUERY INBOX BRIDGE — Public Website (AWS-01 R01, PHASE 2 — FINAL)
//
// The Query Inbox NEVER receives email itself. There is exactly ONE inbound
// receiver in the whole platform: the UNIVERSAL Websmith email receive system
// (mailbox IMAP sync `POST /internal/backend/mailboxes/[id]/sync` + the public
// portal `POST /api/portal/support-message`), which stores every processed
// customer inbound message in the license-system PostgreSQL tables
// `communication_conversations` / `conversation_messages`.
//
// This module is the live-chat BRIDGE between that single processed source
// and the Query Inbox tickets: it reads ALREADY-PROCESSED customer
// conversation messages (PostgreSQL), maps each one to the client's existing
// Query Ticket, and appends the message to `tickets.messages[]` (MongoDB) so
// Messenger Chat shows the client's email reply within ≤1 s (the admin UI
// auto-polls this bridge every 1 second while a conversation is open).
//
//   Client reply  ->  support@ / configured mailbox
//     ->  UNIVERSAL receive (PG communication_conversations/conversation_messages)
//     ->  bridge (this module) -> existing Query Ticket messages[]
//     ->  Messenger Chat live
//
// Matching rules (identity-first, never subject alone):
//   1. The processed conversation's customer email equals the ticket's
//      contactEmail (case-insensitive). Sender verification is inherent: the
//      message was already accepted by the universal receiver as a customer
//      message on a conversation owned by that address.
//   2. Thread identity tiebreak: among the sender's tickets, the one whose
//      normalized subject matches the conversation subject wins; most recently
//      updated non-deleted ticket as the tiebreak.
//
// Duplicates are impossible by construction: every append stores the source
// PostgreSQL `conversation_messages.id` as `sourceRef` (`cm:<id>`), and a
// second bridge pass over the same row is skipped (a body/timestamp content
// guard also covers chat entries appended by pre-bridge receivers).
//
// Inbound bodies are cleaned at BRIDGE time (cleanInboundBody): quoted
// previous emails, original-message blocks, signatures and reply-header
// blocks are stripped so the Messenger Chat shows ONLY the client's own words.
//
// R02: the cleaner itself lives in ONE shared pure module
// (`core/services/inboundBodyCleanup.ts`) that BOTH this server bridge and
// the admin UI's display mirror import — one canonical rule set, zero drift.
// The quote-intro boundary there is UNCONDITIONAL (real-world Gmail/Apple
// replies carry no blank line above "On … wrote:" and often no ">" markers
// below it), which is what leaked whole quoted emails into chat bubbles.
// ============================================================================

import { cleanInboundBody } from "@/core/services/inboundBodyCleanup";

// Canonical shared implementation — re-exported so every existing consumer
// (`app/api/tickets/inbound/route.ts` bridge loop) keeps its exact API.
export { cleanInboundBody };

export const norm = (value: string) =>
  String(value || "").trim().replace(/^<|>$/g, "").replace(/\s+/g, "").toLowerCase();

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

export type InboundAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
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

// ---------------------------------------------------------------------------
// Bridge input: ONE already-processed customer message from the universal
// email system (a row of `conversation_messages` joined to its
// `communication_conversations`). It is NEVER raw email — the universal
// receiver has already validated the sender, stored the body and persisted
// attachment bytes before this module sees it.
// ---------------------------------------------------------------------------
export type BridgeMessage = {
  pgMessageId: number; // conversation_messages.id — the stable dedupe key.
  fromEmail: string; // COALESCE(sender_email, conversation.customer_email)
  fromName: string; // sender_name or conversation.customer_name
  subject: string; // the conversation subject (thread-identity tiebreak)
  body: string; // the stored customer message text
  createdAt: Date; // conversation_messages.created_at — timestamp preserved
  mailboxEmail: string; // receiving mailbox address when the conversation is mailbox-owned
  attachments: InboundAttachment[]; // bytes from conversation_attachments.content
};

export type BridgeOutcome = {
  status: "matched" | "duplicate" | "unmatched";
  ticketId?: string;
  attachmentsStored?: number;
};

// Newest processed customer messages read per bridge pass. Keeps the 1-second
// auto-poll light even with a backlog of old processed mail; every new client
// reply is always inside this window (dedupe by `sourceRef` makes
// re-processing of older mail harmless).
export const BRIDGE_BATCH_LIMIT = 200;

export async function bridgeConversationMessages(db: any, item: BridgeMessage): Promise<BridgeOutcome> {
  const fromLower = String(item.fromEmail || "").trim().toLowerCase();
  if (!fromLower) return { status: "unmatched" };

  // 1. Identity-first: the client's existing (non-deleted) tickets.
  const candidates = await db
    .collection("tickets")
    .find({
      deletedAt: { $exists: false },
      contactEmail: { $regex: `^${fromLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    })
    .sort({ updatedAt: -1 })
    .limit(20)
    .toArray();
  if (candidates.length === 0) return { status: "unmatched" };

  // 2. Thread identity tiebreak: subject match wins, newest updatedAt as the
  //    tiebreak (never subject alone — identity is the gate, subject refines).
  const convSubject = normSubject(item.subject);
  const ticket =
    (convSubject ? candidates.find((c) => normSubject(c.subject) === convSubject) : undefined) || candidates[0];

  // 3. Sender verification is inherent (universal receive already accepted the
  //    message on a conversation owned by this address), but the ticket's
  //    contact is re-checked anyway — never attach to a mismatched ticket.
  const ticketEmail = String(ticket.contactEmail || "").trim().toLowerCase();
  if (!ticketEmail || norm(item.fromEmail) !== norm(ticketEmail)) {
    return { status: "unmatched" };
  }

  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  const sourceRef = `cm:${item.pgMessageId}`;
  const createdAt =
    item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime()) ? new Date(item.createdAt) : new Date();

  // 4. Dedupe by the source PostgreSQL row id (`sourceRef`) — plus a
  //    body/timestamp content guard so entries appended by pre-bridge
  //    receivers (same client, same clean body, same minute) never duplicate.
  const alreadyBridged = messages.some((m: any) => String(m.sourceRef || "") === sourceRef);
  if (!alreadyBridged) {
    const bodyText = cleanInboundBody(item.body) || "(No content)";
    const contentDup = messages.some(
      (m: any) =>
        m.senderType === "client" &&
        norm(String(m.senderEmail || "")) === norm(ticketEmail) &&
        norm(String(m.message || "")) === norm(bodyText) &&
        Math.abs(new Date(m.createdAt || 0).getTime() - createdAt.getTime()) < 5 * 60 * 1000
    );
    if (contentDup) return { status: "duplicate", ticketId: ticket._id.toString() };
  } else {
    return { status: "duplicate", ticketId: ticket._id.toString() };
  }

  // 5. Body ONLY — quoted replies / signatures / reply-header blocks are
  //    stripped at bridge time so Messenger Chat shows only the client's own
  //    words (the universal receiver keeps the full record in PostgreSQL).
  const bodyText = cleanInboundBody(item.body) || "(No content)";

  // 6. Persist attachment BYTES (already stored by the universal receiver in
  //    conversation_attachments.content) into the shared `uploads` collection
  //    so the Messenger Chat renders a compact link that can never be lost.
  const storedAttachments = await storeInboundAttachments(db, item.attachments || []);

  messages.push({
    id: crypto.randomUUID(),
    senderType: "client",
    direction: "inbound",
    senderEmail: String(item.fromEmail || "").trim(),
    senderName: String(item.fromName || ticket.contactName || "Customer").trim(),
    recipientEmail: String(item.mailboxEmail || "").trim(),
    message: bodyText,
    createdAt,
    source: "email",
    sourceRef,
    attachments: storedAttachments.length ? storedAttachments : undefined,
  });

  const history = Array.isArray(ticket.history) ? ticket.history : [];
  history.push({
    action: "client_reply",
    actorRole: "client",
    message: bodyText,
    emailFrom: String(item.fromEmail || "").trim(),
    emailSubject: String(item.subject || "").trim(),
    sourceRef,
    createdAt,
    ...(storedAttachments.length ? { attachments: storedAttachments } : {}),
  });

  const update: any = {
    messages,
    history,
    lastClientReplyAt: createdAt,
    updatedAt: new Date(),
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
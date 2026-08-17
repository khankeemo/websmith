import { apiHandler, json, forbidden } from "@/lib/server/api";
import { getDb } from "@/lib/backend-db";
import crypto from "node:crypto";

// ============================================================================
// INBOUND EMAIL SYNC — Query Inbox (Public Website, AWS-01 R01)
//
// Pulls customer email replies into their existing Get in Touch / Query Inbox
// tickets, completing the two-way conversation. Called silently by the
// Messenger Chat auto-poll (every 1 s while a conversation is open):
//
//   Client reply email  ->  mailbox IMAP  ->  this route  ->  ticket thread
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
// The mailboxes source is the license-system PostgreSQL `mailboxes` table,
// READ-ONLY — no mailbox row, credential, SMTP or schema is ever changed here.
// The IMAP mailbox is opened READ-ONLY and messages are NEVER marked Seen, so
// the internal Communications Center sync of the same mailbox is unaffected.
// Unmatched emails stay UNSEEN so they can be re-attempted (e.g. after the
// matching ticket is created). Each poll processes only the newest UNSEEN
// messages (MAX_UNSEEN_BATCH) and overlapping polls are skipped, keeping the
// 1-second auto-poll light even with a backlog of old unprocessed mail.
//
// Inbound email bodies are cleaned at STORE time (cleanInboundBody): quoted
// previous emails, original-message blocks, signatures and reply-header
// blocks are stripped so the Messenger Chat shows ONLY the client's own words.
// ============================================================================

const norm = (value: string) =>
  String(value || "").trim().replace(/^<|>$/g, "").replace(/\s+/g, "").toLowerCase();

// ---------------------------------------------------------------------------
// Clean inbound email body (R01 Phase 4 — Messenger Chat shows ONLY the
// client's own words). Strips quoted previous-email blocks, original-message
// sections, signature blocks and stray reply-header blocks at STORE time so
// the chat bubble, history entry and any consumer get the same clean body.
// Conservative: the first quote/signature/header boundary ends the message;
// legitimate body text before the boundary is preserved verbatim.
// ---------------------------------------------------------------------------
function cleanInboundBody(text: string): string {
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
function normSubject(value: string): string {
  let s = String(value || "");
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/^\s*(?:re|fwd|fw|aw|sv|vs|antwort|antw)\s*:\s*/i, "");
    if (next === s) break;
    s = next;
  }
  return s.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function collectIds(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

type InboundAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

type InboundMessage = {
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

type InboundOutcome = {
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
async function storeInboundAttachments(db: any, attachments: InboundAttachment[]): Promise<StoredAttachment[]> {
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

async function processInboundEmail(db: any, incoming: InboundMessage): Promise<InboundOutcome> {
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

type MailboxSyncStats = {
  processed: number;
  matched: number;
  duplicate: number;
  senderMismatch: number;
  unmatched: number;
  attachmentsStored: number;
  error?: string;
};

// Newest UNSEEN messages processed per poll. Keeps the 1-second auto-poll
// light when a mailbox holds a backlog of old unprocessed mail; every new
// client reply is always inside this window (dedupe makes re-processing of
// older mail harmless).
const MAX_UNSEEN_BATCH = 40;

// Single-instance guard: overlapping polls (auto-poll + any other trigger)
// never run two IMAP sweeps at once — the second call returns a skipped
// summary immediately. Serverless instances each keep their own flag, which
// is fine: the Message-ID dedupe is the real duplicate boundary.
let syncInflight = false;

async function syncMailbox(db: any, mailbox: any): Promise<MailboxSyncStats> {
  const stats: MailboxSyncStats = { processed: 0, matched: 0, duplicate: 0, senderMismatch: 0, unmatched: 0, attachmentsStored: 0 };

  const Imap = (await import("imap")).default;
  const { simpleParser } = await import("mailparser");

  const imap = new Imap({
    host: mailbox.imap_host,
    port: mailbox.imap_port,
    tls: mailbox.imap_secure,
    tlsOptions: { rejectUnauthorized: false },
    user: mailbox.imap_username,
    password: mailbox.imap_password,
    connTimeout: 30000,
    authTimeout: 30000,
  });

  await new Promise<void>((resolve, reject) => {
    imap.once("ready", () => resolve());
    imap.once("error", (err: Error) => reject(err));
    imap.connect();
  });

  // Read-only: never mutate the mailbox (no Seen flags, no moves, no deletes) so
  // the Internal Communications Center sync of the same mailbox is unaffected.
  await new Promise<void>((resolve, reject) => {
    imap.openBox("INBOX", true, (err: Error | null) => (err ? reject(err) : resolve()));
  });

  await new Promise<void>((resolve, reject) => {
    imap.search(["UNSEEN"], (err: Error | null, uids: number[]) => {
      if (err) return reject(err);
      if (!uids || uids.length === 0) {
        imap.end();
        return resolve();
      }

      // The mailbox is opened READ-ONLY and messages are never marked Seen, so
      // every poll re-sees ALL unprocessed mail. The auto-poll now runs every
      // 1 second — cap each pass to the NEWEST messages (highest UIDs) so a
      // backlog of old UNSEEN mail can never make the poll heavy. New client
      // replies are always inside the newest batch; older unmatched mail is
      // still processed as newer mail pushes it through the window (dedupe by
      // Message-ID keeps re-processing harmless).
      const batch = Array.isArray(uids) ? uids.slice(-MAX_UNSEEN_BATCH) : uids;

      const tasks: Promise<void>[] = [];
      const fetch = imap.fetch(batch, { bodies: "", struct: true });

      fetch.on("message", (msg: any) => {
        const task = new Promise<void>((taskResolve) => {
          let settled = false;
          const settle = () => {
            if (!settled) {
              settled = true;
              taskResolve();
            }
          };
          msg.on("body", async (stream: any) => {
            try {
              const parsed = await simpleParser(stream);
              const fromAddress = parsed.from?.value?.[0]?.address || parsed.from?.text || "";
              const fromName = parsed.from?.value?.[0]?.name || "";
              const refs = collectIds(parsed.inReplyTo).concat(collectIds(parsed.references));
              // mailparser exposes each inbound attachment as a Buffer in
              // `content`; normalize to the InboundAttachment shape consumed by
              // storeInboundAttachments (read-only IMAP, never mutated).
              const attachments: InboundAttachment[] = Array.isArray(parsed.attachments)
                ? parsed.attachments
                    .map((a: any) => ({
                      filename: typeof a.filename === "string" ? a.filename : "attachment",
                      contentType: typeof a.contentType === "string" ? a.contentType : "application/octet-stream",
                      content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content || []),
                    }))
                    .filter((a) => a.content && a.content.length > 0)
                : [];
              const outcome = await processInboundEmail(db, {
                fromAddress,
                fromName,
                messageId: parsed.messageId || "",
                refs,
                subject: parsed.subject || "",
                text: parsed.text || "",
                html: parsed.html || "",
                date: parsed.date || new Date(),
                mailboxEmail: String(mailbox.email_address || ""),
                attachments,
              });
              stats.processed += 1;
              if (outcome.status === "matched") stats.matched += 1;
              else if (outcome.status === "duplicate") stats.duplicate += 1;
              else if (outcome.status === "sender_mismatch") stats.senderMismatch += 1;
              else stats.unmatched += 1;
              if (outcome.attachmentsStored) stats.attachmentsStored += outcome.attachmentsStored;
            } catch (parseError: any) {
              console.error("Inbound ticket email parse error:", parseError?.message || parseError);
              stats.processed += 1;
            } finally {
              settle();
            }
          });
          msg.once("end", () => settle());
        });
        tasks.push(task);
      });

      fetch.once("error", (fetchError: Error) => {
        imap.end();
        reject(fetchError);
      });
      fetch.once("end", async () => {
        try {
          await Promise.all(tasks);
        } finally {
          imap.end();
          resolve();
        }
      });
    });
  });

  return stats;
}

export const POST = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();

  // Overlapping syncs are skipped (the poll may overlap a manual or other
  // instance's run; Message-ID dedupe is the real duplicate boundary).
  if (syncInflight) {
    return json({
      success: true,
      data: {
        processed: 0,
        matched: 0,
        duplicate: 0,
        senderMismatch: 0,
        unmatched: 0,
        attachmentsStored: 0,
        errors: [],
        noMailboxes: false,
        skipped: true,
      },
    });
  }
  syncInflight = true;
  try {
    return await runInboundSync(db);
  } finally {
    syncInflight = false;
  }
}, { auth: "required" });

async function runInboundSync(db: any): Promise<Response> {
  // Read-only source of inbound mailboxes: the enabled license-system mailboxes.
  let mailboxes: any[] = [];
  try {
    const pool = await getDb();
    const result = await pool.query(
      `SELECT id, email_address, display_name, imap_host, imap_port, imap_secure, imap_username, imap_password, is_enabled
       FROM mailboxes WHERE is_enabled = TRUE`
    );
    mailboxes = result.rows;
  } catch (error) {
    console.error("Inbound ticket sync: could not read mailboxes:", error);
    return json({
      success: true,
      data: {
        noMailboxes: true,
        message:
          "Inbound email is not configured. Configure an enabled mailbox in the Communications Center, or have clients continue the conversation through the Client Portal.",
      },
    });
  }

  if (mailboxes.length === 0) {
    return json({
      success: true,
      data: {
        noMailboxes: true,
        message: "No enabled mailboxes are configured for inbound email. Configure a mailbox to receive client replies by email.",
      },
    });
  }

  const totals = { processed: 0, matched: 0, duplicate: 0, senderMismatch: 0, unmatched: 0, attachmentsStored: 0 };
  const errors: string[] = [];
  for (const mailbox of mailboxes) {
    try {
      const stats = await syncMailbox(db, mailbox);
      totals.processed += stats.processed;
      totals.matched += stats.matched;
      totals.duplicate += stats.duplicate;
      totals.senderMismatch += stats.senderMismatch;
      totals.unmatched += stats.unmatched;
      totals.attachmentsStored += stats.attachmentsStored;
    } catch (mailboxError: any) {
      errors.push(`${mailbox.email_address}: ${mailboxError?.message || "IMAP sync failed"}`);
    }
  }

  return json({
    success: true,
    data: { ...totals, errors, noMailboxes: false },
  });
}

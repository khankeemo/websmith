import { apiHandler, json, forbidden } from "@/lib/server/api";
import { getDb } from "@/lib/backend-db";
import crypto from "node:crypto";

// ============================================================================
// INBOUND EMAIL SYNC — Query Inbox (Public Website, AWS-01 R01)
//
// Admin-only manual sync that pulls customer email replies into their existing
// Get in Touch / Query Inbox tickets, completing the two-way conversation:
//
//   Client reply email  ->  mailbox IMAP  ->  this route  ->  ticket thread
//
// Matching rules (strict, never subject alone):
//   1. Match by thread: an inbound email whose In-Reply-To / References contain
//      the Message-ID of an outbound admin message stored on a ticket
//      (`messages.providerMessageId`).
//   2. Fallback: the inbound sender email equals the ticket's contactEmail
//      (most recently updated non-deleted ticket wins).
// Sender is ALWAYS verified against the ticket's contactEmail; a mismatched
// sender is never attached to a ticket. Duplicates (same inbound Message-ID
// already stored) are skipped.
//
// The mailboxes source is the license-system PostgreSQL `mailboxes` table,
// READ-ONLY — no mailbox row, credential, SMTP or schema is ever changed here.
// The IMAP mailbox is opened READ-ONLY and messages are NEVER marked Seen, so
// the internal Communications Center sync of the same mailbox is unaffected.
// Unmatched emails stay UNSEEN so they can be re-attempted (e.g. after the
// matching ticket is created).
// ============================================================================

const norm = (value: string) =>
  String(value || "").trim().replace(/^<|>$/g, "").replace(/\s+/g, "").toLowerCase();

function collectIds(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

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
};

type InboundOutcome = {
  status: "matched" | "duplicate" | "sender_mismatch" | "unmatched";
  ticketId?: string;
};

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
  if (!ticket) {
    const fromLower = String(incoming.fromAddress || "").trim().toLowerCase();
    if (fromLower) {
      ticket = await db
        .collection("tickets")
        .find({
          deletedAt: { $exists: false },
          contactEmail: { $regex: `^${fromLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        })
        .sort({ updatedAt: -1 })
        .limit(1)
        .next();
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
  const bodyText = String(incoming.text || incoming.html || "(No content)").trim();

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

  return { status: "matched", ticketId: ticket._id.toString() };
}

type MailboxSyncStats = {
  processed: number;
  matched: number;
  duplicate: number;
  senderMismatch: number;
  unmatched: number;
  error?: string;
};

async function syncMailbox(db: any, mailbox: any): Promise<MailboxSyncStats> {
  const stats: MailboxSyncStats = { processed: 0, matched: 0, duplicate: 0, senderMismatch: 0, unmatched: 0 };

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

      const tasks: Promise<void>[] = [];
      const fetch = imap.fetch(uids, { bodies: "", struct: true });

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
              });
              stats.processed += 1;
              if (outcome.status === "matched") stats.matched += 1;
              else if (outcome.status === "duplicate") stats.duplicate += 1;
              else if (outcome.status === "sender_mismatch") stats.senderMismatch += 1;
              else stats.unmatched += 1;
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

  const totals = { processed: 0, matched: 0, duplicate: 0, senderMismatch: 0, unmatched: 0 };
  const errors: string[] = [];
  for (const mailbox of mailboxes) {
    try {
      const stats = await syncMailbox(db, mailbox);
      totals.processed += stats.processed;
      totals.matched += stats.matched;
      totals.duplicate += stats.duplicate;
      totals.senderMismatch += stats.senderMismatch;
      totals.unmatched += stats.unmatched;
    } catch (mailboxError: any) {
      errors.push(`${mailbox.email_address}: ${mailboxError?.message || "IMAP sync failed"}`);
    }
  }

  return json({
    success: true,
    data: { ...totals, errors, noMailboxes: false },
  });
}, { auth: "required" });

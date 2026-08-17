import { apiHandler, json, forbidden } from "@/lib/server/api";
import { getDb } from "@/lib/backend-db";
import {
  collectIds,
  processInboundEmail,
  type InboundAttachment,
  type InboundMessage,
  type InboundOutcome,
} from "@/lib/tickets/inbound-core";

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

// The shared inbound processing (ticket matching, body cleaning, attachment
// handling, Message-ID dedupe, `messages[]` structure) lives in
// `lib/tickets/inbound-core.ts` and is reused verbatim by the Brevo inbound
// webhook (`/api/brevo/inbound`) so both inbound paths behave identically.
// ============================================================================

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

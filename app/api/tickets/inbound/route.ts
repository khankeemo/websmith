import { apiHandler, json, forbidden } from "@/lib/server/api";
import { after } from "next/server";
import { getDb } from "@/lib/backend-db";
import { runNativeReceiveCycle } from "@/lib/communications/native-receive-core";
import {
  BRIDGE_BATCH_LIMIT,
  bridgeConversationMessages,
  type BridgeMessage,
  type InboundAttachment,
} from "@/lib/tickets/inbound-core";

// ============================================================================
// QUERY TICKET BRIDGE — Query Inbox (Public Website, AWS-01 R01, PHASE 2)
//
// The Query Inbox NEVER receives email. The platform has exactly ONE inbound
// receiver: the UNIVERSAL Websmith email receive system (mailbox IMAP sync
// `POST /internal/backend/mailboxes/[id]/sync` + the public portal
// `POST /api/portal/support-message`), which stores every processed customer
// inbound message in the license-system PostgreSQL tables
// `communication_conversations` / `conversation_messages`.
//
// This route is the live-chat BRIDGE: it reads ALREADY-PROCESSED customer
// conversation messages (PostgreSQL, READ-ONLY — no mailbox row, credential,
// SMTP, IMAP or schema is ever touched here) and synchronizes each one into
// the client's existing Get in Touch / Query Inbox ticket (`messages[]`), so
// Messenger Chat shows the client's email reply live:
//
//   Client reply  ->  support@ / configured mailbox
//     ->  UNIVERSAL receive (PG conversations)
//     ->  this bridge  ->  existing Query Ticket messages[]
//     ->  Messenger Chat (≤1 s target / ≤3 s maximum)
//
// Called silently by the Messenger Chat auto-poll (every 1 second while a
// conversation is open, admin-only).
//
// Matching rules (identity-first, never subject alone):
//   1. The processed conversation's customer email equals the ticket's
//      contactEmail (case-insensitive). Sender verification is inherent: the
//      universal receiver already accepted the message as a customer message
//      on a conversation owned by that address.
//   2. Thread identity tiebreak: among the sender's tickets, the one whose
//      normalized subject matches the conversation subject wins; most recently
//      updated non-deleted ticket as the tiebreak.
// Duplicates are impossible by construction: each append stores the source
// PostgreSQL `conversation_messages.id` as `sourceRef` (`cm:<id>`), and a
// second bridge pass over the same row is skipped.
//
// Inbound bodies are cleaned at BRIDGE time (cleanInboundBody) so the
// Messenger Chat shows ONLY the client's own words. The full email record
// stays in the universal PostgreSQL tables. R02: the cleaner lives in ONE
// shared pure module (`core/services/inboundBodyCleanup.ts`) used by both
// this bridge and the admin UI's display mirror for legacy stored rows.
//
// R02 LIVE SYNC: the auto-poll calls this bridge EVERY tick (~1 s) in EVERY
// UI state (idle + open conversation), so a repeat pass must be nearly free.
// A bounded per-instance seen-set of processed PG message ids short-circuits
// already-bridged rows before any MongoDB work happens (the durable
// `sourceRef` dedupe remains the real boundary — the set is only a cache;
// cold serverless instances simply rebuild it from `sourceRef` checks).
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

// Single-instance guard: overlapping polls (auto-poll + any other trigger)
// never run two bridge passes at once — the second call returns a skipped
// summary immediately. Serverless instances each keep their own flag, which
// is fine: the `sourceRef` dedupe is the real duplicate boundary.
let syncInflight = false;

// ---------------------------------------------------------------------------
// PER-INSTANCE SEEN-SET (R02) — makes an every-second bridge pass nearly free
// when nothing is new. Rows whose PG message id was already bridged (or
// already present as `sourceRef`) on THIS instance skip all MongoDB work.
// Bounded ring: at most BRIDGE_SEEN_MAX ids are remembered per instance; a
// recycled id merely re-runs the cheap durable `sourceRef` check once.
// Only matched/duplicate outcomes are remembered — unmatched rows stay
// un-remembered so they retry (cheaply) until their ticket exists.
// ---------------------------------------------------------------------------
const BRIDGE_SEEN_MAX = 4096;
const bridgeSeenIds: number[] = [];
const bridgeSeenSet = new Set<number>();

function rememberBridgedMessage(pgMessageId: number) {
  if (bridgeSeenSet.has(pgMessageId)) return;
  bridgeSeenSet.add(pgMessageId);
  bridgeSeenIds.push(pgMessageId);
  if (bridgeSeenIds.length > BRIDGE_SEEN_MAX) {
    for (const dropped of bridgeSeenIds.splice(0, bridgeSeenIds.length - BRIDGE_SEEN_MAX)) {
      bridgeSeenSet.delete(dropped);
    }
  }
}

// ---------------------------------------------------------------------------
// ON-DEMAND NATIVE RECEIVE KICK (AWS-01 R01 — FIX email→chat delay)
//
// The universal receiver for native support@/sales@ mail runs on a QStash
// 1-minute cron, so a client email reply could wait up to ~60 s before it even
// reached PostgreSQL (and only then could this bridge copy it into the ticket
// — the observed "email takes ~1 minute to appear" delay).
//
// While an admin actively watches a conversation, each bridge pass schedules
// ONE execution of the SAME single receive cycle (`runNativeReceiveCycle`,
// throttled to one kick per NATIVE_KICK_MIN_MS per serverless instance) via
// `after()` — it never blocks or fails this response. The IMAP cycle stores
// new rows in PostgreSQL within seconds and the NEXT 1-second poll tick
// bridges them, so end-to-end latency drops from ≤60 s to a few seconds.
//
// Still exactly ONE receiver / ONE pipeline: this route never touches IMAP or
// parses mail itself — it only triggers the existing universal cycle. The
// QStash cron remains the baseline receiver (unchanged); Message-ID dedupe
// makes overlapping cycles harmless.
// ---------------------------------------------------------------------------
const NATIVE_KICK_MIN_MS = 10_000;
let lastNativeKick = 0;

function scheduleNativeReceiveKick() {
  const now = Date.now();
  if (now - lastNativeKick < NATIVE_KICK_MIN_MS) return;
  lastNativeKick = now;
  try {
    after(async () => {
      try {
        await runNativeReceiveCycle();
      } catch (kickError: any) {
        console.error("Query ticket bridge: native receive kick failed:", kickError?.message || kickError);
      }
    });
  } catch (afterError: any) {
    // `after()` unavailable in this runtime — the QStash cron still receives.
    console.error("Query ticket bridge: could not schedule native receive kick:", afterError?.message || afterError);
  }
}

export const POST = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();

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
    // Trigger the universal native receive cycle (throttled, post-response) so
    // fresh support@ mail reaches PostgreSQL now instead of at the next cron
    // fire — the next poll tick bridges it into the open conversation.
    scheduleNativeReceiveKick();
    return await runInboundSync(db);
  } finally {
    syncInflight = false;
  }
}, { auth: "required" });

async function runInboundSync(db: any): Promise<Response> {
  const totals: MailboxSyncStats = {
    processed: 0,
    matched: 0,
    duplicate: 0,
    senderMismatch: 0,
    unmatched: 0,
    attachmentsStored: 0,
  };
  const errors: string[] = [];

  // Read-only source: customer messages ALREADY processed by the universal
  // email receive system (PostgreSQL), newest first, capped per pass so the
  // 1-second auto-poll stays light even with a backlog of old processed mail.
  const pool = await getDb();
  let rows: any[] = [];
  try {
    const result = await pool.query(
      `SELECT
         cm.id AS message_id,
         cm.conversation_id,
         cm.sender_name,
         cm.sender_email,
         cm.message,
         cm.created_at,
         COALESCE(NULLIF(cm.sender_email, ''), cc.customer_email) AS from_email,
         cc.customer_name AS conv_customer_name,
         cc.subject AS conv_subject,
         cc.mailbox_id,
         mb.email_address AS mailbox_email
       FROM conversation_messages cm
       JOIN communication_conversations cc ON cc.id = cm.conversation_id
       LEFT JOIN mailboxes mb ON mb.id = cc.mailbox_id
       WHERE cm.sender_type = 'customer'
         AND cm.is_internal IS NOT TRUE
         AND cc.deleted_at IS NULL
       ORDER BY cm.id DESC
       LIMIT $1`,
      [BRIDGE_BATCH_LIMIT]
    );
    rows = result.rows;
  } catch (error: any) {
    console.error("Query ticket bridge: could not read processed conversations:", error);
    return json({
      success: true,
      data: {
        ...totals,
        errors: [`Processed-conversation read failed: ${error?.message || "unknown"}`],
        noMailboxes: false,
      },
    });
  }

  if (rows.length === 0) {
    return json({
      success: true,
      data: {
        ...totals,
        errors: [],
        noMailboxes: true,
        message:
          "No customer messages have been processed by the universal email system yet. Client email replies land here automatically after the universal receive flow processes them (support@ / configured mailboxes).",
      },
    });
  }

  // Newest-first (DESC) -> process ascending so multiple new messages append
  // chronologically to the ticket thread.
  rows.reverse();

  // R02 fast path: when EVERY row in the window was already bridged on this
  // instance, skip the attachment read and all MongoDB work — the pass costs
  // just the two indexed PostgreSQL SELECTs above. `duplicate` is reported for
  // every skipped row so callers see an honest, unchanged summary shape.
  const unseenRows = rows.filter((row) => !bridgeSeenSet.has(Number(row.message_id)));
  if (unseenRows.length === 0) {
    totals.processed = rows.length;
    totals.duplicate = rows.length;
    return json({
      success: true,
      data: { ...totals, errors, noMailboxes: false },
    });
  }

  // Attachment bytes for the whole batch (conversation_attachments.content is
  // the durable BYTEA copy stored by the universal receiver — best-effort,
  // legacy disk-only rows without bytes are skipped).
  const messageIds = unseenRows.map((r) => r.message_id);
  let attachmentRows: any[] = [];
  try {
    const attResult = await pool.query(
      `SELECT message_id, file_name, mime_type, content
       FROM conversation_attachments
       WHERE message_id = ANY($1::int[])`,
      [messageIds]
    );
    attachmentRows = attResult.rows;
  } catch (error: any) {
    console.error("Query ticket bridge: could not read conversation attachments:", error);
    errors.push(`Attachment read failed: ${error?.message || "unknown"}`);
  }
  const attByMessage = new Map<number, any[]>();
  for (const a of attachmentRows) {
    const list = attByMessage.get(a.message_id) || [];
    list.push(a);
    attByMessage.set(a.message_id, list);
  }

  for (const row of unseenRows) {
    const attachments: InboundAttachment[] = (attByMessage.get(row.message_id) || [])
      .filter((a) => Buffer.isBuffer(a.content) && a.content.length > 0)
      .map((a) => ({
        filename: String(a.file_name || "attachment"),
        contentType: String(a.mime_type || "application/octet-stream"),
        content: a.content,
      }));

    const item: BridgeMessage = {
      pgMessageId: Number(row.message_id),
      fromEmail: String(row.from_email || "").trim(),
      fromName: String(row.sender_name || row.conv_customer_name || "").trim(),
      subject: String(row.conv_subject || "").trim(),
      body: String(row.message || ""),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      mailboxEmail: String(row.mailbox_email || "").trim(),
      attachments,
    };

    totals.processed += 1;
    try {
      const outcome = await bridgeConversationMessages(db, item);
      if (outcome.status === "matched") {
        totals.matched += 1;
        rememberBridgedMessage(item.pgMessageId);
      } else if (outcome.status === "duplicate") {
        totals.duplicate += 1;
        rememberBridgedMessage(item.pgMessageId);
      } else {
        // Unmatched: NOT remembered — retried cheaply on a later pass until
        // the matching ticket exists.
        totals.unmatched += 1;
      }
      if (outcome.attachmentsStored) totals.attachmentsStored += outcome.attachmentsStored;
    } catch (bridgeError: any) {
      console.error("Query ticket bridge error:", bridgeError?.message || bridgeError);
      errors.push(`Message ${row.message_id}: ${bridgeError?.message || "bridge failed"}`);
    }
  }

  return json({
    success: true,
    data: { ...totals, errors, noMailboxes: false },
  });
}
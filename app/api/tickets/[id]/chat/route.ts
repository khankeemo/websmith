// app/api/tickets/[id]/chat/route.ts
// PURPOSE: PUBLIC-but-token-gated endpoint for the SECURE PUBLIC CLIENT
//          MESSENGER CHAT (AWS-01 R01 — Phase 2). The chat link token (signed
//          with the existing JWT_SECRET, bound to ticketId + customer email)
//          is the ONLY access credential — no account, no password, no cookie
//          required. A caller can ONLY read/send the ONE ticket the token was
//          issued for; other conversations / customers are unreachable.
//
//          GET  → the customer's own sanitized conversation thread.
//          POST → appends a client message to the SAME `messages[]` array the
//                 Query Inbox already renders (reuses the existing ticket
//                 conversation backend — no duplicate chat backend, no email
//                 dependency). The admin Query Inbox auto-poll surfaces the new
//                 message within ~1s; admin replies appear here on the next poll.
//
//          Never leaks history/resolution/delivery internals/admin credentials.
//          No schema change; no email/SMTP/IMAP/mailbox changes.
import { apiHandler, json, jsonBody, badRequest, notFound, parseObjectId, unauthorized } from "@/lib/server/api";
import { verifyChatToken, resolveTicketClientEmail, sanitizeChatConversation } from "@/lib/tickets/chat";
import crypto from "node:crypto";

const MAX_MESSAGE_LEN = 20000;
const RATE_LIMIT = { max: 10, windowMs: 60 * 1000 };
const tokenHits = new Map<string, { count: number; resetAt: number }>();

function isRateAllowed(key: string): boolean {
  const now = Date.now();
  const entry = tokenHits.get(key);
  if (!entry || entry.resetAt < now) {
    tokenHits.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT.max;
}

// The token may arrive via the Authorization header (POST) or the `?token=`
// query param (initial page load). Both are verified identically.
function readChatToken(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token") || "";
  const auth = request.headers.get("authorization") || "";
  const fromHeader = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return fromHeader || fromQuery;
}

async function authorizeChat(db: any, request: Request, ticketId: string) {
  const payload = verifyChatToken(readChatToken(request));
  if (!payload || payload.ticketId !== ticketId) {
    throw unauthorized("This conversation link is invalid or has expired.");
  }
  const ticket = await db.collection("tickets").findOne({ _id: parseObjectId(ticketId) });
  if (!ticket || ticket.deletedAt) throw notFound("Conversation not found.");
  const email = resolveTicketClientEmail(ticket);
  if (!email || email !== payload.email) {
    throw unauthorized("This conversation link is invalid or has expired.");
  }
  return { ticket, email };
}

export const GET = apiHandler(async ({ db, request, params }) => {
  const { ticket } = await authorizeChat(db, request, params.id);
  return json({ data: sanitizeChatConversation(ticket) });
});

export const POST = apiHandler(async ({ db, request, params }) => {
  const { ticket, email } = await authorizeChat(db, request, params.id);

  const key = `${params.id}:${email}`;
  if (!isRateAllowed(key)) {
    return json(
      { success: false, error: "Too many messages. Please try again shortly.", message: "Too many messages. Please try again shortly." },
      { status: 429 }
    );
  }

  const body = await jsonBody(request);
  const message = String(body?.message ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!message) throw badRequest("Message is required");
  if (message.length > MAX_MESSAGE_LEN) throw badRequest("Message is too long");

  const now = new Date();
  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  messages.push({
    id: crypto.randomUUID(),
    senderType: "client",
    direction: "inbound",
    senderEmail: email,
    senderName: String(ticket.contactName || "Valued Customer"),
    recipientEmail: "",
    message,
    createdAt: now,
    source: "chat",
  });

  const update: any = {
    messages,
    lastClientReplyAt: now,
    updatedAt: now,
  };
  // A new client message reopens a closed conversation (mirrors the existing
  // portal-reply behavior in /tickets/[id]/replies).
  if (ticket.status === "closed") {
    update.status = "in_progress";
    update.chatStatus = "open";
  }
  const history = ticket.history ?? [];
  history.push({ action: "client_reply", actorRole: "client", message: "Replied via secure chat", createdAt: now });
  update.history = history;

  const result = await db.collection("tickets").findOneAndUpdate(
    { _id: parseObjectId(params.id) },
    { $set: update },
    { returnDocument: "after" }
  );
  return json({ data: sanitizeChatConversation(result) });
});
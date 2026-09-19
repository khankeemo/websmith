// lib/tickets/chat.ts
// PURPOSE: Shared server helpers for the SECURE PUBLIC CLIENT MESSENGER CHAT
//          (AWS-01 R01 — Phase 2). The chat link is a signed, short-lived token
//          that is cryptographically bound to ONE ticket + ONE client email.
//
//          It REUSES the existing website auth infrastructure (same JWT_SECRET
//          used by lib/website-auth.ts signToken and the website session
//          cookie) — no new session system, no new secret, no client accounts.
//          The browser never receives admin credentials, temporary passwords,
//          internal history, resolution text, delivery internals or any other
//          customer's data: only the sanitized thread of the token's own ticket.

import jwt from "jsonwebtoken";

export const CHAT_TOKEN_PURPOSE = "client_chat";
// 30-day signed link. Re-generating the link (admin → Copy Chat Link) issues a
// fresh token; the old one expires naturally.
export const CHAT_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface ChatTokenPayload {
  purpose: typeof CHAT_TOKEN_PURPOSE;
  ticketId: string;
  email: string;
}

/** Sign a chat-link token bound to exactly one ticket + one client email. */
export function signChatToken(ticketId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return jwt.sign(
    { purpose: CHAT_TOKEN_PURPOSE, ticketId, email },
    secret,
    { expiresIn: CHAT_TOKEN_MAX_AGE_SECONDS }
  );
}

/**
 * Verify a chat-link token. Returns the normalized bound identity or null when
 * the token is missing, expired, tampered with, or not a chat token.
 */
export function verifyChatToken(token: string): ChatTokenPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret) as Record<string, any>;
    if (payload?.purpose !== CHAT_TOKEN_PURPOSE) return null;
    const ticketId = String(payload.ticketId ?? "").trim();
    const email = String(payload.email ?? "").trim().toLowerCase();
    if (!ticketId || !email) return null;
    return { purpose: CHAT_TOKEN_PURPOSE, ticketId, email };
  } catch {
    return null;
  }
}

/** Resolve the ticket's customer contact email (normalized, lowercased). */
export function resolveTicketClientEmail(ticket: any): string {
  return String(ticket?.contactEmail || ticket?.clientEmail || "")
    .trim()
    .toLowerCase();
}

/** Normalize an origin passed by callers (defensive; never trusted for auth). */
export function normalizeChatOrigin(value: unknown, fallback = "https://www.websmithdigital.com"): string {
  const raw = String(value ?? "").trim();
  if (/^https?:\/\/[^\s/]+/i.test(raw)) return raw.replace(/\/+$/, "");
  return fallback;
}

/**
 * Build a full secure chat URL for a ticket (used to fill the `{{chat_url}}`
 * placeholder of the First Welcome / reply templates). Returns "" when the
 * ticket has no resolvable email or no JWT_SECRET — the caller keeps the link
 * line out of the rendered copy in that case.
 */
export function buildChatUrl(ticket: any, origin?: unknown): string {
  try {
    const email = resolveTicketClientEmail(ticket);
    const ticketId = String(ticket?._id ?? "").trim();
    if (!email || !ticketId) return "";
    const token = signChatToken(ticketId, email);
    const base = normalizeChatOrigin(origin);
    return `${base}/chat/${ticketId}?token=${encodeURIComponent(token)}`;
  } catch {
    return "";
  }
}

/**
 * Strip a ticket down to ONLY what the customer's own chat may see. No
 * history, no resolution, no delivery status, no provider/source internals, no
 * IDs beyond the link's own ticket, no other customer data.
 */
export function sanitizeChatConversation(ticket: any) {
  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  const thread = messages
    .filter((m: any) => m && typeof m.message === "string" && m.message.trim())
    .map((m: any) => ({
      id: String(m.id || ""),
      senderType: m.senderType === "admin" || m.senderType === "developer" ? "admin" : "client",
      senderName: String(
        m.senderName ||
          (m.senderType === "admin" ? "Websmith Digital Support" : "You")
      ),
      message: m.message,
      createdAt:
        m.createdAt instanceof Date
          ? m.createdAt.toISOString()
          : new Date(m.createdAt).toISOString(),
      attachments: (Array.isArray(m.attachments) ? m.attachments : [])
        .map((a: any) => ({
          name: String(a?.name || "attachment"),
          url: String(a?.url || ""),
        }))
        .filter((a: any) => a.url),
    }))
    .sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  return {
    ticketId: String(ticket._id),
    subject: String(ticket.subject || "Conversation"),
    status: String(ticket.status || "open"),
    contactName: String(ticket.contactName || "Valued Customer"),
    contactEmail: resolveTicketClientEmail(ticket),
    createdAt:
      ticket.createdAt instanceof Date
        ? ticket.createdAt.toISOString()
        : new Date(ticket.createdAt).toISOString(),
    messages: thread,
  };
}
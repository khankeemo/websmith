// app/api/tickets/[id]/messages/route.ts
// PURPOSE: INCREMENTAL message fetch for the Query Inbox Messenger Chat
//          (AWS-01 R01 — FIX /admin/messages SLOW LOADING + REAL-TIME).
//          Admin-only. Returns ONLY the messages of ONE conversation that are
//          NEWER than the caller's cursor (`?after=<ISO timestamp>`), plus the
//          lightweight ticket metadata the card needs (updatedAt /
//          lastClientReplyAt / hasNewClientReply / status).
//
//          The Messenger Chat 1-second auto-poll uses this instead of
//          re-downloading the whole conversation every second: the full thread
//          is fetched once on conversation open (via the existing `?ids=` list
//          filter) and only delta messages are fetched thereafter. Duplicate
//          protection is by the EXISTING message `id` on the client (a new id
//          is appended once, an existing id is never re-appended).
//
//          No schema change; no email/SMTP/IMAP/mailbox/chat infrastructure
//          change; the existing ticket conversation backend is untouched.
import { apiHandler, json, badRequest, forbidden, notFound, parseObjectId } from "@/lib/server/api";
import { hasNewClientReply } from "../../route";

export const GET = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const url = new URL(request.url);
  const afterRaw = String(url.searchParams.get("after") || "").trim();
  let afterMs = 0;
  if (afterRaw) {
    const parsed = new Date(afterRaw).getTime();
    if (Number.isNaN(parsed)) throw badRequest("Invalid after timestamp");
    afterMs = parsed;
  }

  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Conversation not found");

  const messages = (Array.isArray(ticket.messages) ? ticket.messages : [])
    .filter((m: any) => new Date(m.createdAt || 0).getTime() > afterMs)
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return json({
    data: {
      messages,
      updatedAt: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : undefined,
      lastClientReplyAt: ticket.lastClientReplyAt ? new Date(ticket.lastClientReplyAt).toISOString() : null,
      hasNewClientReply: hasNewClientReply(ticket),
      status: ticket.status,
    },
  });
}, { auth: "required" });
// app/api/tickets/[id]/chat-link/route.ts
// PURPOSE: ADMIN-ONLY "Copy Chat Link" — generates the secure Public Client
//          Messenger Chat link for one ticket. The link is a signed token bound
//          to the ticket id + the customer's contact email (30 days), so the
//          customer opens their OWN conversation directly with no login page and
//          can never see any other conversation. Admin role required (reuses the
//          existing website JWT session); no business logic changed.
import { apiHandler, jsonBody, json, badRequest, forbidden, notFound, parseObjectId } from "@/lib/server/api";
import { signChatToken, resolveTicketClientEmail, normalizeChatOrigin } from "@/lib/tickets/chat";

export const POST = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");
  if (ticket.deletedAt) throw notFound("Ticket not found");

  const email = resolveTicketClientEmail(ticket);
  if (!email) throw badRequest("No contact email on this ticket");

  let origin = "";
  try {
    const body = await jsonBody(request);
    origin = String(body?.origin ?? "");
  } catch {
    // Origin is optional; a malformed body simply falls back to the default.
  }
  const base = normalizeChatOrigin(origin, "https://www.websmithdigital.com");
  const token = signChatToken(id.toString(), email);
  const url = `${base}/chat/${id.toString()}?token=${encodeURIComponent(token)}`;
  return json({ url });
}, { auth: "required" });
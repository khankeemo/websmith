import { apiHandler, jsonBody, json, badRequest, notFound, parseObjectId } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/brevo";
import { stripAdminMarkers } from "@/lib/tickets/email";
import crypto from "node:crypto";

export const POST = apiHandler(async ({ db, request, user, params }) => {
  const body = await jsonBody(request);
  const message = String(body.message ?? "").trim();
  if (!message) throw badRequest("Reply message is required");
  if (message.length > 20000) throw badRequest("Reply message is too long");
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const now = new Date();
  const history = ticket.history ?? [];
  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];

  // Only ADMIN replies are emailed out to the customer (the required flow:
  // Admin -> Reply -> Backend -> Existing Email Provider -> Client). Client /
  // developer replies are inbound and never trigger a customer email.
  let emailDelivered = false;
  let emailError = "";
  let providerMessageId = "";
  let emailSnapshot: { recipient?: string; subject?: string; emailBody?: string } = {};
  if (user.role === "admin") {
    const recipient = String(ticket.contactEmail || ticket.clientEmail || "").trim();
    if (!recipient) {
      emailError = "No contact email on this ticket";
    } else {
      const customerMessage = stripAdminMarkers(message);
      const emailSubject = `Re: ${ticket.subject || "Support Request"}`;
      const sendResult = await sendEmail(
        db,
        "support_reply",
        { email: recipient, name: ticket.contactName || "Valued Customer" },
        {
          customer_name: ticket.contactName || "Valued Customer",
          request_id: ticket._id.toString(),
          subject: ticket.subject || "Support Request",
          // Admin/editor markers are never sent to the customer.
          message: customerMessage,
        }
      );
      emailDelivered = sendResult.success;
      providerMessageId = sendResult.messageId || "";
      if (!sendResult.success) emailError = sendResult.error || "Email delivery failed";
      // Stored snapshot for the Resend action (Phase 13) -- resends exactly
      // what was sent, never stale/arbitrary UI text.
      emailSnapshot = {
        recipient,
        subject: emailSubject,
        emailBody: customerMessage,
      };
    }
  }

  history.push({
    action: "reply",
    actorRole: user.role,
    message,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    emailDelivered,
    emailError: emailError || undefined,
    ...emailSnapshot,
    createdAt: now,
  });

  // Canonical thread entry (Query Inbox message bubbles). Admin replies are
  // outbound email messages (delivery status + Brevo message id for inbound
  // thread matching); client/developer replies are inbound local messages.
  messages.push({
    id: crypto.randomUUID(),
    senderType: user.role === "admin" ? "admin" : user.role === "developer" ? "developer" : "client",
    direction: user.role === "admin" ? "outbound" : "inbound",
    senderEmail: user.role === "admin" ? "" : String(ticket.contactEmail || user.email || "").trim(),
    senderName: String(user.name || (user.role === "admin" ? "Websmith Support Team" : "Customer")),
    recipientEmail: user.role === "admin" ? String(ticket.contactEmail || "").trim() : "",
    message,
    createdAt: now,
    source: user.role === "admin" ? "admin_reply" : "portal",
    deliveryStatus: user.role === "admin" ? (emailDelivered ? "sent" : emailError ? "failed" : "not_sent") : undefined,
    deliveryError: emailError || undefined,
    providerMessageId: providerMessageId || undefined,
  });

  const update: any = { history, messages, updatedAt: now };
  if (user.role === "admin") {
    update.lastEmailDelivered = emailDelivered;
    update.lastEmailError = emailError || null;
    update.adminReadAt = now;
  }
  if (ticket.status === "closed") update.status = "in_progress";

  const result = await db.collection("tickets").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  return json({ data: { ...result, _id: result._id.toString(), emailDelivered, emailError: emailError || undefined } });
}, { auth: "required" });

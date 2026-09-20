import { apiHandler, jsonBody, json, badRequest, notFound, parseObjectId } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/mailer";
import { stripAdminMarkers, ticketRequestLabel } from "@/lib/tickets/email";
import { getDb } from "@/lib/backend-db";
import crypto from "node:crypto";

// Resolve the reply's From identity so the client's reply physically loops
// back to the SAME inbox the Messenger Chat polls. The inbound sync
// (/api/tickets/inbound) reads ONLY enabled PostgreSQL `mailboxes` — when the
// resolved support address (Manage Page contact_info.email, env fallback)
// matches an enabled mailbox, the reply is sent FROM that mailbox's real
// address, closing the loop: Client reply -> that inbox -> inbound sync ->
// this ticket -> Messenger Chat. When no enabled mailbox matches, the default
// support sender is used unchanged (client replies then reach the domain's
// configured support inbox / forwarding chain).
async function resolveReplySender(db: any): Promise<{ email: string; name?: string } | null> {
  try {
    const contactInfo = await db.collection("settings").findOne({ key: "contact_info" });
    const supportAddress = String(
      contactInfo?.value?.email ||
      process.env.MAIL_SUPPORT_ADDRESS ||
      process.env.SENDER_EMAIL ||
      "support@websmithdigital.com"
    )
      .trim()
      .toLowerCase();
    if (!supportAddress) return null;
    const pool = await getDb();
    const result = await pool.query(
      `SELECT email_address, display_name FROM mailboxes WHERE is_enabled = TRUE`
    );
    const match = result.rows.find(
      (row: any) => String(row.email_address || "").trim().toLowerCase() === supportAddress
    );
    if (!match) return null;
    const email = String(match.email_address || "").trim();
    if (!email) return null;
    const name = String(match.display_name || "").trim();
    return { email, ...(name ? { name } : {}) };
  } catch (error) {
    console.error("Reply sender mailbox lookup failed (default sender used):", error);
    return null;
  }
}

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
      // Send FROM the enabled inbound mailbox that the chat polls (when its
      // address matches the resolved support address) so the client's reply
      // loops back to the same inbox and appears in Messenger Chat.
      const fromOverride = await resolveReplySender(db);
      const sendResult = await sendEmail(
        db,
        "support_reply",
        { email: recipient, name: ticket.contactName || "Valued Customer" },
        {
          customer_name: ticket.contactName || "Valued Customer",
          request_id: ticketRequestLabel(ticket),
          subject: ticket.subject || "Support Request",
          // Admin/editor markers are never sent to the customer.
          message: customerMessage,
        },
        fromOverride ? { from: fromOverride } : {}
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
  // outbound email messages (delivery status + SMTP message id for inbound
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
  if (ticket.status === "closed") {
    update.status = "in_progress";
    update.chatStatus = "open";
  }

  const result = await db.collection("tickets").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  return json({ data: { ...result, _id: result._id.toString(), emailDelivered, emailError: emailError || undefined } });
}, { auth: "required" });

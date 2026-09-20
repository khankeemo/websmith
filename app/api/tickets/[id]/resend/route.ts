import { apiHandler, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/mailer";
import { resolutionHtmlBody, ticketRequestLabel } from "@/lib/tickets/email";
import crypto from "node:crypto";

// ============================================================================
// RESEND (Phase 13)
//
// Resends the LAST stored customer-facing email for the conversation using its
// stored snapshot (recipient / subject / message body) -- never arbitrary or
// stale UI text. The snapshot is captured at send time by the reply,
// resolution-email and onboarding routes. Honest delivery result is returned.
// ============================================================================
const EMAIL_ACTIONS = new Set(["reply", "resolution_email", "onboarding_email"]);

export const POST = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const history = Array.isArray(ticket.history) ? ticket.history : [];
  const emailEntry = [...history].reverse().find(
    (entry) => EMAIL_ACTIONS.has(String(entry.action)) && entry.recipient && entry.emailSubject && entry.emailBody
  );

  if (!emailEntry) {
    return json({ success: false, error: "No previous email to resend", message: "No previous email to resend" }, { status: 400 });
  }

  const recipient = String(emailEntry.recipient).trim().toLowerCase();
  const subject = String(emailEntry.emailSubject).trim();
  const bodyText = String(emailEntry.emailBody).trim();
  const clientName = String(ticket.contactName || "Valued Customer").trim();

  const sendResult = await sendEmail(
    db,
    "support_reply",
    { email: recipient, name: clientName },
    {
      customer_name: clientName,
      request_id: ticketRequestLabel(ticket),
      subject,
      message: bodyText,
    },
    { custom: { subject, html: resolutionHtmlBody(subject, bodyText), plainText: bodyText } }
  );

  const now = new Date();
  history.push({
    action: "resend",
    actorRole: "admin",
    originalAction: String(emailEntry.action),
    message: `Email "${subject}" resent to ${recipient}`,
    recipient,
    emailSubject: subject,
    emailBody: bodyText,
    emailDelivered: sendResult.success,
    emailError: sendResult.success ? undefined : sendResult.error,
    createdAt: now,
  });

  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  messages.push({
    id: crypto.randomUUID(),
    senderType: "admin",
    direction: "outbound",
    senderEmail: "",
    senderName: String(ticket.contactName || "Websmith Team"),
    recipientEmail: recipient,
    message: bodyText,
    createdAt: now,
    source: "resend",
    deliveryStatus: sendResult.success ? "sent" : "failed",
    deliveryError: sendResult.success ? undefined : sendResult.error,
    providerMessageId: sendResult.messageId || undefined,
  });

  await db.collection("tickets").updateOne(
    { _id: id },
    {
      $set: {
        history,
        messages,
        updatedAt: now,
        adminReadAt: now,
        lastEmailDelivered: sendResult.success,
        lastEmailError: sendResult.success ? null : (sendResult.error || "Email delivery failed"),
      },
    }
  );

  if (!sendResult.success) {
    return json(
      {
        success: false,
        error: "Failed to resend email",
        message: "Failed to resend email",
        emailDelivered: false,
        emailError: sendResult.error,
        recipient,
        subject,
      },
      { status: 502 }
    );
  }
  return json({ message: "Email resent", emailDelivered: true, recipient, subject });
}, { auth: "required" });

import { apiHandler, jsonBody, json, badRequest, notFound, parseObjectId } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/brevo";

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

  // Only ADMIN replies are emailed out to the customer (the required flow:
  // Admin -> Reply -> Backend -> Existing Email Provider -> Client). Client /
  // developer replies are inbound and never trigger a customer email.
  let emailDelivered = false;
  let emailError = "";
  if (user.role === "admin") {
    const recipient = String(ticket.contactEmail || ticket.clientEmail || "").trim();
    if (!recipient) {
      emailError = "No contact email on this ticket";
    } else {
      const sendResult = await sendEmail(
        db,
        "support_reply",
        { email: recipient, name: ticket.contactName || "Valued Customer" },
        {
          customer_name: ticket.contactName || "Valued Customer",
          request_id: ticket._id.toString(),
          subject: ticket.subject || "Support Request",
          message,
        }
      );
      emailDelivered = sendResult.success;
      if (!sendResult.success) emailError = sendResult.error || "Email delivery failed";
    }
  }

  history.push({
    action: "reply",
    actorRole: user.role,
    message,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    emailDelivered,
    emailError: emailError || undefined,
    createdAt: now,
  });

  const update: any = { history, updatedAt: now };
  if (user.role === "admin") {
    update.lastEmailDelivered = emailDelivered;
    update.lastEmailError = emailError || null;
  }
  if (ticket.status === "closed") update.status = "in_progress";

  const result = await db.collection("tickets").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  return json({ data: { ...result, _id: result._id.toString(), emailDelivered, emailError: emailError || undefined } });
}, { auth: "required" });

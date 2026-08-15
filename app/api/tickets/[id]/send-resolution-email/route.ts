import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/brevo";

export const POST = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const resolution =
    String(body.resolution ?? "").trim() ||
    String(ticket.resolution ?? "").trim() ||
    String(ticket.description ?? "").trim();
  if (!resolution) {
    return json({ success: false, error: "A resolution message is required", message: "A resolution message is required" }, { status: 400 });
  }
  if (resolution.length > 20000) {
    return json({ success: false, error: "Resolution message is too long", message: "Resolution message is too long" }, { status: 400 });
  }

  const recipient = String(ticket.contactEmail || ticket.clientEmail || "").trim();
  if (!recipient) {
    return json({ success: false, error: "No contact email on this ticket", message: "No contact email on this ticket" }, { status: 400 });
  }

  const sendResult = await sendEmail(
    db,
    "support_reply",
    { email: recipient, name: ticket.contactName || "Valued Customer" },
    {
      customer_name: ticket.contactName || "Valued Customer",
      request_id: ticket._id.toString(),
      subject: ticket.subject || "Support Request",
      message: resolution,
    }
  );

  const now = new Date();
  const history = ticket.history ?? [];
  history.push({
    action: "resolution_email",
    actorRole: "admin",
    message: `Resolution email sent: ${resolution}`,
    emailDelivered: sendResult.success,
    emailError: sendResult.success ? undefined : sendResult.error,
    createdAt: now,
  });

  await db.collection("tickets").updateOne(
    { _id: id },
    {
      $set: {
        resolution: ticket.resolution || resolution,
        history,
        updatedAt: now,
        lastEmailDelivered: sendResult.success,
        lastEmailError: sendResult.success ? null : (sendResult.error || "Email delivery failed"),
      },
    }
  );

  if (!sendResult.success) {
    return json({
      success: false,
      error: "Failed to send resolution email",
      message: "Failed to send resolution email",
      emailDelivered: false,
      emailError: sendResult.error,
    }, { status: 502 });
  }
  return json({ message: "Resolution email sent", emailDelivered: true });
}, { auth: "required" });

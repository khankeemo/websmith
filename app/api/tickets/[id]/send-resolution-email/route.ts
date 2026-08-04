import { apiHandler, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const recipientEmail = ticket.contactEmail || ticket.clientEmail;
  if (!recipientEmail) return json({ success: false, error: "No contact email on this ticket", message: "No contact email on this ticket" }, { status: 400 });

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) return json({ success: false, error: "Email service not configured", message: "Email service not configured" }, { status: 500 });
  const SENDER_EMAIL = process.env.SENDER_EMAIL || "support@websmithdigital.com";

  const text = ticket.resolution || ticket.description || "Your request has been resolved.";
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: "Websmith Digital" },
      to: [{ email: recipientEmail }],
      subject: `[${ticket.subject}] Resolution`,
      htmlContent: `<div style="font-family:sans-serif;padding:24px"><h2>Your ticket has been resolved</h2><p><strong>Subject:</strong> ${ticket.subject}</p><div style="padding:16px;background:#f5f5f5;border-radius:8px">${text}</div></div>`,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error("Brevo resolution email error:", response.status, errText);
    return json({ success: false, error: "Failed to send resolution email", message: "Failed to send resolution email" }, { status: 502 });
  }

  await db.collection("tickets").updateOne({ _id: id }, { $set: { updatedAt: new Date() } });
  return json({ message: "Resolution email sent" });
}, { auth: "required" });

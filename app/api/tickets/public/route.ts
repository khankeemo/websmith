import { apiHandler, jsonBody, json } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, request }) => {
  const body = await jsonBody(request);
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const contactName = String(body.name ?? "").trim();
  const contactEmail = String(body.email ?? "").trim();
  if (!subject || !message || !contactName || !contactEmail || !contactEmail.includes("@")) {
    return json({ success: false, error: "Name, email, subject and message are required", message: "Name, email, subject and message are required" }, { status: 400 });
  }
  const ticket = {
    source: "public_contact",
    clientId: null,
    contactName,
    contactEmail,
    contactCompany: String(body.company ?? "").trim(),
    developerId: null,
    projectId: null,
    subject,
    description: message,
    priority: "medium",
    status: "open",
    chatStatus: "open",
    resolution: null,
    closedAt: null,
    attachments: [],
    history: [{ action: "created", actorRole: "client", message: "Ticket created from public contact form", createdAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection("tickets").insertOne(ticket);
  return json({ data: { ...ticket, _id: result.insertedId.toString() } }, { status: 201 });
});

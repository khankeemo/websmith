import { apiHandler, jsonBody, json, badRequest } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  const filter: any = {};
  if (user.role === "client") {
    filter.$or = [{ clientId: user._id.toString() }, { contactEmail: user.email }];
  } else if (user.role === "developer") {
    filter.developerId = user._id.toString();
  }
  const tickets = await db.collection("tickets").find(filter).sort({ updatedAt: -1 }).toArray();
  return json({ data: tickets.map((t) => ({ ...t, _id: t._id.toString() })) });
}, { auth: "required" });

export const POST = apiHandler(async ({ db, request, user }) => {
  const body = await jsonBody(request);
  const subject = String(body.subject ?? "").trim();
  const description = String(body.description ?? "").trim();
  if (!subject || !description) throw badRequest("Subject and description are required");
  const now = new Date();
  const doc = {
    source: "client_portal",
    clientId: user._id.toString(),
    contactName: user.name,
    contactEmail: user.email,
    contactCompany: user.company ?? "",
    developerId: null,
    projectId: body.projectId ? String(body.projectId) : null,
    subject,
    description,
    priority: ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium",
    status: "open",
    chatStatus: "open",
    resolution: null,
    closedAt: null,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    history: [{ action: "created", actorRole: "client", message: "Ticket created", createdAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection("tickets").insertOne(doc);
  return json({ data: { ...doc, _id: result.insertedId.toString() } }, { status: 201 });
}, { auth: "required" });

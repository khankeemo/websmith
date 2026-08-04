import { apiHandler, jsonBody, json, badRequest, notFound, parseObjectId } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, request, user, params }) => {
  const body = await jsonBody(request);
  const message = String(body.message ?? "").trim();
  if (!message) throw badRequest("Reply message is required");
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const history = ticket.history ?? [];
  history.push({
    action: "reply",
    actorRole: user.role,
    message,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    createdAt: new Date(),
  });

  const update: any = { history, updatedAt: new Date() };
  if (ticket.status === "closed") update.status = "in_progress";

  const result = await db.collection("tickets").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });

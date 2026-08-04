import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

const STATUSES = ["open", "in_progress", "resolved", "closed"];

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const status = String(body.status ?? "");
  if (!STATUSES.includes(status)) return json({ success: false, error: "Invalid status", message: "Invalid status" }, { status: 400 });

  const update: any = { status, updatedAt: new Date() };
  if (typeof body.resolution === "string") update.resolution = body.resolution;
  if (status === "closed") update.closedAt = new Date();
  if (status === "resolved") update.chatStatus = "closed";

  const history = ticket.history ?? [];
  history.push({
    action: status === "closed" ? "closed" : "status_change",
    actorRole: "admin",
    message: body.reopenMessage ?? `Status changed to ${status}`,
    createdAt: new Date(),
  });
  update.history = history;

  const result = await db.collection("tickets").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });

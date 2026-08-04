import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId, badRequest } from "@/lib/server/api";

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role === "client") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const status = String(body.status ?? "");
  if (!["pending", "in-progress", "completed", "review"].includes(status)) throw badRequest("Invalid task status");
  const update: any = { status, updatedAt: new Date() };
  if (status === "completed") {
    update.completedAt = new Date();
    if (typeof body.completionNote === "string") update.completionNote = body.completionNote;
  }
  const result = await db.collection("tasks").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  if (!result) throw notFound("Task not found");
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });

import { apiHandler, jsonBody, json, forbidden, badRequest, ObjectId } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, request, user }) => {
  if (user.role === "client") throw forbidden();
  const body = await jsonBody(request);
  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (updates.length === 0) throw badRequest("No updates provided");
  for (const update of updates) {
    if (!ObjectId.isValid(update.id)) continue;
    const set: any = { updatedAt: new Date() };
    if (typeof update.status === "string") set.status = update.status;
    if (set.status === "completed") set.completedAt = new Date();
    await db.collection("tasks").updateOne({ _id: new ObjectId(update.id) }, { $set: set });
  }
  return json({ message: "Tasks updated" });
}, { auth: "required" });

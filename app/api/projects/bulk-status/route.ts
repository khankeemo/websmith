import { apiHandler, jsonBody, json, forbidden, badRequest, ObjectId } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, request, user }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (updates.length === 0) throw badRequest("No updates provided");
  for (const update of updates) {
    if (!ObjectId.isValid(update.id)) continue;
    const set: any = { updatedAt: new Date() };
    if (typeof update.status === "string") set.status = update.status;
    if (update.progress !== undefined) set.progress = Math.min(100, Math.max(0, Number(update.progress)));
    await db.collection("projects").updateOne({ _id: new ObjectId(update.id) }, { $set: set });
  }
  return json({ message: "Projects updated" });
}, { auth: "required" });

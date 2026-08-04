import { apiHandler, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const PATCH = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const result = await db
    .collection("notifications")
    .findOneAndUpdate(
      { _id: id, recipientId: user._id.toString() },
      { $set: { isRead: true, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
  if (!result) throw notFound("Notification not found");
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });

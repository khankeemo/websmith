import { apiHandler, json, notFound, parseObjectId } from "@/lib/server/api";

const markRead = apiHandler(async ({ db, user, params }) => {
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

export const PATCH = markRead;
export const POST = markRead;

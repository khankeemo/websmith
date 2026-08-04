import { apiHandler, json } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, user }) => {
  const result = await db
    .collection("notifications")
    .updateMany({ recipientId: user._id.toString(), isRead: { $ne: true } }, { $set: { isRead: true, updatedAt: new Date() } });
  return json({ message: "All notifications marked as read", data: { modified: result.modifiedCount } });
}, { auth: "required" });

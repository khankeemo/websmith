import { apiHandler, json } from "@/lib/server/api";

export const PATCH = apiHandler(async ({ db, user, params }) => {
  const me = user._id.toString();
  const peerId = params.peerId;
  await db.collection("messages").updateMany(
    { senderId: peerId, receiverId: me, status: { $ne: "read" } },
    { $set: { status: "read", readAt: new Date().toISOString() } }
  );
  return json({ message: "Conversation marked as read" });
}, { auth: "required" });

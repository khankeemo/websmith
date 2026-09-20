import { apiHandler, jsonBody, json, badRequest, notFound, forbidden, ObjectId } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user, params }) => {
  const me = user._id.toString();
  const peerId = params.peerId;
  if (!ObjectId.isValid(peerId)) throw badRequest("Invalid peer ID");
  const messages = await db
    .collection("messages")
    .find({
      $or: [
        { senderId: me, receiverId: peerId },
        { senderId: peerId, receiverId: me },
      ],
    })
    .sort({ timestamp: 1 })
    .limit(200)
    .toArray();
  return json({ data: messages.map((m) => ({ ...m, _id: m._id.toString() })) });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  const messageId = params.peerId;
  if (!ObjectId.isValid(messageId)) throw badRequest("Invalid message ID");
  const message = await db.collection("messages").findOne({ _id: new ObjectId(messageId) });
  if (!message) throw notFound("Message not found");
  if (user.role !== "admin" && message.senderId !== user._id.toString()) throw forbidden();
  await db.collection("messages").deleteOne({ _id: new ObjectId(messageId) });
  return json({ message: "Message deleted" });
}, { auth: "required" });


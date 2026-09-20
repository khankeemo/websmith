import { apiHandler, jsonBody, json, badRequest, notFound, ObjectId } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, request, user }) => {
  const body = await jsonBody(request);
  const receiverId = String(body.receiverId ?? "");
  const content = String(body.content ?? "").trim();
  if (!receiverId || !ObjectId.isValid(receiverId)) throw badRequest("Valid receiverId is required");
  if (!content) throw badRequest("Message content is required");
  if (receiverId === user._id.toString()) throw badRequest("Cannot send a message to yourself");

  const receiver = await db.collection("users").findOne({ _id: new ObjectId(receiverId) });
  if (!receiver) throw notFound("Receiver not found");

  const doc = {
    senderId: user._id.toString(),
    senderName: user.name ?? "",
    senderAvatar: user.avatar ?? "",
    receiverId,
    receiverName: receiver.name ?? "",
    content,
    type: ["image", "file"].includes(body.type) ? body.type : "text",
    status: "sent",
    timestamp: new Date().toISOString(),
    readAt: null,
  };
  const result = await db.collection("messages").insertOne(doc);
  return json({ data: { ...doc, _id: result.insertedId.toString() } }, { status: 201 });
}, { auth: "required" });

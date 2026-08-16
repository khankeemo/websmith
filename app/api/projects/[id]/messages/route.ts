import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId, badRequest } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const message = String(body.message ?? "").trim();
  if (!message) throw badRequest("Message is required");
  const entry = {
    sender: String(body.sender ?? "team"),
    senderName: String(body.senderName ?? "Websmith Team"),
    message,
    timestamp: new Date().toISOString(),
    isRead: false,
  };
  const result = await db.collection<any>("projects").findOneAndUpdate(
    { _id: id },
    { $push: { messages: entry }, $set: { updatedAt: new Date() } } as any,
    { returnDocument: "after" }
  );
  if (!result) throw notFound("Project not found");
  return json({ data: result.messages ?? [] });
}, { auth: "required" });

import { apiHandler, jsonBody, json } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, request, user }) => {
  const body = await jsonBody(request);
  return json({ data: { ok: true, receiverId: body.receiverId ?? "", isTyping: body.isTyping === true } });
}, { auth: "required" });

import { apiHandler, jsonBody, json, serialize } from "@/lib/server/api";

export const PUT = apiHandler(async ({ db, request, user }) => {
  const body = await jsonBody(request);
  const update: any = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.phone === "string") update.phone = body.phone.trim();
  if (typeof body.company === "string") update.company = body.company.trim();
  if (typeof body.avatar === "string") update.avatar = body.avatar;

  const result = await db.collection("users").findOneAndUpdate({ _id: user._id }, { $set: update }, { returnDocument: "after" });
  return json({ user: serialize(result) });
}, { auth: "required" });

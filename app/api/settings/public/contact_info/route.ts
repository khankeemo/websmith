import { apiHandler, jsonBody, json, unauthorized } from "@/lib/server/api";

export const GET = apiHandler(async ({ db }) => {
  const settings = db.collection("settings");
  const doc = await settings.findOne({ key: "contact_info" });
  const data = doc?.value ?? { headquarters: "", email: "", phone: "" };
  return json({ data });
});

export const PUT = apiHandler(async ({ db, request, user }) => {
  if (!user) throw unauthorized();
  if (user.role !== "admin") throw unauthorized("Insufficient permissions");
  const body = await jsonBody(request);
  const value = body?.value && typeof body.value === "object" ? body.value : body;
  const headquarters = String(value.headquarters ?? "").trim();
  const email = String(value.email ?? "").trim();
  const phone = String(value.phone ?? "").trim();
  await db.collection("settings").updateOne(
    { key: "contact_info" },
    { $set: { key: "contact_info", value: { headquarters, email, phone }, updatedAt: new Date() } },
    { upsert: true }
  );
  return json({ data: { headquarters, email, phone } });
}, { auth: "required" });

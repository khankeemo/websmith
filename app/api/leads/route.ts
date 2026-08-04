import { apiHandler, jsonBody, json } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, request }) => {
  const body = await jsonBody(request);
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (!name || !email || !email.includes("@")) {
    return json({ success: false, error: "Name and valid email are required", message: "Name and valid email are required" }, { status: 400 });
  }
  const lead = {
    name,
    email,
    phone,
    company: String(body.company ?? "").trim(),
    budget: body.budget == null ? null : Number(body.budget),
    timeline: String(body.timeline ?? "").trim(),
    notes: String(body.notes ?? "").trim(),
    cmsRequirement: String(body.cmsRequirement ?? "").trim(),
    appPlatform: String(body.appPlatform ?? "").trim(),
    services: Array.isArray(body.services) ? body.services.map(String) : [],
    status: "new",
    createdAt: new Date(),
  };
  const result = await db.collection("leads").insertOne(lead);
  return json({ data: { ...lead, _id: result.insertedId.toString() } }, { status: 201 });
});

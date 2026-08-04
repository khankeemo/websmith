import { apiHandler, jsonBody, json, forbidden } from "@/lib/server/api";

export const GET = apiHandler(async ({ db }) => {
  const services = await db
    .collection("services")
    .find({ isActive: { $ne: false } })
    .sort({ name: 1 })
    .toArray();
  return json({ data: services.map((s) => ({ id: s._id.toString(), name: s.name, description: s.description, price: s.price ?? null })) });
});

export const POST = apiHandler(async ({ db, request, user }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  if (!name) return json({ success: false, error: "Service name is required", message: "Service name is required" }, { status: 400 });
  const service = {
    name,
    description,
    price: body.price == null ? null : Number(body.price),
    isActive: body.isActive !== false,
    createdAt: new Date(),
  };
  const result = await db.collection("services").insertOne(service);
  return json({ data: { ...service, _id: result.insertedId.toString(), createdAt: new Date() } }, { status: 201 });
}, { auth: "required" });

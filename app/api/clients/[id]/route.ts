import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId, badRequest } from "@/lib/server/api";

const toClient = (u: any) => ({
  _id: u._id.toString(),
  name: u.name,
  email: u.email,
  phone: u.phone ?? "",
  company: u.company ?? "",
  address: u.address ?? "",
  status: u.status ?? "active",
  customId: u.customId,
  published: u.published ?? false,
  createdAt: u.createdAt ?? null,
});

export const GET = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const client = await db.collection("users").findOne({ _id: id, role: "client" });
  if (!client) throw notFound("Client not found");
  return json({ data: toClient(client) });
}, { auth: "required" });

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const client = await db.collection("users").findOne({ _id: id, role: "client" });
  if (!client) throw notFound("Client not found");
  const update: any = { updatedAt: new Date() };
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.phone === "string") update.phone = body.phone.trim();
  if (typeof body.company === "string") update.company = body.company.trim();
  if (typeof body.address === "string") update.address = body.address.trim();
  if (body.status !== undefined) update.status = body.status;
  if (typeof body.published === "boolean") update.published = body.published;
  const result = await db.collection("users").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  return json({ data: toClient(result) });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const result = await db.collection("users").deleteOne({ _id: id, role: "client" });
  if (result.deletedCount === 0) throw notFound("Client not found");
  return json({ message: "Client deleted" });
}, { auth: "required" });

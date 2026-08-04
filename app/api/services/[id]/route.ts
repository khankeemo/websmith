import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId, serialize } from "@/lib/server/api";

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const id = parseObjectId(params.id);
  const update: any = {};
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.description === "string") update.description = body.description.trim();
  if (body.price !== undefined) update.price = body.price == null ? null : Number(body.price);
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;
  update.updatedAt = new Date();
  const result = await db.collection("services").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  if (!result) throw notFound("Service not found");
  return json({ data: serialize(result) });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const result = await db.collection("services").deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("Service not found");
  return json({ message: "Service deleted" });
}, { auth: "required" });

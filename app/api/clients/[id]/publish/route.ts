import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const PATCH = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const result = await db.collection("users").findOneAndUpdate(
    { _id: id, role: "client" },
    { $set: { published: body.published === true, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) throw notFound("Client not found");
  return json({ data: { _id: result._id.toString(), name: result.name, email: result.email, published: result.published } });
}, { auth: "required" });

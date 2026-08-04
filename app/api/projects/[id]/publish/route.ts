import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const PATCH = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const result = await db.collection("projects").findOneAndUpdate(
    { _id: id },
    { $set: { published: body.published === true, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) throw notFound("Project not found");
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });

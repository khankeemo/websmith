import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId, badRequest } from "@/lib/server/api";

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin" && user.role !== "developer") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const progress = Number(body.progress);
  if (progress === undefined || Number.isNaN(progress)) throw badRequest("Progress is required");
  const clamped = Math.min(100, Math.max(0, progress));
  const result = await db.collection("projects").findOneAndUpdate(
    { _id: id },
    { $set: { progress: clamped, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) throw notFound("Project not found");
  return json({ data: { _id: result._id.toString(), progress: result.progress } });
}, { auth: "required" });

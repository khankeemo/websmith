import { apiHandler, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const feedbackId = parseObjectId(params.feedbackId);
  const project = await db.collection("projects").findOne({ _id: id });
  if (!project) throw notFound("Project not found");
  const feedback = (project.feedback ?? []).filter((f: any) => f._id?.toString() !== feedbackId.toString());
  const result = await db.collection("projects").findOneAndUpdate(
    { _id: id },
    { $set: { feedback, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return json({ data: result.feedback ?? [] });
}, { auth: "required" });

import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId, badRequest, ObjectId } from "@/lib/server/api";

const canViewProject = (user: any, project: any) =>
  user.role === "admin" ||
  (user.role === "client" && project.clientId === user._id.toString()) ||
  (user.role === "developer" && project.assignedDevId === user._id.toString());

export const GET = apiHandler(async ({ db, user, params }) => {
  const id = parseObjectId(params.id);
  const project = await db.collection("projects").findOne({ _id: id });
  if (!project) throw notFound("Project not found");
  if (!canViewProject(user, project)) throw forbidden();
  return json({ data: project.feedback ?? [] });
}, { auth: "required" });

export const POST = apiHandler(async ({ db, request, user, params }) => {
  const id = parseObjectId(params.id);
  const project = await db.collection("projects").findOne({ _id: id });
  if (!project) throw notFound("Project not found");
  if (!canViewProject(user, project)) throw forbidden();
  const body = await jsonBody(request);
  const rating = Number(body.rating);
  const comment = String(body.comment ?? "").trim();
  if (!rating || rating < 1 || rating > 5) throw badRequest("Rating must be between 1 and 5");
  if (!comment) throw badRequest("Comment is required");
  const entry = {
    _id: new ObjectId(),
    rating,
    comment,
    date: new Date().toISOString(),
    clientName: String(body.clientName ?? user.name ?? ""),
    publishedAsTestimonial: false,
    testimonialPublishedAt: null,
  };
  const result = await db.collection<any>("projects").findOneAndUpdate(
    { _id: id },
    { $push: { feedback: entry }, $set: { updatedAt: new Date() } } as any,
    { returnDocument: "after" }
  );
  if (!result) throw notFound("Project not found");
  return json({ data: result.feedback ?? [] });
}, { auth: "required" });

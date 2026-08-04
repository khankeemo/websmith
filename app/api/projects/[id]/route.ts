import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

const canViewProject = (user: any, project: any) =>
  user.role === "admin" ||
  (user.role === "client" && project.clientId === user._id.toString()) ||
  (user.role === "developer" && project.assignedDevId === user._id.toString());

export const GET = apiHandler(async ({ db, user, params }) => {
  const id = parseObjectId(params.id);
  const project = await db.collection("projects").findOne({ _id: id });
  if (!project) throw notFound("Project not found");
  if (!canViewProject(user, project)) throw forbidden();
  return json({ data: { ...project, _id: project._id.toString() } });
}, { auth: "required" });

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const allowed = [
    "name", "description", "client", "clientEmail", "clientCompany", "publicUrl", "previewImage",
    "clientId", "assignedDevId", "assignedDeveloperName", "status", "priority", "startDate", "endDate",
    "expectedCompletionDate", "budget", "customClientId", "progress", "published", "sharedFiles",
    "tasks", "statusUpdates", "feedback", "customization",
  ];
  const update: any = { updatedAt: new Date() };
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (update.progress !== undefined) update.progress = Math.min(100, Math.max(0, Number(update.progress)));
  const result = await db.collection("projects").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  if (!result) throw notFound("Project not found");
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const result = await db.collection("projects").deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("Project not found");
  return json({ message: "Project deleted" });
}, { auth: "required" });

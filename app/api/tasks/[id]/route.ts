import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId, ObjectId } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, params }) => {
  const id = parseObjectId(params.id);
  const task = await db.collection("tasks").findOne({ _id: id });
  if (!task) throw notFound("Task not found");
  return json({ data: { ...task, _id: task._id.toString() } });
}, { auth: "required" });

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const update: any = { updatedAt: new Date() };
  const fields = ["title", "description", "priority", "assignee", "completionNote", "subtasks", "comments"];
  for (const key of fields) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (body.projectId !== undefined) update.projectId = body.projectId ? String(body.projectId) : null;
  if (body.clientId !== undefined) update.clientId = body.clientId ? String(body.clientId) : null;
  if (body.developerId !== undefined) update.developerId = body.developerId ? String(body.developerId) : null;
  if (body.dueDate !== undefined) update.dueDate = body.dueDate || null;
  if (body.status !== undefined) {
    update.status = body.status;
    if (body.status === "completed") {
      update.completedAt = new Date();
      if (typeof body.completionNote === "string") update.completionNote = body.completionNote;
    }
  }
  if (update.developerId && ObjectId.isValid(update.developerId)) {
    const dev = await db.collection("users").findOne({ _id: new ObjectId(update.developerId) });
    if (dev) update.assignedDeveloperName = dev.name;
  }
  const result = await db.collection("tasks").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  if (!result) throw notFound("Task not found");
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const result = await db.collection("tasks").deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("Task not found");
  return json({ message: "Task deleted" });
}, { auth: "required" });

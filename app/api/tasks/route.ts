import { apiHandler, jsonBody, json, forbidden, badRequest, ObjectId } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  const filter: any = {};
  if (user.role === "client") {
    const projects = await db.collection("projects").find({ clientId: user._id.toString() }).project({ _id: 1 }).toArray();
    const projectIds = projects.map((p) => p._id.toString());
    filter.$or = [{ clientId: user._id.toString() }, { projectId: { $in: projectIds } }];
  } else if (user.role === "developer") {
    filter.developerId = user._id.toString();
  }
  const tasks = await db.collection("tasks").find(filter).sort({ createdAt: -1 }).toArray();
  return json({ data: tasks.map((t) => ({ ...t, _id: t._id.toString() })) });
}, { auth: "required" });

export const POST = apiHandler(async ({ db, request, user }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const title = String(body.title ?? "").trim();
  if (!title) throw badRequest("Task title is required");
  const now = new Date();
  const projectId = body.projectId ? String(body.projectId) : null;
  const clientId = body.clientId ? String(body.clientId) : null;
  const developerId = body.developerId ? String(body.developerId) : null;
  const doc: any = {
    title,
    description: String(body.description ?? ""),
    projectId,
    clientId,
    developerId,
    assignee: String(body.assignee ?? ""),
    status: ["pending", "in-progress", "completed", "review"].includes(body.status) ? body.status : "pending",
    priority: ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium",
    dueDate: body.dueDate || null,
    completionNote: "",
    completedAt: null,
    subtasks: Array.isArray(body.subtasks) ? body.subtasks : [],
    comments: Array.isArray(body.comments) ? body.comments : [],
    createdAt: now,
    updatedAt: now,
  };
  if (developerId && ObjectId.isValid(developerId)) {
    const dev = await db.collection("users").findOne({ _id: new ObjectId(developerId) });
    if (dev) doc.assignedDeveloperName = dev.name;
  }
  const result = await db.collection("tasks").insertOne(doc);
  return json({ data: { ...doc, _id: result.insertedId.toString() } }, { status: 201 });
}, { auth: "required" });

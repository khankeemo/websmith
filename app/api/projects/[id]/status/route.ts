import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId, badRequest } from "@/lib/server/api";

const STATUS_META: Record<string, { text: string; color: string }> = {
  pending: { text: "Pending", color: "#8E8E93" },
  "in-progress": { text: "In Progress", color: "#FF9500" },
  completed: { text: "Completed", color: "#34C759" },
  "on-hold": { text: "On Hold", color: "#FF3B30" },
};

const canViewProject = (user: any, project: any) =>
  user.role === "admin" ||
  (user.role === "client" && project.clientId === user._id.toString()) ||
  (user.role === "developer" && project.assignedDevId === user._id.toString());

export const GET = apiHandler(async ({ db, user, params }) => {
  const id = parseObjectId(params.id);
  const project = await db.collection("projects").findOne({ _id: id });
  if (!project) throw notFound("Project not found");
  if (!canViewProject(user, project)) throw forbidden();

  let clientInfo: any = {
    name: project.client ?? "",
    email: project.clientEmail ?? "",
    phone: "",
    company: project.clientCompany ?? "",
  };
  if (project.clientId) {
    const client = await db.collection("users").findOne({ _id: parseObjectId(project.clientId) }).catch(() => null);
    if (client) {
      clientInfo = {
        name: client.name ?? clientInfo.name,
        email: client.email ?? clientInfo.email,
        phone: client.phone ?? "",
        company: client.company ?? clientInfo.company,
      };
    }
  }

  const startDate = project.startDate ? new Date(project.startDate) : null;
  const endDate = project.endDate ? new Date(project.endDate) : null;
  const dayMs = 86400000;
  const nowMs = Date.now();
  const daysRemaining = endDate ? Math.ceil((endDate.getTime() - nowMs) / dayMs) : null;
  const totalDays = startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / dayMs) : null;

  const statusMeta = STATUS_META[project.status] ?? { text: project.status, color: "#8E8E93" };
  const type = project.projectType ?? project.type ?? "custom";

  const data = {
    clientInfo,
    projectType: {
      type,
      displayName: String(type).replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      description: project.description ?? "",
    },
    timeline: {
      startDate: project.startDate ?? null,
      endDate: project.endDate ?? null,
      daysRemaining,
      totalDays,
    },
    progress: {
      percentage: project.progress ?? 0,
      status: statusMeta,
      budgetUsed: project.budgetUsed ?? 0,
      budgetTotal: project.budget ?? null,
    },
    messages: project.messages ?? [],
    feedback: project.feedback ?? [],
    customization: project.customization ?? { buttonColor: "#007AFF", theme: "light", headerImage: "", logoImage: "" },
    statusOverview: {
      currentStatus: project.status ?? "pending",
      priority: project.priority ?? "medium",
      createdAt: project.createdAt ?? null,
      updatedAt: project.updatedAt ?? null,
    },
  };
  return json({ data });
}, { auth: "required" });

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const status = String(body.status ?? "");
  if (!STATUS_META[status]) throw badRequest("Invalid project status");
  const update: any = { status, updatedAt: new Date() };
  if (body.progress !== undefined) update.progress = Math.min(100, Math.max(0, Number(body.progress)));
  if (typeof body.note === "string" || body.note === undefined) {
    const project = await db.collection("projects").findOne({ _id: id });
    const statusUpdates = project?.statusUpdates ?? [];
    statusUpdates.push({ status, progress: update.progress ?? project?.progress ?? 0, note: body.note ?? "", createdAt: new Date() });
    update.statusUpdates = statusUpdates;
  }
  const result = await db.collection("projects").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  if (!result) throw notFound("Project not found");
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });

import { apiHandler, json, forbidden } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  const me = user._id.toString();

  if (user.role === "admin") {
    const [projects, clients, tasks, invoices] = await Promise.all([
      db.collection("projects").find().toArray(),
      db.collection("users").countDocuments({ role: "client" }),
      db.collection("tasks").find().toArray(),
      db.collection("invoices").find().toArray(),
    ]);
    const developers = await db.collection("users").countDocuments({ role: "developer" });
    const revenue = invoices.reduce((s, i) => s + (i.paidAmount ?? 0), 0);

    const activity: any[] = [];
    for (const p of projects) {
      activity.push({ id: p._id.toString(), type: "project", title: `Project ${p.name}`, timestamp: p.createdAt ?? new Date().toISOString() });
    }
    for (const t of tasks) {
      activity.push({ id: t._id.toString(), type: "task", title: `Task ${t.title}`, timestamp: t.createdAt ?? new Date().toISOString() });
    }
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const data = {
      projects: projects.length,
      clients,
      tasks: tasks.length,
      revenue,
      developers,
      completedTasks: tasks.filter((t) => t.status === "completed").length,
      activeProjects: projects.filter((p) => p.status === "in-progress").length,
      recentActivity: activity.slice(0, 8),
    };
    return json({ data });
  }

  if (user.role === "client") {
    const [projects, tasks, notifications, tickets] = await Promise.all([
      db.collection("projects").find({ clientId: me }).toArray(),
      db.collection("tasks").find({ clientId: me }).toArray(),
      db.collection("notifications").countDocuments({ recipientId: me, isRead: { $ne: true } }),
      db.collection("tickets").find({ clientId: me }).toArray(),
    ]);
    const projectIds = projects.map((p) => p._id.toString());
    const tasksAll = tasks.length > 0 ? tasks : await db.collection("tasks").find({ projectId: { $in: projectIds } }).toArray();
    const invoices = await db.collection("invoices").find({ clientId: me }).toArray();
    const revenue = invoices.reduce((s, i) => s + (i.paidAmount ?? 0), 0);
    const openQueries = tickets.filter((t) => ["open", "in_progress"].includes(t.status)).length;

    const now = Date.now();
    const deadline = (p: any) => ({
      _id: p._id.toString(),
      name: p.name,
      expectedCompletionDate: p.expectedCompletionDate ?? p.endDate ?? "",
      status: p.status,
      progress: p.progress ?? 0,
    });
    const upcomingDeadlines = projects
      .filter((p) => p.expectedCompletionDate || p.endDate)
      .map(deadline)
      .sort((a, b) => new Date(a.expectedCompletionDate).getTime() - new Date(b.expectedCompletionDate).getTime())
      .slice(0, 5);
    const overdueProjects = projects
      .filter((p) => {
        if (p.status === "completed") return false;
        const d = p.expectedCompletionDate ?? p.endDate;
        return d && new Date(d).getTime() < now;
      })
      .map(deadline);

    const activity: any[] = [];
    for (const p of projects) activity.push({ id: p._id.toString(), type: "project", title: `Project ${p.name}`, timestamp: p.createdAt ?? new Date().toISOString() });
    for (const t of tasksAll) activity.push({ id: t._id.toString(), type: "task", title: `Task ${t.title}`, timestamp: t.createdAt ?? new Date().toISOString() });
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const data = {
      projects: projects.length,
      activeProjects: projects.filter((p) => p.status === "in-progress").length,
      completedTasks: tasksAll.filter((t) => t.status === "completed").length,
      revenue,
      unreadNotifications: notifications,
      openQueries,
      recentActivity: activity.slice(0, 8),
      upcomingDeadlines,
      overdueProjects,
    };
    return json({ data });
  }

  throw forbidden();
}, { auth: "required" });

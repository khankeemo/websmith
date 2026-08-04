import { apiHandler, json, forbidden } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  if (user.role !== "developer") throw forbidden();
  const me = user._id.toString();
  const [projects, tasks] = await Promise.all([
    db.collection("projects").find({ assignedDevId: me }).toArray(),
    db.collection("tasks").find({ developerId: me }).toArray(),
  ]);
  const now = Date.now();
  const active = tasks.filter((t) => t.status !== "completed");
  const upcomingDeadlineTasks = active
    .filter((t) => t.dueDate && new Date(t.dueDate).getTime() >= now)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5)
    .map((t) => ({ _id: t._id.toString(), title: t.title, dueDate: t.dueDate, projectId: t.projectId, priority: t.priority }));
  const overdueTaskList = active
    .filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .map((t) => ({ _id: t._id.toString(), title: t.title, dueDate: t.dueDate, projectId: t.projectId, priority: t.priority }));

  const activity: any[] = [];
  for (const p of projects) activity.push({ id: p._id.toString(), type: "project", title: `Project ${p.name}`, timestamp: p.createdAt ?? new Date().toISOString() });
  for (const t of tasks) activity.push({ id: t._id.toString(), type: "task", title: `Task ${t.title}`, timestamp: t.createdAt ?? new Date().toISOString() });
  activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const countByStatus = (status: string) => tasks.filter((t) => t.status === status).length;
  const countByPriority = (priority: string) => tasks.filter((t) => t.priority === priority).length;

  const data = {
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === "in-progress").length,
    completedProjects: projects.filter((p) => p.status === "completed").length,
    totalTasks: tasks.length,
    tasksByStatus: { pending: countByStatus("pending"), inProgress: countByStatus("in-progress"), review: countByStatus("review"), completed: countByStatus("completed") },
    tasksByPriority: { high: countByPriority("high"), medium: countByPriority("medium"), low: countByPriority("low") },
    upcomingDeadlines: upcomingDeadlineTasks.length,
    overdueTasks: overdueTaskList.length,
    recentActivity: activity.slice(0, 8),
    upcomingDeadlineTasks,
    overdueTaskList,
  };
  return json({ data });
}, { auth: "required" });

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, LayoutGrid, List, Kanban, PlayCircle } from "lucide-react";
import API from "../../../core/services/apiService";
import Card from "../../../components/ui/Card";
import KanbanBoard from "../../../components/ui/KanbanBoard";

interface Task {
  _id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "review" | "completed";
  priority: "low" | "medium" | "high";
  project?: string;
  projectId?: { _id: string; name: string; status: string };
  assignee?: string;
  dueDate?: string;
  createdAt: string;
  completionNote?: string;
}

type ViewMode = "grid" | "list" | "kanban";

export default function DeveloperTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [completeNote, setCompleteNote] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const userResponse = await API.get("/users/me");
        
        if (userResponse.data.user.role !== "developer") {
          router.push("/");
          return;
        }

        const tasksResponse = await API.get("/tasks");
        setTasks(tasksResponse.data.data || []);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        router.push("/login");
      }
    };

    fetchData();
  }, [router]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "#8E8E93",
      "in-progress": "#007AFF",
      review: "#FF9500",
      completed: "#34C759",
    };
    return colors[status] || "#8E8E93";
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: "#8E8E93",
      medium: "#007AFF",
      high: "#FF9500",
      urgent: "#FF3B30",
    };
    return colors[priority] || "#8E8E93";
  };

  /** Developers may only set these statuses (see server updateTask / bulk rules). */
  const DEV_ALLOWED_STATUSES = ["pending", "in-progress", "completed"] as const;

  const handleCardDrop = async (cardId: string, fromStatus: string, toStatus: string) => {
    if (!DEV_ALLOWED_STATUSES.includes(toStatus as (typeof DEV_ALLOWED_STATUSES)[number])) {
      return;
    }
    try {
      await API.put(`/tasks/${cardId}/status`, { status: toStatus });
      const tasksResponse = await API.get("/tasks");
      setTasks(tasksResponse.data.data || []);
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
    setCompleteNote(task.completionNote || "");
  };

  const refreshTasks = async () => {
    const tasksResponse = await API.get("/tasks");
    const list = tasksResponse.data.data || [];
    setTasks(list);
    return list;
  };

  const updateTaskFields = async (taskId: string, body: Record<string, unknown>) => {
    setSavingTask(true);
    try {
      await API.put(`/tasks/${taskId}`, body);
      const list = await refreshTasks();
      const updated = list.find((t: Task) => t._id === taskId);
      if (updated) setSelectedTask(updated);
    } catch (error) {
      console.error("Error updating task:", error);
    } finally {
      setSavingTask(false);
    }
  };

  const handleStartTask = () => {
    if (!selectedTask || selectedTask.status !== "pending") return;
    updateTaskFields(selectedTask._id, { status: "in-progress" });
  };

  const handleMarkComplete = () => {
    if (!selectedTask || selectedTask.status === "completed") return;
    updateTaskFields(selectedTask._id, {
      status: "completed",
      completionNote: completeNote.trim(),
    });
  };

  const kanbanColumns = [
    { id: "pending", title: "To Do", status: "pending", color: "#8E8E93" },
    { id: "in-progress", title: "In Progress", status: "in-progress", color: "#007AFF" },
    { id: "review", title: "Review", status: "review", color: "#FF9500" },
    { id: "completed", title: "Done", status: "completed", color: "#34C759" },
  ];

  const stats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in-progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    done: tasks.filter((t) => t.status === "completed").length,
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ color: "var(--text-secondary)" }}>Loading tasks...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>My Tasks</h1>
          <p style={styles.subtitle}>Work on tasks assigned to you — update status, add remarks, and comment for your team</p>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.viewToggle}>
            <button type="button" onClick={() => setViewMode("grid")} style={{ ...styles.toggleBtn, ...(viewMode === "grid" ? styles.toggleActive : {}) }}>
              <LayoutGrid size={16} />
            </button>
            <button type="button" onClick={() => setViewMode("list")} style={{ ...styles.toggleBtn, ...(viewMode === "list" ? styles.toggleActive : {}) }}>
              <List size={16} />
            </button>
            <button type="button" onClick={() => setViewMode("kanban")} style={{ ...styles.toggleBtn, ...(viewMode === "kanban" ? styles.toggleActive : {}) }}>
              <Kanban size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <CheckSquare size={24} color="#007AFF" />
          <div>
            <p style={styles.statValue}>{stats.total}</p>
            <p style={styles.statLabel}>Total Tasks</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <CheckSquare size={24} color="#8E8E93" />
          <div>
            <p style={styles.statValue}>{stats.todo}</p>
            <p style={styles.statLabel}>To Do</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <CheckSquare size={24} color="#007AFF" />
          <div>
            <p style={styles.statValue}>{stats.inProgress}</p>
            <p style={styles.statLabel}>In Progress</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <CheckSquare size={24} color="#34C759" />
          <div>
            <p style={styles.statValue}>{stats.done}</p>
            <p style={styles.statLabel}>Done</p>
          </div>
        </div>
      </div>

      {/* Tasks Display */}
      {viewMode === "kanban" ? (
        <KanbanBoard
          columns={kanbanColumns}
          cards={tasks.map((t) => ({
            ...t,
            title: t.title,
            subtitle: `Priority: ${t.priority}`,
            priority: t.priority,
          }))}
          onCardDrop={handleCardDrop}
        />
      ) : viewMode === "grid" ? (
        <div style={styles.grid}>
          {tasks.map((task) => (
            <Card key={task._id}>
              <div style={styles.taskCard} onClick={() => handleViewTask(task)} className="clickable-card">
                <div style={styles.taskHeader}>
                  <h3 style={styles.taskTitle}>{task.title}</h3>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: `${getStatusColor(task.status)}20`,
                      color: getStatusColor(task.status),
                    }}
                  >
                    {task.status.replace("-", " ")}
                  </span>
                </div>
                <p style={styles.taskDesc}>{task.description}</p>
                <div style={styles.taskMeta}>
                  <span
                    style={{
                      ...styles.priorityBadge,
                      backgroundColor: `${getPriorityColor(task.priority)}20`,
                      color: getPriorityColor(task.priority),
                    }}
                  >
                    {task.priority}
                  </span>
                  {task.dueDate && (
                    <span>📅 Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={styles.list}>
          {tasks.map((task) => (
            <div key={task._id} style={styles.listRow} onClick={() => handleViewTask(task)} className="clickable-row">
              <div style={styles.listInfo}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{task.title}</strong>
                <p style={styles.listMeta}>
                  {(task.description || "").length > 80
                    ? `${(task.description || "").slice(0, 80)}…`
                    : task.description || "—"}
                </p>
              </div>
              <span
                style={{
                  ...styles.statusBadge,
                  backgroundColor: `${getStatusColor(task.status)}20`,
                  color: getStatusColor(task.status),
                }}
              >
                {task.status.replace("-", " ")}
              </span>
              <span
                style={{
                  ...styles.priorityBadge,
                  backgroundColor: `${getPriorityColor(task.priority)}20`,
                  color: getPriorityColor(task.priority),
                }}
              >
                {task.priority}
              </span>
              <span style={styles.listDate}>
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}
              </span>
            </div>
          ))}
        </div>
      )}

      {tasks.length === 0 && (
        <div style={styles.emptyContainer}>
          <CheckSquare size={48} color="var(--border-color)" />
          <h3 style={styles.emptyTitle}>No assigned tasks</h3>
          <p style={styles.emptyText}>When an admin assigns work to you, it will show up here.</p>
        </div>
      )}

      {/* Task Detail Modal */}
      {showTaskDetail && selectedTask && (
        <div style={styles.modalOverlay} onClick={() => setShowTaskDetail(false)}>
          <div style={styles.taskDetailModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{selectedTask.title}</h2>
              <button onClick={() => setShowTaskDetail(false)} style={styles.closeBtn}>×</button>
            </div>

            <div style={styles.modalBody}>
              {/* Task Info */}
              <div style={styles.taskInfoSection}>
                <p style={styles.taskInfoLabel}>Status</p>
                <span style={{
                  ...styles.statusBadge,
                  backgroundColor: `${getStatusColor(selectedTask.status)}20`,
                  color: getStatusColor(selectedTask.status),
                }}>
                  {selectedTask.status.replace("-", " ")}
                </span>
              </div>

              <div style={styles.taskInfoSection}>
                <p style={styles.taskInfoLabel}>Priority</p>
                <span style={{
                  ...styles.priorityBadge,
                  backgroundColor: `${getPriorityColor(selectedTask.priority)}20`,
                  color: getPriorityColor(selectedTask.priority),
                }}>
                  {selectedTask.priority}
                </span>
              </div>

              {selectedTask.dueDate && (
                <div style={styles.taskInfoSection}>
                  <p style={styles.taskInfoLabel}>Due Date</p>
                  <p style={styles.taskInfoValue}>{new Date(selectedTask.dueDate).toLocaleDateString()}</p>
                </div>
              )}

              {selectedTask.projectId && (
                <div style={styles.taskInfoSection}>
                  <p style={styles.taskInfoLabel}>Project</p>
                  <p style={styles.taskInfoValue}>
                    {typeof selectedTask.projectId === "object" && selectedTask.projectId
                      ? selectedTask.projectId.name
                      : String(selectedTask.projectId)}
                  </p>
                </div>
              )}

              <div style={styles.taskInfoSection}>
                <p style={styles.taskInfoLabel}>Description</p>
                <p style={styles.taskInfoValue}>{selectedTask.description}</p>
              </div>

              {selectedTask.completionNote && (
                <div style={styles.taskInfoSection}>
                  <p style={styles.taskInfoLabel}>Completion remarks</p>
                  <p style={styles.taskInfoValue}>{selectedTask.completionNote}</p>
                </div>
              )}

              {selectedTask.status !== "completed" && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>Your actions</h3>
                  <p style={styles.helpText}>
                    Move the task forward or mark it done. Add optional remarks when completing.
                  </p>
                  <div style={styles.actionRow}>
                    {selectedTask.status === "pending" && (
                      <button
                        type="button"
                        onClick={handleStartTask}
                        disabled={savingTask}
                        style={styles.actionBtnSecondary}
                      >
                        <PlayCircle size={16} />
                        Start work
                      </button>
                    )}
                  </div>
                  <label style={styles.label}>Remarks on completion (optional)</label>
                  <textarea
                    value={completeNote}
                    onChange={(e) => setCompleteNote(e.target.value)}
                    placeholder="e.g. what you shipped, PR link, handoff notes…"
                    style={styles.textarea}
                    rows={3}
                  />
                  <button
                    type="button"
                    onClick={handleMarkComplete}
                    disabled={savingTask}
                    style={styles.actionBtnPrimary}
                  >
                    Mark as completed
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .clickable-card, .clickable-row { cursor: pointer; transition: all 0.2s ease; }
        .clickable-card:hover, .clickable-row:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px color-mix(in srgb, var(--text-primary) 12%, transparent);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: Record<string, any> = {
  container: { padding: "24px", backgroundColor: "var(--bg-primary)", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "24px" },
  title: { margin: 0, fontSize: "34px", fontWeight: 700, color: "var(--text-primary)" },
  subtitle: { margin: "8px 0 0", color: "var(--text-secondary)" },
  headerRight: { display: "flex", gap: "12px", alignItems: "center" },
  viewToggle: { display: "flex", background: "var(--bg-secondary)", borderRadius: "12px", padding: "4px", border: "1px solid var(--border-color)" },
  toggleBtn: { border: "none", background: "transparent", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", color: "var(--text-secondary)" },
  toggleActive: { background: "var(--bg-primary)", color: "var(--text-primary)", boxShadow: "0 2px 8px color-mix(in srgb, var(--text-primary) 8%, transparent)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" },
  statCard: { display: "flex", alignItems: "center", gap: "16px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "16px", padding: "20px" },
  statValue: { margin: 0, fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" },
  statLabel: { margin: "4px 0 0", fontSize: "13px", color: "var(--text-secondary)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" },
  taskCard: { display: "flex", flexDirection: "column", gap: "12px" },
  taskHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" },
  taskTitle: { margin: 0, fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" },
  statusBadge: { padding: "6px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, textTransform: "capitalize" },
  taskDesc: { margin: 0, fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 },
  taskMeta: { display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: "var(--text-secondary)" },
  priorityBadge: { padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, textTransform: "capitalize" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  listRow: { display: "grid", gridTemplateColumns: "1.5fr auto auto auto", alignItems: "center", gap: "16px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "16px", padding: "16px 20px" },
  listInfo: { display: "flex", flexDirection: "column", gap: "4px" },
  listMeta: { margin: 0, fontSize: "13px", color: "var(--text-secondary)" },
  listDate: { fontSize: "13px", color: "var(--text-secondary)" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px", gap: "16px" },
  spinner: { width: "40px", height: "40px", border: "3px solid var(--border-color)", borderTopColor: "#007AFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  emptyContainer: { textAlign: "center", padding: "60px" },
  emptyTitle: { fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginTop: "16px", marginBottom: "8px" },
  emptyText: { fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalTitle: { margin: "0 0 24px", fontSize: "24px", fontWeight: 600, color: "var(--text-primary)" },
  label: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" },
  input: { width: "100%", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "10px", fontSize: "15px", boxSizing: "border-box", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" },
  textarea: { width: "100%", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "10px", fontSize: "15px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" },
  taskDetailModal: { background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "20px", width: "90%", maxWidth: "700px", maxHeight: "90vh", overflow: "auto", padding: "24px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--border-color)" },
  closeBtn: { background: "none", border: "none", fontSize: "32px", cursor: "pointer", color: "var(--text-secondary)", lineHeight: 1, padding: "0 4px" },
  modalBody: { display: "flex", flexDirection: "column", gap: "16px" },
  taskInfoSection: { display: "flex", flexDirection: "column", gap: "6px" },
  taskInfoLabel: { fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", margin: 0 },
  taskInfoValue: { fontSize: "14px", color: "var(--text-primary)", margin: 0 },
  section: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px", paddingTop: "16px", borderTop: "1px solid var(--border-color)" },
  sectionTitle: { fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 },
  helpText: { fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 12px 0", lineHeight: 1.5 },
  actionRow: { display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" },
  actionBtnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px 18px",
    backgroundColor: "#34C759",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    marginTop: "8px",
  },
  actionBtnSecondary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 16px",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
};

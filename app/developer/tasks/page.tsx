"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, LayoutGrid, List, Kanban, Plus } from "lucide-react";
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
  assignedTo: string;
  dueDate?: string;
  createdAt: string;
  subtasks?: Array<{ _id: string; title: string; completed: boolean }>;
  comments?: Array<{ _id: string; authorName: string; content: string; createdAt: string }>;
}

type ViewMode = "grid" | "list" | "kanban";

export default function DeveloperTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
    dueDate: "",
  });

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

  const handleCardDrop = async (cardId: string, fromStatus: string, toStatus: string) => {
    try {
      await API.put(`/tasks/${cardId}/status`, { status: toStatus });
      const tasksResponse = await API.get("/tasks");
      setTasks(tasksResponse.data.data || []);
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.post("/tasks", formData);
      const tasksResponse = await API.get("/tasks");
      setTasks(tasksResponse.data.data || []);
      setShowModal(false);
      setFormData({ title: "", description: "", priority: "medium", dueDate: "" });
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
    setNewComment("");
    setNewSubtask("");
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;

    try {
      await API.post(`/tasks/${selectedTask._id}/comments`, { content: newComment });
      const tasksResponse = await API.get("/tasks");
      setTasks(tasksResponse.data.data || []);
      
      // Update selected task
      const updatedTask = tasksResponse.data.data.find((t: Task) => t._id === selectedTask._id);
      if (updatedTask) {
        setSelectedTask(updatedTask);
      }
      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newSubtask.trim()) return;

    try {
      await API.post(`/tasks/${selectedTask._id}/subtasks`, { title: newSubtask });
      const tasksResponse = await API.get("/tasks");
      setTasks(tasksResponse.data.data || []);
      
      // Update selected task
      const updatedTask = tasksResponse.data.data.find((t: Task) => t._id === selectedTask._id);
      if (updatedTask) {
        setSelectedTask(updatedTask);
      }
      setNewSubtask("");
    } catch (error) {
      console.error("Error adding subtask:", error);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!selectedTask) return;

    try {
      await API.patch(`/tasks/${selectedTask._id}/subtasks/${subtaskId}`);
      const tasksResponse = await API.get("/tasks");
      setTasks(tasksResponse.data.data || []);
      
      // Update selected task
      const updatedTask = tasksResponse.data.data.find((t: Task) => t._id === selectedTask._id);
      if (updatedTask) {
        setSelectedTask(updatedTask);
      }
    } catch (error) {
      console.error("Error toggling subtask:", error);
    }
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
        <p>Loading tasks...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>My Tasks</h1>
          <p style={styles.subtitle}>Manage your tasks and track progress</p>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.viewToggle}>
            <button onClick={() => setViewMode("grid")} style={{ ...styles.toggleBtn, ...(viewMode === "grid" ? styles.toggleActive : {}) }}>
              <LayoutGrid size={16} />
            </button>
            <button onClick={() => setViewMode("list")} style={{ ...styles.toggleBtn, ...(viewMode === "list" ? styles.toggleActive : {}) }}>
              <List size={16} />
            </button>
            <button onClick={() => setViewMode("kanban")} style={{ ...styles.toggleBtn, ...(viewMode === "kanban" ? styles.toggleActive : {}) }}>
              <Kanban size={16} />
            </button>
          </div>
          <button onClick={() => setShowModal(true)} style={styles.addBtn}>
            <Plus size={18} />
            <span>New Task</span>
          </button>
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
                <strong>{task.title}</strong>
                <p style={styles.listMeta}>{task.description.substring(0, 80)}...</p>
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
          <CheckSquare size={48} color="#C6C6C8" />
          <h3 style={styles.emptyTitle}>No tasks yet</h3>
          <p style={styles.emptyText}>Create your first task to get started</p>
          <button onClick={() => setShowModal(true)} style={styles.emptyBtn}>
            Create Task
          </button>
        </div>
      )}

      {/* Create Task Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Create New Task</h2>
            <form onSubmit={handleCreateTask}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  style={styles.input}
                  placeholder="Task title"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={4}
                  style={styles.textarea}
                  placeholder="Task description"
                />
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    style={styles.select}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn}>
                  Create Task
                </button>
              </div>
            </form>
          </div>
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
                  <p style={styles.taskInfoValue}>{selectedTask.projectId.name}</p>
                </div>
              )}

              <div style={styles.taskInfoSection}>
                <p style={styles.taskInfoLabel}>Description</p>
                <p style={styles.taskInfoValue}>{selectedTask.description}</p>
              </div>

              {/* Subtasks Section */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Subtasks</h3>
                <form onSubmit={handleAddSubtask} style={styles.addForm}>
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Add a subtask..."
                    style={styles.input}
                  />
                  <button type="submit" style={styles.addBtnSmall}>Add</button>
                </form>
                <div style={styles.subtasksList}>
                  {selectedTask.subtasks?.map((subtask) => (
                    <div key={subtask._id} style={styles.subtaskItem}>
                      <input
                        type="checkbox"
                        checked={subtask.completed}
                        onChange={() => handleToggleSubtask(subtask._id)}
                        style={styles.checkbox}
                      />
                      <span style={{
                        ...styles.subtaskText,
                        textDecoration: subtask.completed ? 'line-through' : 'none',
                        opacity: subtask.completed ? 0.6 : 1
                      }}>
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                  {(!selectedTask.subtasks || selectedTask.subtasks.length === 0) && (
                    <p style={styles.emptyText}>No subtasks yet</p>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Comments</h3>
                <form onSubmit={handleAddComment} style={styles.addForm}>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    style={styles.textarea}
                    rows={2}
                  />
                  <button type="submit" style={styles.addBtnSmall}>Add</button>
                </form>
                <div style={styles.commentsList}>
                  {selectedTask.comments?.map((comment) => (
                    <div key={comment._id} style={styles.commentItem}>
                      <div style={styles.commentHeader}>
                        <strong style={styles.commentAuthor}>{comment.authorName}</strong>
                        <span style={styles.commentTime}>
                          {new Date(comment.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p style={styles.commentText}>{comment.content}</p>
                    </div>
                  ))}
                  {(!selectedTask.comments || selectedTask.comments.length === 0) && (
                    <p style={styles.emptyText}>No comments yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .clickable-card, .clickable-row { cursor: pointer; transition: all 0.2s ease; }
        .clickable-card:hover, .clickable-row:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: Record<string, any> = {
  container: { padding: "24px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "24px" },
  title: { margin: 0, fontSize: "34px", fontWeight: 700, color: "#1C1C1E" },
  subtitle: { margin: "8px 0 0", color: "#8E8E93" },
  headerRight: { display: "flex", gap: "12px", alignItems: "center" },
  viewToggle: { display: "flex", background: "#F2F2F7", borderRadius: "12px", padding: "4px" },
  toggleBtn: { border: "none", background: "transparent", padding: "8px 10px", borderRadius: "8px", cursor: "pointer" },
  toggleActive: { background: "#fff" },
  addBtn: { display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", backgroundColor: "#007AFF", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" },
  statCard: { display: "flex", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #E5E5EA", borderRadius: "16px", padding: "20px" },
  statValue: { margin: 0, fontSize: "28px", fontWeight: 700, color: "#1C1C1E" },
  statLabel: { margin: "4px 0 0", fontSize: "13px", color: "#8E8E93" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" },
  taskCard: { display: "flex", flexDirection: "column", gap: "12px" },
  taskHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" },
  taskTitle: { margin: 0, fontSize: "18px", fontWeight: 600, color: "#1C1C1E" },
  statusBadge: { padding: "6px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, textTransform: "capitalize" },
  taskDesc: { margin: 0, fontSize: "14px", color: "#8E8E93", lineHeight: 1.5 },
  taskMeta: { display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: "#8E8E93" },
  priorityBadge: { padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, textTransform: "capitalize" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  listRow: { display: "grid", gridTemplateColumns: "1.5fr auto auto auto", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #E5E5EA", borderRadius: "16px", padding: "16px 20px" },
  listInfo: { display: "flex", flexDirection: "column", gap: "4px" },
  listMeta: { margin: 0, fontSize: "13px", color: "#8E8E93" },
  listDate: { fontSize: "13px", color: "#8E8E93" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px", gap: "16px" },
  spinner: { width: "40px", height: "40px", border: "3px solid #E5E5EA", borderTopColor: "#007AFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  emptyContainer: { textAlign: "center", padding: "60px" },
  emptyTitle: { fontSize: "20px", fontWeight: 600, color: "#1C1C1E", marginTop: "16px", marginBottom: "8px" },
  emptyText: { fontSize: "14px", color: "#8E8E93", marginBottom: "20px" },
  emptyBtn: { padding: "10px 24px", backgroundColor: "#007AFF", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#fff", borderRadius: "20px", width: "90%", maxWidth: "600px", maxHeight: "90vh", overflow: "auto", padding: "24px" },
  modalTitle: { margin: "0 0 24px", fontSize: "24px", fontWeight: 600, color: "#1C1C1E" },
  formGroup: { marginBottom: "16px" },
  label: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: "#3A3A3C" },
  input: { width: "100%", padding: "12px", border: "1px solid #E5E5EA", borderRadius: "10px", fontSize: "15px", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "12px", border: "1px solid #E5E5EA", borderRadius: "10px", fontSize: "15px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  select: { width: "100%", padding: "12px", border: "1px solid #E5E5EA", borderRadius: "10px", fontSize: "15px" },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  modalActions: { display: "flex", gap: "12px", marginTop: "24px" },
  cancelBtn: { flex: 1, padding: "14px", background: "#F2F2F7", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer" },
  submitBtn: { flex: 1, padding: "14px", background: "#007AFF", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer" },
  taskDetailModal: { background: "#fff", borderRadius: "20px", width: "90%", maxWidth: "700px", maxHeight: "90vh", overflow: "auto", padding: "24px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #E5E5EA" },
  closeBtn: { background: "none", border: "none", fontSize: "32px", cursor: "pointer", color: "#8E8E93", lineHeight: 1, padding: "0 4px" },
  modalBody: { display: "flex", flexDirection: "column", gap: "16px" },
  taskInfoSection: { display: "flex", flexDirection: "column", gap: "6px" },
  taskInfoLabel: { fontSize: "12px", fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", margin: 0 },
  taskInfoValue: { fontSize: "14px", color: "#1C1C1E", margin: 0 },
  section: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px", paddingTop: "16px", borderTop: "1px solid #E5E5EA" },
  sectionTitle: { fontSize: "16px", fontWeight: 600, color: "#1C1C1E", margin: 0 },
  addForm: { display: "flex", gap: "8px" },
  addBtnSmall: { padding: "8px 16px", background: "#007AFF", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  subtasksList: { display: "flex", flexDirection: "column", gap: "8px" },
  subtaskItem: { display: "flex", alignItems: "center", gap: "10px", padding: "8px", backgroundColor: "#F2F2F7", borderRadius: "8px" },
  checkbox: { width: "16px", height: "16px", cursor: "pointer", accentColor: "#007AFF" },
  subtaskText: { fontSize: "14px", color: "#1C1C1E", flex: 1 },
  commentsList: { display: "flex", flexDirection: "column", gap: "12px" },
  commentItem: { padding: "12px", backgroundColor: "#F2F2F7", borderRadius: "10px" },
  commentHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" },
  commentAuthor: { fontSize: "13px", fontWeight: 600, color: "#1C1C1E" },
  commentTime: { fontSize: "11px", color: "#8E8E93" },
  commentText: { fontSize: "14px", color: "#3A3A3C", margin: 0, lineHeight: 1.5 },
};

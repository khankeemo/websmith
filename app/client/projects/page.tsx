"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, LayoutGrid, List, Kanban } from "lucide-react";
import API from "../../../core/services/apiService";
import Card from "../../../components/ui/Card";
import KanbanBoard from "../../../components/ui/KanbanBoard";

interface Project {
  _id: string;
  name: string;
  description: string;
  client: string;
  status: "pending" | "in-progress" | "completed" | "on-hold";
  progress: number;
  startDate: string;
  endDate?: string;
  expectedCompletionDate?: string;
  projectType: string;
  budget?: number;
  createdAt: string;
}

type ViewMode = "grid" | "list" | "kanban";

export default function ClientProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const userResponse = await API.get("/users/me");
        setUserRole(userResponse.data.user.role);
        
        if (userResponse.data.user.role !== "client") {
          router.push("/");
          return;
        }

        const projectsResponse = await API.get("/projects");
        setProjects(projectsResponse.data.data || []);
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
      pending: "#FF9500",
      "in-progress": "#007AFF",
      completed: "#34C759",
      "on-hold": "#FF3B30",
    };
    return colors[status] || "#8E8E93";
  };

  const handleCardDrop = async (cardId: string, fromStatus: string, toStatus: string) => {
    // Clients have view-only access, so this is disabled
    console.log("Clients cannot update project status");
  };

  const kanbanColumns = [
    { id: "pending", title: "Pending", status: "pending", color: "#FF9500" },
    { id: "in-progress", title: "In Progress", status: "in-progress", color: "#007AFF" },
    { id: "completed", title: "Completed", status: "completed", color: "#34C759" },
  ];

  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === "in-progress").length,
    completed: projects.filter((p) => p.status === "completed").length,
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>My Projects</h1>
          <p style={styles.subtitle}>Track your project progress and milestones</p>
        </div>
        <div style={styles.viewToggle}>
          <button
            onClick={() => setViewMode("grid")}
            style={{ ...styles.toggleBtn, ...(viewMode === "grid" ? styles.toggleActive : {}) }}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            style={{ ...styles.toggleBtn, ...(viewMode === "list" ? styles.toggleActive : {}) }}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            style={{ ...styles.toggleBtn, ...(viewMode === "kanban" ? styles.toggleActive : {}) }}
          >
            <Kanban size={16} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <Folder size={24} color="#007AFF" />
          <div>
            <p style={styles.statValue}>{stats.total}</p>
            <p style={styles.statLabel}>Total Projects</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <Folder size={24} color="#FF9500" />
          <div>
            <p style={styles.statValue}>{stats.active}</p>
            <p style={styles.statLabel}>In Progress</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <Folder size={24} color="#34C759" />
          <div>
            <p style={styles.statValue}>{stats.completed}</p>
            <p style={styles.statLabel}>Completed</p>
          </div>
        </div>
      </div>

      {/* Projects Display */}
      {viewMode === "kanban" ? (
        <KanbanBoard
          columns={kanbanColumns}
          cards={projects.map((p) => ({
            ...p,
            title: p.name,
            subtitle: `Progress: ${p.progress}%`,
          }))}
          onCardDrop={handleCardDrop}
        />
      ) : viewMode === "grid" ? (
        <div style={styles.grid}>
          {projects.map((project) => (
            <Card key={project._id}>
              <div style={styles.projectCard}>
                <div style={styles.projectHeader}>
                  <h3 style={styles.projectName}>{project.name}</h3>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: `${getStatusColor(project.status)}20`,
                      color: getStatusColor(project.status),
                    }}
                  >
                    {project.status.replace("-", " ")}
                  </span>
                </div>
                <p style={styles.projectDesc}>{project.description}</p>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${project.progress}%`,
                      backgroundColor: getStatusColor(project.status),
                    }}
                  ></div>
                </div>
                <p style={styles.progressText}>{project.progress}% Complete</p>
                <div style={styles.projectMeta}>
                  <span>📅 Started: {new Date(project.startDate).toLocaleDateString()}</span>
                  {project.expectedCompletionDate && (
                    <span>• Due: {new Date(project.expectedCompletionDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={styles.list}>
          {projects.map((project) => (
            <div key={project._id} style={styles.listRow}>
              <div style={styles.listInfo}>
                <strong>{project.name}</strong>
                <p style={styles.listMeta}>{project.description}</p>
              </div>
              <span
                style={{
                  ...styles.statusBadge,
                  backgroundColor: `${getStatusColor(project.status)}20`,
                  color: getStatusColor(project.status),
                }}
              >
                {project.status.replace("-", " ")}
              </span>
              <div style={styles.listProgress}>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${project.progress}%`,
                    }}
                  ></div>
                </div>
                <span style={styles.progressText}>{project.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {projects.length === 0 && (
        <div style={styles.emptyContainer}>
          <Folder size={48} color="#C6C6C8" />
          <h3 style={styles.emptyTitle}>No projects yet</h3>
          <p style={styles.emptyText}>Your assigned projects will appear here</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, any> = {
  container: { padding: "24px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "24px" },
  title: { margin: 0, fontSize: "34px", fontWeight: 700, color: "#1C1C1E" },
  subtitle: { margin: "8px 0 0", color: "#8E8E93" },
  viewToggle: { display: "flex", background: "#F2F2F7", borderRadius: "12px", padding: "4px" },
  toggleBtn: { border: "none", background: "transparent", padding: "8px 10px", borderRadius: "8px", cursor: "pointer" },
  toggleActive: { background: "#fff" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" },
  statCard: { display: "flex", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #E5E5EA", borderRadius: "16px", padding: "20px" },
  statValue: { margin: 0, fontSize: "28px", fontWeight: 700, color: "#1C1C1E" },
  statLabel: { margin: "4px 0 0", fontSize: "13px", color: "#8E8E93" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" },
  projectCard: { display: "flex", flexDirection: "column", gap: "12px" },
  projectHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" },
  projectName: { margin: 0, fontSize: "18px", fontWeight: 600, color: "#1C1C1E" },
  statusBadge: { padding: "6px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, textTransform: "capitalize" },
  projectDesc: { margin: 0, fontSize: "14px", color: "#8E8E93", lineHeight: 1.5 },
  progressBar: { width: "100%", height: "8px", backgroundColor: "#F2F2F7", borderRadius: "4px", overflow: "hidden" },
  progressFill: { height: "100%", transition: "width 0.3s ease" },
  progressText: { margin: 0, fontSize: "13px", color: "#8E8E93", fontWeight: 500 },
  projectMeta: { fontSize: "13px", color: "#8E8E93" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  listRow: { display: "grid", gridTemplateColumns: "1.5fr auto 1fr", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #E5E5EA", borderRadius: "16px", padding: "16px 20px" },
  listInfo: { display: "flex", flexDirection: "column", gap: "4px" },
  listMeta: { margin: 0, fontSize: "13px", color: "#8E8E93" },
  listProgress: { display: "flex", alignItems: "center", gap: "12px" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px", gap: "16px" },
  spinner: { width: "40px", height: "40px", border: "3px solid #E5E5EA", borderTopColor: "#007AFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  emptyContainer: { textAlign: "center", padding: "60px" },
  emptyTitle: { fontSize: "20px", fontWeight: 600, color: "#1C1C1E", marginTop: "16px", marginBottom: "8px" },
  emptyText: { fontSize: "14px", color: "#8E8E93" },
};

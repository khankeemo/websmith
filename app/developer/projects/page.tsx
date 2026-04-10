"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, LayoutGrid, List } from "lucide-react";
import API from "../../../core/services/apiService";
import Card from "../../../components/ui/Card";

interface Project {
  _id: string;
  name: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "on-hold";
  progress: number;
  startDate: string;
  endDate?: string;
  expectedCompletionDate?: string;
  technologies?: string[];
  createdAt: string;
}

type ViewMode = "grid" | "list";

export default function DeveloperProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [loading, setLoading] = useState(true);

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

  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === "in-progress").length,
    completed: projects.filter((p) => p.status === "completed").length,
    onHold: projects.filter((p) => p.status === "on-hold").length,
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
          <p style={styles.subtitle}>View and manage your assigned projects</p>
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
        <div style={styles.statCard}>
          <Folder size={24} color="#FF3B30" />
          <div>
            <p style={styles.statValue}>{stats.onHold}</p>
            <p style={styles.statLabel}>On Hold</p>
          </div>
        </div>
      </div>

      {/* Projects Display */}
      {viewMode === "grid" ? (
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
                
                {project.technologies && project.technologies.length > 0 && (
                  <div style={styles.techStack}>
                    {project.technologies.slice(0, 4).map((tech, index) => (
                      <span key={index} style={styles.techBadge}>{tech}</span>
                    ))}
                    {project.technologies.length > 4 && (
                      <span style={styles.moreTech}>+{project.technologies.length - 4}</span>
                    )}
                  </div>
                )}

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
                <strong style={styles.listTitle}>{project.name}</strong>
                <p style={styles.listMeta}>{project.description}</p>
                {project.technologies && (
                  <div style={styles.listTech}>
                    {project.technologies.slice(0, 3).map((tech, index) => (
                      <span key={index} style={styles.techBadge}>{tech}</span>
                    ))}
                  </div>
                )}
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
          <h3 style={styles.emptyTitle}>No projects assigned</h3>
          <p style={styles.emptyText}>Projects assigned to you will appear here</p>
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
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" },
  statCard: { display: "flex", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #E5E5EA", borderRadius: "16px", padding: "20px" },
  statValue: { margin: 0, fontSize: "28px", fontWeight: 700, color: "#1C1C1E" },
  statLabel: { margin: "4px 0 0", fontSize: "13px", color: "#8E8E93" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" },
  projectCard: { display: "flex", flexDirection: "column", gap: "12px" },
  projectHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" },
  projectName: { margin: 0, fontSize: "18px", fontWeight: 600, color: "#1C1C1E" },
  statusBadge: { padding: "6px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, textTransform: "capitalize" },
  projectDesc: { margin: 0, fontSize: "14px", color: "#8E8E93", lineHeight: 1.5 },
  techStack: { display: "flex", flexWrap: "wrap", gap: "6px" },
  techBadge: { padding: "4px 10px", background: "#F2F2F7", borderRadius: "12px", fontSize: "12px", color: "#3A3A3C", fontWeight: 500 },
  moreTech: { padding: "4px 10px", background: "#E5E5EA", borderRadius: "12px", fontSize: "12px", color: "#8E8E93" },
  progressBar: { width: "100%", height: "8px", backgroundColor: "#F2F2F7", borderRadius: "4px", overflow: "hidden" },
  progressFill: { height: "100%", transition: "width 0.3s ease" },
  progressText: { margin: 0, fontSize: "13px", color: "#8E8E93", fontWeight: 500 },
  projectMeta: { fontSize: "13px", color: "#8E8E93" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  listRow: { display: "grid", gridTemplateColumns: "1.5fr auto 1fr", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #E5E5EA", borderRadius: "16px", padding: "16px 20px" },
  listInfo: { display: "flex", flexDirection: "column", gap: "4px" },
  listTitle: { fontSize: "16px", color: "#1C1C1E" },
  listMeta: { margin: 0, fontSize: "13px", color: "#8E8E93" },
  listTech: { display: "flex", gap: "6px", marginTop: "4px" },
  listProgress: { display: "flex", alignItems: "center", gap: "12px" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px", gap: "16px" },
  spinner: { width: "40px", height: "40px", border: "3px solid #E5E5EA", borderTopColor: "#007AFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  emptyContainer: { textAlign: "center", padding: "60px" },
  emptyTitle: { fontSize: "20px", fontWeight: 600, color: "#1C1C1E", marginTop: "16px", marginBottom: "8px" },
  emptyText: { fontSize: "14px", color: "#8E8E93" },
};

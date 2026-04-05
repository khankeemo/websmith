"use client";

import { useEffect, useState } from "react";
import { Calendar, FolderOpen } from "lucide-react";
import { getProjects, Project } from "../../projects/services/projectService";

export default function ClientProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    getProjects().then(setProjects).catch((error) => console.error("Client projects error:", error));
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Projects</h1>
        <p style={styles.subtitle}>View your assigned projects and latest delivery updates</p>
      </div>

      <div style={styles.grid}>
        {projects.map((project) => {
          const latestUpdate = project.statusUpdates?.[project.statusUpdates.length - 1];

          return (
            <div key={project._id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.iconWrap}>
                  <FolderOpen size={20} color="#007AFF" />
                </div>
                <span style={styles.badge}>{project.status}</span>
              </div>
              <h3 style={styles.cardTitle}>{project.name}</h3>
              <p style={styles.cardText}>{project.description}</p>
              <div style={styles.metaRow}>
                <Calendar size={14} color="#8E8E93" />
                <span style={styles.metaText}>{new Date(project.startDate).toLocaleDateString()}</span>
              </div>
              <div style={styles.updateBox}>
                <p style={styles.updateLabel}>Latest Status Update</p>
                <p style={styles.updateText}>{latestUpdate?.note || "No update shared yet."}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: any = {
  container: { padding: "8px 4px" },
  header: { marginBottom: "24px" },
  title: { fontSize: "34px", fontWeight: 600, color: "#1C1C1E", margin: 0, marginBottom: "8px", letterSpacing: "-0.5px" },
  subtitle: { fontSize: "15px", color: "#8E8E93", margin: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" },
  card: { backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E5E5EA", padding: "20px" },
  cardHeader: { display: "flex", justifyContent: "space-between", marginBottom: "16px" },
  iconWrap: { width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "#E3F2FF", display: "flex", alignItems: "center", justifyContent: "center" },
  badge: { padding: "4px 10px", borderRadius: "20px", backgroundColor: "#F2F2F7", color: "#1C1C1E", fontSize: "12px", textTransform: "capitalize" as const },
  cardTitle: { fontSize: "18px", fontWeight: 600, color: "#1C1C1E", margin: 0, marginBottom: "8px" },
  cardText: { fontSize: "14px", color: "#6C6C70", margin: 0, marginBottom: "16px", lineHeight: 1.5 },
  metaRow: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" },
  metaText: { fontSize: "13px", color: "#8E8E93" },
  updateBox: { backgroundColor: "#F9F9FB", borderRadius: "12px", padding: "14px" },
  updateLabel: { fontSize: "12px", color: "#8E8E93", margin: 0, marginBottom: "6px" },
  updateText: { fontSize: "14px", color: "#1C1C1E", margin: 0 },
};

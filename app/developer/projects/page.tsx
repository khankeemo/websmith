"use client";

import { useEffect, useState } from "react";
import { Project, getProjects, updateProjectStatus } from "../../projects/services/projectService";

export default function DeveloperProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  const loadProjects = async () => {
    const data = await getProjects();
    setProjects(data);
  };

  useEffect(() => {
    loadProjects().catch((error) => console.error("Developer projects error:", error));
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    await updateProjectStatus(id, { status, note: `Updated to ${status}` });
    await loadProjects();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Projects</h1>
        <p style={styles.subtitle}>Update project delivery status for your assigned work</p>
      </div>
      <div style={styles.grid}>
        {projects.map((project) => (
          <div key={project._id} style={styles.card}>
            <h3 style={styles.cardTitle}>{project.name}</h3>
            <p style={styles.cardText}>{project.description}</p>
            <div style={styles.row}>
              <span style={styles.label}>Current Status</span>
              <span style={styles.value}>{project.status}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Progress</span>
              <span style={styles.value}>{project.progress || 0}%</span>
            </div>
            <select value={project.status} onChange={(e) => handleStatusChange(project._id!, e.target.value)} style={styles.select}>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on-hold">On Hold</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: any = {
  container: { padding: "8px 4px" },
  header: { marginBottom: "24px" },
  title: { fontSize: "34px", fontWeight: 600, color: "#1C1C1E", margin: 0, marginBottom: "8px", letterSpacing: "-0.5px" },
  subtitle: { fontSize: "15px", color: "#8E8E93", margin: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" },
  card: { backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E5E5EA", padding: "20px" },
  cardTitle: { fontSize: "18px", fontWeight: 600, color: "#1C1C1E", margin: 0, marginBottom: "8px" },
  cardText: { fontSize: "14px", color: "#6C6C70", margin: 0, marginBottom: "16px", lineHeight: 1.5 },
  row: { display: "flex", justifyContent: "space-between", marginBottom: "10px" },
  label: { fontSize: "13px", color: "#8E8E93" },
  value: { fontSize: "13px", color: "#1C1C1E", textTransform: "capitalize" as const },
  select: { width: "100%", marginTop: "8px", padding: "12px 14px", border: "1.5px solid #E5E5EA", borderRadius: "12px", fontSize: "14px", fontFamily: "inherit", backgroundColor: "#FFFFFF" },
};

"use client";

import { useEffect, useState } from "react";
import { FolderOpen, CheckCircle2, Clock3 } from "lucide-react";
import Card from "../../../components/ui/Card";
import API from "../../../core/services/apiService";

export default function DeveloperDashboardPage() {
  const [stats, setStats] = useState({ projects: 0, clients: 0, tasks: 0, revenue: 0, completedTasks: 0 });

  useEffect(() => {
    API.get("/stats")
      .then((response) => setStats(response.data.data))
      .catch((error) => console.error("Developer dashboard error:", error));
  }, []);

  const cards = [
    { label: "Assigned Projects", value: stats.projects, icon: FolderOpen, color: "#007AFF", bg: "#E3F2FF" },
    { label: "Active Deliveries", value: stats.tasks, icon: Clock3, color: "#FF9500", bg: "#FFF4E5" },
    { label: "Completed Tasks", value: stats.completedTasks, icon: CheckCircle2, color: "#34C759", bg: "#E8F5E9" },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>Manage delivery timelines and publish project progress</p>
      </div>
      <div style={styles.grid}>
        {cards.map((card) => (
          <Card key={card.label}>
            <div style={styles.cardContent}>
              <div style={{ ...styles.iconWrap, backgroundColor: card.bg }}>
                <card.icon size={22} color={card.color} />
              </div>
              <div>
                <p style={styles.cardLabel}>{card.label}</p>
                <p style={styles.cardValue}>{card.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const styles: any = {
  container: { padding: "8px 4px", display: "flex", flexDirection: "column", gap: "24px" },
  header: {},
  title: { fontSize: "34px", fontWeight: 600, color: "#1C1C1E", margin: 0, marginBottom: "8px", letterSpacing: "-0.5px" },
  subtitle: { fontSize: "15px", color: "#8E8E93", margin: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" },
  cardContent: { display: "flex", gap: "16px", alignItems: "center" },
  iconWrap: { width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" },
  cardLabel: { margin: 0, fontSize: "13px", color: "#8E8E93" },
  cardValue: { margin: "6px 0 0 0", fontSize: "28px", fontWeight: 600, color: "#1C1C1E" },
};

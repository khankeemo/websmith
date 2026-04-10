"use client";

import { useEffect, useState } from "react";
import { Folder, CreditCard, LifeBuoy, TrendingUp } from "lucide-react";
import Card from "../../../components/ui/Card";
import API from "../../../core/services/apiService";

export default function ClientDashboardPage() {
  const [stats, setStats] = useState({ projects: 0, clients: 0, tasks: 0, revenue: 0, completedTasks: 0, activeProjects: 0 });
  const [tickets, setTickets] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const [statsResponse, ticketsResponse] = await Promise.all([
        API.get("/stats"),
        API.get("/tickets"),
      ]);

      setStats(statsResponse.data.data);
      setTickets((ticketsResponse.data.data || []).length);
    };

    fetchData().catch((error) => console.error("Client dashboard error:", error));
  }, []);

  const cards = [
    { label: "Assigned Projects", value: stats.projects, icon: Folder, color: "#007AFF", bg: "#E3F2FF" },
    { label: "Completed Payments", value: stats.revenue, icon: CreditCard, color: "#34C759", bg: "#E8F5E9", currency: true },
    { label: "Open Tickets", value: tickets, icon: LifeBuoy, color: "#FF9500", bg: "#FFF4E5" },
    { label: "Active Tasks", value: stats.tasks, icon: TrendingUp, color: "#AF52DE", bg: "#F3E8FF" },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.subtitle}>Track project progress, billing, and support updates</p>
        </div>
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
                <p style={styles.cardValue}>{card.currency ? `$${Number(card.value).toLocaleString()}` : card.value}</p>
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
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: "34px", fontWeight: 600, color: "#1C1C1E", margin: 0, marginBottom: "8px", letterSpacing: "-0.5px" },
  subtitle: { fontSize: "15px", color: "#8E8E93", margin: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" },
  cardContent: { display: "flex", gap: "16px", alignItems: "center" },
  iconWrap: { width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" },
  cardLabel: { margin: 0, fontSize: "13px", color: "#8E8E93" },
  cardValue: { margin: "6px 0 0 0", fontSize: "28px", fontWeight: 600, color: "#1C1C1E" },
};

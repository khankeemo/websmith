"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, CalendarClock, CreditCard, FolderKanban, LifeBuoy, TrendingUp } from "lucide-react";
import Card from "../../../components/ui/Card";
import API from "../../../core/services/apiService";

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  timestamp: string;
};

type DeadlineProject = {
  _id: string;
  name: string;
  expectedCompletionDate: string;
  status: string;
  progress: number;
};

type DashboardStats = {
  projects: number;
  activeProjects: number;
  completedTasks: number;
  revenue: number;
  unreadNotifications: number;
  openQueries: number;
  recentActivity: ActivityItem[];
  upcomingDeadlines: DeadlineProject[];
  overdueProjects: DeadlineProject[];
};

const defaultStats: DashboardStats = {
  projects: 0,
  activeProjects: 0,
  completedTasks: 0,
  revenue: 0,
  unreadNotifications: 0,
  openQueries: 0,
  recentActivity: [],
  upcomingDeadlines: [],
  overdueProjects: [],
};

export default function ClientDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await API.get("/stats");
        setStats({ ...defaultStats, ...(response.data.data || {}) });
      } catch (err: any) {
        console.error("Client dashboard error:", err);
        setError(err.response?.data?.message || "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const cards = useMemo(
    () => [
      { label: "Assigned Projects", value: stats.projects, icon: FolderKanban, color: "#007AFF", bg: "rgba(0, 122, 255, 0.16)" },
      { label: "Active Projects", value: stats.activeProjects, icon: TrendingUp, color: "#0F9D7A", bg: "rgba(15, 157, 122, 0.16)" },
      { label: "Open Queries", value: stats.openQueries, icon: LifeBuoy, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)" },
      { label: "Unread Alerts", value: stats.unreadNotifications, icon: Bell, color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.16)" },
      { label: "Completed Payments", value: `$${Number(stats.revenue || 0).toLocaleString()}`, icon: CreditCard, color: "#10B981", bg: "rgba(16, 185, 129, 0.16)" },
      { label: "Completed Tasks", value: stats.completedTasks, icon: CalendarClock, color: "#EF4444", bg: "rgba(239, 68, 68, 0.16)" },
    ],
    [stats]
  );

  if (loading) {
    return <div style={styles.state}>Loading your dashboard...</div>;
  }

  if (error) {
    return <div style={styles.state}>{error}</div>;
  }

  return (
    <div style={styles.container} className="wsd-page">
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.subtitle}>A live snapshot of your project health, deadlines, and communication.</p>
        </div>
      </div>

      <div style={styles.cardGrid}>
        {cards.map((card) => (
          <Card key={card.label}>
            <div style={styles.metricCard}>
              <div style={{ ...styles.metricIcon, backgroundColor: card.bg }}>
                <card.icon size={20} color={card.color} />
              </div>
              <div>
                <p style={styles.metricLabel}>{card.label}</p>
                <p style={styles.metricValue}>{card.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={styles.contentGrid}>
        <Card>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Recent Activity</h2>
          </div>
          {stats.recentActivity.length === 0 ? (
            <p style={styles.emptyText}>No recent activity yet.</p>
          ) : (
            <div style={styles.timeline}>
              {stats.recentActivity.map((activity) => (
                <div key={activity.id} style={styles.timelineItem}>
                  <div style={styles.timelineDot} />
                  <div>
                    <p style={styles.timelineTitle}>{activity.title}</p>
                    <p style={styles.timelineTime}>{new Date(activity.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Upcoming Deadlines</h2>
          </div>
          {stats.upcomingDeadlines.length === 0 ? (
            <p style={styles.emptyText}>Nothing due in the next 7 days.</p>
          ) : (
            <div style={styles.alertList}>
              {stats.upcomingDeadlines.map((project) => (
                <div key={project._id} style={styles.alertCard}>
                  <div>
                    <p style={styles.alertTitle}>{project.name}</p>
                    <p style={styles.alertMeta}>Due {new Date(project.expectedCompletionDate).toLocaleDateString()}</p>
                  </div>
                  <span style={styles.progressPill}>{project.progress || 0}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Overdue Alerts</h2>
        </div>
        {stats.overdueProjects.length === 0 ? (
          <p style={styles.emptyText}>No overdue projects right now.</p>
        ) : (
          <div style={styles.overdueList}>
            {stats.overdueProjects.map((project) => (
              <div key={project._id} style={styles.overdueCard}>
                <AlertCircle size={18} color="#DC2626" />
                <div style={{ flex: 1 }}>
                  <p style={styles.alertTitle}>{project.name}</p>
                  <p style={styles.alertMeta}>
                    Missed {new Date(project.expectedCompletionDate).toLocaleDateString()} with status {project.status.replace("-", " ")}
                  </p>
                </div>
                <span style={{ ...styles.progressPill, backgroundColor: "rgba(220, 38, 38, 0.2)", color: "var(--text-primary)" }}>
                  {project.progress || 0}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const styles: Record<string, any> = {
  container: { padding: 0, display: "flex", flexDirection: "column", gap: "24px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { margin: 0, fontSize: "34px", fontWeight: 700, color: "var(--text-primary)" },
  subtitle: { margin: "8px 0 0", color: "var(--text-secondary)" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" },
  metricCard: { display: "flex", alignItems: "center", gap: "14px" },
  metricIcon: { width: "46px", height: "46px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center" },
  metricLabel: { margin: 0, fontSize: "13px", color: "var(--text-secondary)" },
  metricValue: { margin: "4px 0 0", fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" },
  contentGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" },
  sectionHeader: { marginBottom: "14px" },
  sectionTitle: { margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" },
  timeline: { display: "flex", flexDirection: "column", gap: "14px" },
  timelineItem: { display: "flex", gap: "12px", alignItems: "flex-start" },
  timelineDot: { width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#007AFF", marginTop: "7px", flexShrink: 0 },
  timelineTitle: { margin: 0, color: "var(--text-primary)", fontWeight: 600 },
  timelineTime: { margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "12px" },
  emptyText: { margin: 0, color: "var(--text-secondary)" },
  alertList: { display: "flex", flexDirection: "column", gap: "12px" },
  alertCard: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "14px", border: "1px solid var(--border-color)", borderRadius: "14px", backgroundColor: "var(--bg-secondary)" },
  overdueList: { display: "flex", flexDirection: "column", gap: "12px" },
  overdueCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px",
    border: "1px solid rgba(220, 38, 38, 0.35)",
    borderRadius: "14px",
    backgroundColor: "rgba(220, 38, 38, 0.1)",
  },
  alertTitle: { margin: 0, color: "var(--text-primary)", fontWeight: 600 },
  alertMeta: { margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "13px" },
  progressPill: {
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "rgba(0, 122, 255, 0.16)",
    color: "#0A84FF",
    fontSize: "12px",
    fontWeight: 700,
  },
  state: { padding: "48px 12px", color: "var(--text-secondary)" },
};

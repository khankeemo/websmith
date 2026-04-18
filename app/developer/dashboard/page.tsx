"use client";

import { useEffect, useState } from "react";
import { FolderOpen, CheckCircle2, Clock3, AlertTriangle, TrendingUp, Activity, Calendar } from "lucide-react";
import Card from "../../../components/ui/Card";
import API from "../../../core/services/apiService";

export default function DeveloperDashboardPage() {
  const [stats, setStats] = useState<any>({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalTasks: 0,
    tasksByStatus: { pending: 0, inProgress: 0, review: 0, completed: 0 },
    tasksByPriority: { high: 0, medium: 0, low: 0 },
    upcomingDeadlines: 0,
    overdueTasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setStatsError(null);
      try {
        const statsResponse = await API.get("/stats/developer");
        const developerStats = statsResponse.data.data;
        
        setStats(developerStats);
        setRecentActivity(developerStats.recentActivity || []);
        setUpcomingDeadlines(developerStats.upcomingDeadlineTasks || []);
        setOverdueTasks(developerStats.overdueTaskList || []);
      } catch (error: any) {
        console.error("Developer dashboard error:", error);
        const msg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Could not load dashboard statistics.";
        setStatsError(typeof msg === "string" ? msg : "Could not load dashboard statistics.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const cards = [
    { label: "Assigned Projects", value: stats.totalProjects, icon: FolderOpen, color: "#007AFF", bg: "rgba(0, 122, 255, 0.16)" },
    { label: "Active Projects", value: stats.activeProjects, icon: Activity, color: "#FF9500", bg: "rgba(255, 149, 0, 0.16)" },
    { label: "Total Tasks", value: stats.totalTasks, icon: CheckCircle2, color: "#34C759", bg: "rgba(52, 199, 89, 0.16)" },
    { label: "In Progress", value: stats.tasksByStatus?.inProgress || 0, icon: Clock3, color: "#007AFF", bg: "rgba(0, 122, 255, 0.16)" },
  ];

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ color: "var(--text-secondary)" }}>Loading developer stats...</p>
      </div>
    );
  }

  return (
    <div style={styles.container} className="wsd-page">
      <div style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>Manage delivery timelines and publish project progress</p>
      </div>
      {statsError && (
        <div style={styles.errorBanner} role="alert">
          <p style={styles.errorBannerText}>{statsError}</p>
        </div>
      )}
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

      {/* Main Content Grid */}
      <div style={styles.mainGrid}>
        {/* Recent Activity */}
        <Card>
          <div style={styles.sectionHeader}>
            <div>
              <h3 style={styles.sectionTitle}>Recent Activity</h3>
              <p style={styles.sectionSubtitle}>Latest task updates and changes</p>
            </div>
            <Activity size={20} color="#007AFF" />
          </div>
          <div style={styles.activityList}>
            {recentActivity.slice(0, 6).map((activity, index) => (
              <div key={activity.id || index} style={styles.activityItem}>
                <div style={{ 
                  ...styles.activityDot, 
                  backgroundColor: activity.type === "task" ? "#007AFF" : "#34C759"
                }}></div>
                <div style={styles.activityContent}>
                  <p style={styles.activityText}>{activity.title}</p>
                  <p style={styles.activityTime}>
                    {activity.timestamp
                      ? new Date(activity.timestamp).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '—'}
                  </p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p style={styles.emptyText}>No recent activity</p>
            )}
          </div>
        </Card>

        {/* Task Priority Distribution */}
        <Card>
          <div style={styles.sectionHeader}>
            <div>
              <h3 style={styles.sectionTitle}>Task Priorities</h3>
              <p style={styles.sectionSubtitle}>Workload distribution by priority</p>
            </div>
            <AlertTriangle size={20} color="#FF9500" />
          </div>
          <div style={styles.priorityList}>
            {[
              { label: 'High', count: stats.tasksByPriority?.high || 0, color: '#FF9500', bg: 'rgba(255, 149, 0, 0.16)' },
              { label: 'Medium', count: stats.tasksByPriority?.medium || 0, color: '#007AFF', bg: 'rgba(0, 122, 255, 0.16)' },
              { label: 'Low', count: stats.tasksByPriority?.low || 0, color: '#AEAEB2', bg: 'rgba(142, 142, 147, 0.2)' },
            ].map((priority) => (
              <div key={priority.label} style={styles.priorityItem}>
                <div style={{
                  ...styles.priorityDot,
                  backgroundColor: priority.color
                }}></div>
                <div style={styles.priorityInfo}>
                  <p style={styles.priorityLabel}>{priority.label}</p>
                  <p style={styles.priorityCount}>{priority.count} tasks</p>
                </div>
              </div>
            ))}
            {stats.totalTasks === 0 && (
              <p style={styles.emptyText}>No tasks assigned yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* Upcoming Deadlines */}
      {upcomingDeadlines.length > 0 && (
        <Card>
          <div style={styles.sectionHeader}>
            <div>
              <h3 style={styles.sectionTitle}>Upcoming Deadlines</h3>
              <p style={styles.sectionSubtitle}>Tasks due within the next 7 days</p>
            </div>
            <Calendar size={20} color="#FF9500" />
          </div>
          <div style={styles.deadlinesGrid}>
            {upcomingDeadlines.map((task) => {
              const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              const isUrgent = daysLeft <= 2;
              return (
                <div key={task._id} style={{
                  ...styles.deadlineCard,
                  borderLeft: `4px solid ${isUrgent ? '#FF3B30' : '#FF9500'}`
                }}>
                  <div style={styles.deadlineHeader}>
                    <strong style={styles.deadlineName}>{task.title}</strong>
                    {isUrgent && (
                      <span style={styles.urgentBadge}>
                        <AlertTriangle size={12} />
                        <span>Urgent</span>
                      </span>
                    )}
                  </div>
                  <div style={styles.deadlineFooter}>
                    <Clock3 size={14} color="var(--text-secondary)" />
                    <span style={styles.deadlineDate}>
                      {daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `Due in ${daysLeft} days`}
                    </span>
                    <span style={styles.deadlineDateText}>
                      {new Date(task.dueDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

const styles: any = {
  container: { 
    padding: 0, 
    display: "flex", 
    flexDirection: "column", 
    gap: "24px",
    backgroundColor: "var(--bg-primary)",
    minHeight: "100vh"
  },
  header: {},
  title: { 
    fontSize: "34px", 
    fontWeight: 700, 
    color: "var(--text-primary)", 
    margin: 0, 
    marginBottom: "8px", 
    letterSpacing: "-1px" 
  },
  subtitle: { fontSize: "15px", color: "var(--text-secondary)", margin: 0 },
  grid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", 
    gap: "20px" 
  },
  cardContent: { display: "flex", gap: "16px", alignItems: "center" },
  iconWrap: { 
    width: "48px", 
    height: "48px", 
    borderRadius: "12px", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center" 
  },
  cardLabel: { margin: 0, fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 },
  cardValue: { 
    margin: "6px 0 0 0", 
    fontSize: "28px", 
    fontWeight: 700, 
    color: "var(--text-primary)",
    letterSpacing: "-0.5px"
  },
  mainGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  sectionTitle: { fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0 },
  sectionSubtitle: { fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0 0" },
  activityList: { display: "flex", flexDirection: "column" as const, gap: "16px" },
  activityItem: { display: "flex", gap: "12px", alignItems: "flex-start" },
  activityDot: { width: "10px", height: "10px", borderRadius: "50%", marginTop: "6px", flexShrink: 0 },
  activityContent: { flex: 1 },
  activityText: { fontSize: "14px", color: "var(--text-primary)", margin: 0, marginBottom: "4px", lineHeight: 1.5 },
  activityTime: { fontSize: "12px", color: "var(--text-secondary)", margin: 0 },
  priorityList: { display: "flex", flexDirection: "column" as const, gap: "12px" },
  priorityItem: { display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "var(--bg-secondary)", borderRadius: "10px" },
  priorityDot: { width: "12px", height: "12px", borderRadius: "50%" },
  priorityInfo: { flex: 1 },
  priorityLabel: { fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 },
  priorityCount: { fontSize: "12px", color: "var(--text-secondary)", margin: "2px 0 0 0" },
  deadlinesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },
  deadlineCard: { padding: "16px", backgroundColor: "var(--bg-secondary)", borderRadius: "12px" },
  deadlineHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" },
  deadlineName: { fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", flex: 1 },
  urgentBadge: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    backgroundColor: "rgba(255, 59, 48, 0.18)",
    color: "#FF453A",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: 700,
  },
  deadlineFooter: { display: "flex", alignItems: "center", gap: "8px" },
  deadlineDate: { fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", flex: 1 },
  deadlineDateText: { fontSize: "11px", color: "var(--text-secondary)" },
  emptyText: { fontSize: "13px", color: "var(--text-secondary)", textAlign: "center" as const, padding: "20px" },
  errorBanner: {
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  errorBannerText: { margin: 0, fontSize: "14px", color: "var(--text-primary)" },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    gap: "16px",
  },
  spinner: {
    width: "32px",
    height: "32px",
    border: "3px solid var(--border-color)",
    borderTopColor: "#007AFF",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};

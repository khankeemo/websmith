"use client";

import { useEffect, useState } from "react";
import { Folder, CreditCard, LifeBuoy, TrendingUp, Calendar, Clock, AlertCircle, Activity } from "lucide-react";
import Card from "../../../components/ui/Card";
import API from "../../../core/services/apiService";

export default function ClientDashboardPage() {
  const [stats, setStats] = useState({ 
    projects: 0, 
    clients: 0, 
    tasks: 0, 
    revenue: 0, 
    completedTasks: 0, 
    activeProjects: 0,
    recentActivity: [] as Array<{ id: string; type: string; title: string; timestamp: string }>
  });
  const [tickets, setTickets] = useState(0);
  const [activeProjectsList, setActiveProjectsList] = useState<any[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsResponse, ticketsResponse, projectsResponse] = await Promise.all([
          API.get("/stats"),
          API.get("/tickets"),
          API.get("/projects"),
        ]);

        const statsData = statsResponse.data.data || { projects: 0, clients: 0, tasks: 0, revenue: 0, recentActivity: [] };
        setStats(statsData);
        setTickets((ticketsResponse.data.data || []).length);
        
        // Get active projects with progress
        const allProjects = projectsResponse.data.data || [];
        const active = allProjects.filter((p: any) => p.status === 'pending' || p.status === 'in-progress');
        setActiveProjectsList(active);
        
        // Find upcoming deadlines (within 7 days)
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const deadlines = allProjects
          .filter((p: any) => {
            if (!p.expectedCompletionDate) return false;
            const dueDate = new Date(p.expectedCompletionDate);
            return dueDate >= now && dueDate <= sevenDaysFromNow;
          })
          .sort((a: any, b: any) => new Date(a.expectedCompletionDate).getTime() - new Date(b.expectedCompletionDate).getTime());
        setUpcomingDeadlines(deadlines);
      } catch (error) {
        console.error("Client dashboard error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const cards = [
    { label: "Assigned Projects", value: stats.projects, icon: Folder, color: "#007AFF", bg: "#E3F2FF" },
    { label: "Active Projects", value: stats.activeProjects, icon: Activity, color: "#14B8A6", bg: "#E6FFFB" },
    { label: "Completed Payments", value: stats.revenue, icon: CreditCard, color: "#34C759", bg: "#E8F5E9", currency: true },
    { label: "Open Tickets", value: tickets, icon: LifeBuoy, color: "#FF9500", bg: "#FFF4E5" },
    { label: "Completed Tasks", value: stats.completedTasks, icon: TrendingUp, color: "#AF52DE", bg: "#F3E8FF" },
  ];

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ color: "var(--text-secondary)" }}>Loading your dashboard...</p>
      </div>
    );
  }

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
                <p style={styles.cardValue}>
                  {card.currency ? `$${Number(card.value).toLocaleString()}` : card.value}
                </p>
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
              <p style={styles.sectionSubtitle}>Latest updates from your projects</p>
            </div>
            <Activity size={20} color="#007AFF" />
          </div>
          <div style={styles.activityList}>
            {stats.recentActivity.slice(0, 6).map((activity, index) => (
              <div key={activity.id || index} style={styles.activityItem}>
                <div style={{ 
                  ...styles.activityDot, 
                  backgroundColor: activity.type === "project" ? "#007AFF" : 
                                  activity.type === "task" ? "#34C759" : "#FF9500" 
                }}></div>
                <div style={styles.activityContent}>
                  <p style={styles.activityText}>{activity.title}</p>
                  <p style={styles.activityTime}>
                    {new Date(activity.timestamp).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
            {stats.recentActivity.length === 0 && (
              <p style={styles.emptyText}>No recent activity</p>
            )}
          </div>
        </Card>

        {/* Active Projects Progress */}
        <Card>
          <div style={styles.sectionHeader}>
            <div>
              <h3 style={styles.sectionTitle}>Active Projects</h3>
              <p style={styles.sectionSubtitle}>Track ongoing project progress</p>
            </div>
            <TrendingUp size={20} color="#14B8A6" />
          </div>
          <div style={styles.projectsList}>
            {activeProjectsList.slice(0, 5).map((project) => (
              <div key={project._id} style={styles.projectItem}>
                <div style={styles.projectInfo}>
                  <p style={styles.projectName}>{project.name}</p>
                  <p style={styles.projectStatus}>{project.status.replace('-', ' ').toUpperCase()}</p>
                </div>
                <div style={styles.progressSection}>
                  <div style={styles.progressHeader}>
                    <span style={styles.progressLabel}>Progress</span>
                    <span style={styles.progressValue}>{project.progress || 0}%</span>
                  </div>
                  <div style={styles.progressBar}>
                    <div 
                      style={{ 
                        ...styles.progressFill, 
                        width: `${project.progress || 0}%`,
                        backgroundColor: (project.progress || 0) >= 75 ? '#34C759' : (project.progress || 0) >= 50 ? '#007AFF' : '#FF9500'
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
            {activeProjectsList.length === 0 && (
              <p style={styles.emptyText}>No active projects</p>
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
              <p style={styles.sectionSubtitle}>Projects due within the next 7 days</p>
            </div>
            <Calendar size={20} color="#FF9500" />
          </div>
          <div style={styles.deadlinesGrid}>
            {upcomingDeadlines.map((project) => {
              const daysLeft = Math.ceil((new Date(project.expectedCompletionDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              const isUrgent = daysLeft <= 3;
              return (
                <div key={project._id} style={{
                  ...styles.deadlineCard,
                  borderLeft: `4px solid ${isUrgent ? '#FF3B30' : '#FF9500'}`
                }}>
                  <div style={styles.deadlineHeader}>
                    <strong style={styles.deadlineName}>{project.name}</strong>
                    {isUrgent && (
                      <span style={styles.urgentBadge}>
                        <AlertCircle size={12} />
                        <span>Urgent</span>
                      </span>
                    )}
                  </div>
                  <div style={styles.deadlineFooter}>
                    <Clock size={14} color="#8E8E93" />
                    <span style={styles.deadlineDate}>
                      {daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `Due in ${daysLeft} days`}
                    </span>
                    <span style={styles.deadlineDateText}>
                      {new Date(project.expectedCompletionDate).toLocaleDateString('en-US', { 
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
    padding: "8px 4px", 
    display: "flex", 
    flexDirection: "column", 
    gap: "24px",
    backgroundColor: "var(--bg-primary)",
    minHeight: "100vh"
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
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

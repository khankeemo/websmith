"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API from "../../../core/services/apiService";
import Card from "../../../components/ui/Card";
import {
  Folder,
  Users,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Activity,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const chartData = [
  { name: "Jan", revenue: 1200 },
  { name: "Feb", revenue: 2100 },
  { name: "Mar", revenue: 1800 },
  { name: "Apr", revenue: 2400 },
  { name: "May", revenue: 3200 },
  { name: "Jun", revenue: 3800 },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  
  const [stats, setStats] = useState({
    projects: 0,
    clients: 0,
    tasks: 0,
    revenue: 0,
    developers: 0,
    completedTasks: 0,
    activeProjects: 0,
    recentActivity: [] as Array<{ id: string; type: string; title: string; timestamp: string }>,
  });
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const userResponse = await API.get("/users/me");
        setUserName(userResponse.data.user.name);
        
        if (userResponse.data.user.role !== "admin") {
          router.push("/");
          return;
        }

        const statsResponse = await API.get("/stats");
        setStats(statsResponse.data.data);
        setLoading(false);
      } catch (error) {
        console.error("Auth error:", error);
        localStorage.removeItem("token");
        router.push("/login");
      }
    };

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: Folder,
      label: "Total Projects",
      value: stats.projects,
      color: "#007AFF",
      bg: "rgba(0, 122, 255, 0.16)",
      trend: "+12%",
    },
    {
      icon: Users,
      label: "Active Clients",
      value: stats.clients,
      color: "#34C759",
      bg: "rgba(52, 199, 89, 0.16)",
      trend: "+8%",
    },
    {
      icon: CheckCircle,
      label: "Active Tasks",
      value: stats.tasks,
      color: "#FF9500",
      bg: "rgba(255, 149, 0, 0.16)",
      trend: "-3%",
    },
    {
      icon: DollarSign,
      label: "Total Revenue",
      value: `$${stats.revenue.toLocaleString()}`,
      color: "#AF52DE",
      bg: "rgba(175, 82, 222, 0.16)",
      trend: "+23%",
    },
    {
      icon: Users,
      label: "Total Developers",
      value: stats.developers,
      color: "#14B8A6",
      bg: "rgba(20, 184, 166, 0.16)",
      trend: "+5%",
    },
  ];

  return (
    <div style={styles.container} className="wsd-page">
      {/* HEADER SECTION */}
      <div style={styles.header} className="wsd-page-header">
        <div>
          <h1 style={styles.title} className="admin-dashboard-title">Dashboard</h1>
          <p style={styles.subtitle}>Welcome back, {userName}</p>
        </div>
        <div style={styles.headerBadge}>
          <TrendingUp size={16} />
          <span>Live Updates</span>
        </div>
      </div>

      {/* STATS GRID */}
      <div style={{ ...styles.grid, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }} className="wsd-grid-tiles">
        {statCards.map((card, index) => (
          <div key={index} style={styles.cardWrapper} className="zoom-card">
            <Card>
              <div style={styles.cardContent}>
                <div style={{ ...styles.iconContainer, backgroundColor: card.bg }}>
                  <card.icon size={22} color={card.color} />
                </div>
                <div>
                  <p style={styles.cardLabel}>{card.label}</p>
                  <p style={styles.cardValue}>{card.value}</p>
                  <p style={styles.cardTrend}>
                    <span style={{ color: card.trend.startsWith("+") ? "#34C759" : "#FF3B30" }}>
                      {card.trend}
                    </span>
                    {" from last month"}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* MAIN GRID */}
      <div style={styles.main} className="wsd-two-column">
        {/* CHART CARD */}
        <div className="zoom-card" style={styles.chartWrapper}>
          <Card>
            <div style={styles.chartHeader}>
              <div>
                <h3 style={styles.sectionTitle}>Revenue Overview</h3>
                <p style={styles.sectionSubtitle}>Monthly recurring revenue</p>
              </div>
              <div style={styles.chartBadge}>
                <Activity size={14} />
                <span>6 months</span>
              </div>
            </div>
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "12px",
                      padding: "8px 12px",
                      fontSize: "13px",
                      color: "var(--text-primary)",
                    }}
                    itemStyle={{ color: "#007AFF" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#007AFF"
                    strokeWidth={3}
                    dot={{ fill: "#007AFF", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ACTIVITY CARD */}
        <div className="zoom-card">
          <Card>
            <h3 style={styles.sectionTitle}>Recent Activity</h3>
            <div style={styles.activityList}>
              {stats.recentActivity.slice(0, 6).map((activity, index) => (
                <div key={activity.id || index} style={styles.activityItem}>
                  <div style={{ 
                    ...styles.activityDot, 
                    backgroundColor: activity.type === "project" ? "#007AFF" : 
                                    activity.type === "task" ? "#34C759" : "#FF9500" 
                  }}></div>
                  <div>
                    <p style={styles.activityText}>{activity.title}</p>
                    <p style={styles.activityTime}>
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
              {stats.recentActivity.length === 0 && (
                <p style={styles.activityTime}>No recent activity</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="zoom-card">
        <Card>
          <div style={styles.quickStats} className="wsd-grid-tiles">
            <div style={styles.quickStatItem}>
              <Clock size={24} color="#007AFF" />
              <div>
                <p style={styles.quickStatValue}>{stats.activeProjects}</p>
                <p style={styles.quickStatLabel}>Active Projects</p>
              </div>
            </div>
            <div style={styles.quickStatItem}>
              <CheckCircle size={24} color="#34C759" />
              <div>
                <p style={styles.quickStatValue}>{stats.completedTasks}</p>
                <p style={styles.quickStatLabel}>Completed Tasks</p>
              </div>
            </div>
            <div style={styles.quickStatItem}>
              <TrendingUp size={24} color="#AF52DE" />
              <div>
                <p style={styles.quickStatValue}>{stats.projects - stats.activeProjects}</p>
                <p style={styles.quickStatLabel}>Completed Projects</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <style jsx global>{`
        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .zoom-card {
          animation: zoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        
        .zoom-card:nth-child(1) { animation-delay: 0s; }
        .zoom-card:nth-child(2) { animation-delay: 0.05s; }
        .zoom-card:nth-child(3) { animation-delay: 0.1s; }
        .zoom-card:nth-child(4) { animation-delay: 0.15s; }
        
        .zoom-card:hover {
          transform: translateY(-4px);
          transition: transform 0.2s ease;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 640px) {
          .admin-dashboard-title {
            font-size: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    padding: "8px 4px",
    backgroundColor: "var(--bg-primary)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "8px",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 600,
    letterSpacing: "-0.5px",
    color: "var(--text-primary)",
  },
  subtitle: {
    margin: "4px 0 0 0",
    color: "var(--text-secondary)",
    fontSize: "15px",
  },
  headerBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "100px",
    fontSize: "13px",
    fontWeight: 500,
    color: "#007AFF",
    border: "1px solid var(--border-color)",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    gap: "16px",
  },
  loadingSpinner: {
    width: "40px",
    height: "40px",
    border: "3px solid var(--border-color)",
    borderTopColor: "#007AFF",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    color: "var(--text-secondary)",
    fontSize: "14px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "20px",
  },
  cardWrapper: {
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  cardContent: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardLabel: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-secondary)",
  },
  cardValue: {
    margin: "6px 0 0 0",
    fontSize: "28px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  cardTrend: {
    margin: "8px 0 0 0",
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  main: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "20px",
    minWidth: 0,
  },
  chartWrapper: {
    height: "100%",
    minWidth: 0,
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  chartBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 12px",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "100px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-color)",
  },
  chartContainer: {
    width: "100%",
    height: "280px",
    minWidth: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  sectionSubtitle: {
    margin: "4px 0 0 0",
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginTop: "8px",
  },
  activityItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 0",
    borderBottom: "1px solid var(--border-color)",
  },
  activityDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  activityText: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--text-primary)",
  },
  activityTime: {
    margin: "4px 0 0 0",
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  quickStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "24px",
  },
  quickStatItem: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  quickStatValue: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  quickStatLabel: {
    margin: 0,
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
};

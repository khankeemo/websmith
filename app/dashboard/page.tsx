"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API from "../../core/services/apiService";

import Card from "../../components/ui/Card";
import {
  Folder,
  Users,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Activity,
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
import { Ticket } from "../../core/services/ticketService";

const chartData = [
  { name: "Jan", revenue: 1200 },
  { name: "Feb", revenue: 2100 },
  { name: "Mar", revenue: 1800 },
  { name: "Apr", revenue: 2400 },
  { name: "May", revenue: 3200 },
  { name: "Jun", revenue: 3800 },
];

export default function DashboardPage() {
  const router = useRouter();
  
  const [stats, setStats] = useState({
    projects: 0,
    clients: 0,
    tasks: 0,
    revenue: 0,
  });
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChartReady, setIsChartReady] = useState(false);

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
        setUserRole(userResponse.data.user.role);
        
        const statsResponse = await API.get("/stats");
        setStats(statsResponse.data.data);

        if (userResponse.data.user.role === "admin") {
          const ticketResponse = await API.get("/tickets");
          setTickets(ticketResponse.data.data || []);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Auth error:", error);
        localStorage.removeItem("token");
        router.push("/login");
      }
    };

    fetchDashboardData();
  }, [router]);

  useEffect(() => {
    setIsChartReady(true);
  }, []);

  if (loading) {
    return (
      <div style={styles.container} className="wsd-page">
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
      bg: "rgba(0, 122, 255, 0.1)",
      trend: "+12%",
    },
    {
      icon: Users,
      label: "Active Clients",
      value: stats.clients,
      color: "#34C759",
      bg: "rgba(52, 199, 89, 0.1)",
      trend: "+8%",
    },
    {
      icon: CheckCircle,
      label: "Pending Tasks",
      value: stats.tasks,
      color: "#FF9500",
      bg: "rgba(255, 149, 0, 0.1)",
      trend: "-3%",
    },
    {
      icon: DollarSign,
      label: "Total Revenue",
      value: `$${stats.revenue.toLocaleString()}`,
      color: "#AF52DE",
      bg: "rgba(175, 82, 222, 0.1)",
      trend: "+23%",
    },
  ];

  return (
    <div style={styles.container} className="wsd-page">
      {/* HEADER SECTION */}
      <div style={styles.header} className="dashboard-header">
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.subtitle}>Welcome back, {userName}</p>
        </div>
        <div style={styles.headerBadge}>
          <TrendingUp size={16} />
          <span>Live Updates</span>
        </div>
      </div>

      {/* STATS GRID WITH ZOOM-IN ANIMATION */}
      <div style={styles.grid} className="dashboard-stats-grid">
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
      <div style={styles.main} className="dashboard-main-grid">
        {/* CHART CARD */}
        <div className="zoom-card" style={styles.chartWrapper}>
          <Card>
            <div style={styles.chartHeader} className="dashboard-chart-header">
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
              {isChartReady ? (
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
                      color: "var(--text-primary)"
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
              ) : (
                <div style={styles.chartSkeleton}></div>
              )}
            </div>
          </Card>
        </div>

        {/* ACTIVITY CARD */}
        <div className="zoom-card">
          <Card>
            <h3 style={styles.sectionTitle}>Recent Activity</h3>
            <div style={styles.activityList}>
              <div style={styles.activityItem}>
                <div style={styles.activityDotGreen}></div>
                <div>
                  <p style={styles.activityText}>Logged in successfully</p>
                  <p style={styles.activityTime}>Just now</p>
                </div>
              </div>
              <div style={styles.activityItem}>
                <div style={styles.activityDotBlue}></div>
                <div>
                  <p style={styles.activityText}>Dashboard loaded with real data</p>
                  <p style={styles.activityTime}>2 minutes ago</p>
                </div>
              </div>
              <div style={styles.activityItem}>
                <div style={styles.activityDotPurple}></div>
                <div>
                  <p style={styles.activityText}>Authentication verified</p>
                  <p style={styles.activityTime}>5 minutes ago</p>
                </div>
              </div>
              <div style={styles.activityItem}>
                <div style={styles.activityDotOrange}></div>
                <div>
                  <p style={styles.activityText}>
                    📁 {stats.projects} total projects in database
                  </p>
                  <p style={styles.activityTime}>Today</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {userRole === "admin" && (
        <div className="zoom-card">
          <Card>
            <div style={styles.chartHeader} className="dashboard-chart-header">
              <div>
                <h3 style={styles.sectionTitle}>Client Tickets</h3>
                <p style={styles.sectionSubtitle}>Newest support requests across active projects</p>
              </div>
            </div>
            <div style={styles.activityList}>
              {tickets.slice(0, 5).map((ticket) => (
                <div key={ticket._id} style={styles.activityItem}>
                  <div style={styles.activityDotOrange}></div>
                  <div>
                    <p style={styles.activityText}>{ticket.subject}</p>
                    <p style={styles.activityTime}>
                      {ticket.status} · {ticket.priority}
                    </p>
                  </div>
                </div>
              ))}
              {tickets.length === 0 && <p style={styles.activityTime}>No tickets raised yet.</p>}
            </div>
          </Card>
        </div>
      )}

      {/* GLOBAL STYLES FOR ANIMATIONS */}
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
        @media (max-width: 1100px) {
          .dashboard-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .dashboard-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 700px) {
          .dashboard-header,
          .dashboard-chart-header {
            flex-direction: column !important;
            gap: 12px;
          }
          .dashboard-stats-grid {
            grid-template-columns: 1fr !important;
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
    padding: 0,
    backgroundColor: "var(--bg-primary)",
  },

  // Header Styles
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "8px",
  },

  title: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 700,
    letterSpacing: "-1px",
    color: "var(--text-primary)",
  },

  subtitle: {
    margin: "4px 0 0 0",
    color: "var(--text-secondary)",
    fontSize: "15px",
    fontWeight: 400,
  },

  headerBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "100px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#007AFF",
    border: "1px solid var(--border-color)",
  },

  // Loading Styles
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

  // Grid Styles
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
    letterSpacing: "-0.2px",
  },

  cardValue: {
    margin: "6px 0 0 0",
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.5px",
  },

  cardTrend: {
    margin: "8px 0 0 0",
    fontSize: "12px",
    color: "var(--text-secondary)",
  },

  // Main Grid
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

  chartSkeleton: {
    width: "100%",
    height: "280px",
    borderRadius: "16px",
    background: "linear-gradient(90deg, var(--bg-secondary) 0%, var(--border-color) 50%, var(--bg-secondary) 100%)",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.3px",
  },

  sectionSubtitle: {
    margin: "4px 0 0 0",
    fontSize: "13px",
    color: "var(--text-secondary)",
  },

  // Activity Styles
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

  activityDotGreen: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#34C759",
  },

  activityDotBlue: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#007AFF",
  },

  activityDotPurple: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#AF52DE",
  },

  activityDotOrange: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#FF9500",
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
};

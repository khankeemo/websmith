"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Clock } from "lucide-react";
import API from "../../../core/services/apiService";
import Card from "../../../components/ui/Card";

interface Notification {
  _id: string;
  type: string;
  message: string;
  title: string;
  isRead: boolean;
  relatedId?: string;
  createdAt: string;
}

export default function DeveloperNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchNotifications();
  }, [router]);

  const fetchNotifications = async () => {
    try {
      const response = await API.get("/users/notifications");
      setNotifications(response.data.notifications || []);
      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      router.push("/login");
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await API.post(`/users/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await API.post("/users/notifications/mark-all-read");
      fetchNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const filteredNotifications =
    filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  const stats = {
    total: notifications.length,
    unread: notifications.filter((n) => !n.isRead).length,
    read: notifications.filter((n) => n.isRead).length,
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "project":
        return "📁";
      case "task":
        return "✅";
      case "ticket":
        return "🎫";
      case "payment":
        return "💰";
      default:
        return "🔔";
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading notifications...</p>
      </div>
    );
  }

  return (
    <div style={styles.container} className="wsd-page">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Notifications</h1>
          <p style={styles.subtitle}>Stay updated with your tasks and projects</p>
        </div>
        {stats.unread > 0 && (
          <button onClick={markAllAsRead} style={styles.markAllBtn}>
            <CheckCheck size={18} />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <Bell size={24} color="#007AFF" />
          <div>
            <p style={styles.statValue}>{stats.total}</p>
            <p style={styles.statLabel}>Total</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <Bell size={24} color="#FF9500" />
          <div>
            <p style={styles.statValue}>{stats.unread}</p>
            <p style={styles.statLabel}>Unread</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <CheckCheck size={24} color="#34C759" />
          <div>
            <p style={styles.statValue}>{stats.read}</p>
            <p style={styles.statLabel}>Read</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={styles.filterTabs}>
        <button
          onClick={() => setFilter("all")}
          style={{ ...styles.filterBtn, ...(filter === "all" ? styles.filterActive : {}) }}
        >
          All ({stats.total})
        </button>
        <button
          onClick={() => setFilter("unread")}
          style={{ ...styles.filterBtn, ...(filter === "unread" ? styles.filterActive : {}) }}
        >
          Unread ({stats.unread})
        </button>
      </div>

      {/* Notifications List */}
      <div style={styles.notificationsList}>
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => (
            <Card key={notification._id}>
              <div
                style={{
                  ...styles.notificationItem,
                  backgroundColor: notification.isRead ? "transparent" : "#E3F2FF",
                  borderLeft: notification.isRead ? "3px solid transparent" : "3px solid #007AFF",
                }}
              >
                <div style={styles.notificationIcon}>
                  {getIcon(notification.type)}
                </div>
                <div style={styles.notificationContent}>
                  <h4 style={styles.notificationTitle}>{notification.title}</h4>
                  <p style={styles.notificationMessage}>{notification.message}</p>
                  <div style={styles.notificationMeta}>
                    <Clock size={14} />
                    <span>{new Date(notification.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {!notification.isRead && (
                  <button onClick={() => markAsRead(notification._id)} style={styles.markReadBtn}>
                    Mark Read
                  </button>
                )}
              </div>
            </Card>
          ))
        ) : (
          <div style={styles.emptyContainer}>
            <Bell size={48} color="#C6C6C8" />
            <h3 style={styles.emptyTitle}>No notifications</h3>
            <p style={styles.emptyText}>
              {filter === "unread" ? "All caught up! No unread notifications" : "You have no notifications yet"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  container: { padding: 0 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "24px" },
  title: { margin: 0, fontSize: "34px", fontWeight: 700, color: "var(--text-primary)" },
  subtitle: { margin: "8px 0 0", color: "var(--text-secondary)" },
  markAllBtn: { display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", backgroundColor: "#007AFF", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" },
  statCard: { display: "flex", alignItems: "center", gap: "16px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "16px", padding: "20px" },
  statValue: { margin: 0, fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" },
  statLabel: { margin: "4px 0 0", fontSize: "13px", color: "var(--text-secondary)" },
  filterTabs: { display: "flex", gap: "12px", marginBottom: "24px" },
  filterBtn: { padding: "10px 20px", background: "var(--bg-secondary)", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 500, cursor: "pointer", color: "var(--text-secondary)" },
  filterActive: { background: "#007AFF", color: "#fff" },
  notificationsList: { display: "flex", flexDirection: "column", gap: "12px" },
  notificationItem: { display: "flex", gap: "16px", padding: "16px", transition: "all 0.2s ease" },
  notificationIcon: { fontSize: "32px", flexShrink: 0 },
  notificationContent: { flex: 1 },
  notificationTitle: { margin: "0 0 8px", fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" },
  notificationMessage: { margin: "0 0 12px", fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 },
  notificationMeta: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" },
  markReadBtn: { padding: "8px 16px", background: "#007AFF", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", alignSelf: "center" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px", gap: "16px" },
  spinner: { width: "40px", height: "40px", border: "3px solid var(--border-color)", borderTopColor: "#007AFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  emptyContainer: { textAlign: "center", padding: "60px" },
  emptyTitle: { fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginTop: "16px", marginBottom: "8px" },
  emptyText: { fontSize: "14px", color: "var(--text-secondary)" },
};

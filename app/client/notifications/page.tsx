"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle, Clock, MailOpen, Filter, TrendingUp, LifeBuoy, Folder, Mail } from "lucide-react";
import API from "../../../core/services/apiService";

interface Notification {
  _id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function ClientNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<'all' | 'project' | 'task' | 'query' | 'general'>('all');

  const fetchNotifications = async () => {
    try {
      const response = await API.get("/users/notifications");
      setNotifications(response.data.data || []);
      setError("");
    } catch (err) {
      console.error("Failed to fetch client notifications:", err);
      setError("Failed to load notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await API.patch(`/users/notifications/${id}/read`);
      setNotifications((current) => current.map((item) => (item._id === id ? { ...item, isRead: true } : item)));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter((item) => !item.isRead);
      await Promise.all(unread.map((item) => API.patch(`/users/notifications/${item._id}/read`)));
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'project':
        return { icon: Folder, color: '#007AFF', bg: '#E3F2FF' };
      case 'task':
        return { icon: TrendingUp, color: '#34C759', bg: '#E8F5E9' };
      case 'query':
      case 'ticket':
        return { icon: LifeBuoy, color: '#FF9500', bg: '#FFF4E5' };
      default:
        return { icon: Bell, color: '#8E8E93', bg: '#F2F2F7' };
    }
  };

  const getNotificationType = (notification: Notification): 'project' | 'task' | 'query' | 'general' => {
    const message = notification.message.toLowerCase();
    if (message.includes('project') || message.includes('status')) return 'project';
    if (message.includes('task') || message.includes('complete')) return 'task';
    if (message.includes('query') || message.includes('ticket') || message.includes('support')) return 'query';
    return 'general';
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'all') return true;
    return getNotificationType(notification) === filter;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div style={styles.container} className="wsd-page">
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="wsd-page">
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Notifications</h1>
          <p style={styles.subtitle}>Track project assignment updates and account activity</p>
        </div>
        <div style={styles.headerActions}>
          <button
            onClick={markAllAsRead}
            style={styles.markReadBtn}
            disabled={!notifications.some((item) => !item.isRead)}
          >
            <MailOpen size={18} />
            <span>Mark all as read</span>
          </button>
          {unreadCount > 0 && (
            <div style={styles.unreadBadge}>
              {unreadCount} unread
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={styles.errorContainer}>
          <p>{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={styles.filterContainer}>
        <div style={styles.filterTabs}>
          <button 
            onClick={() => setFilter('all')} 
            style={{
              ...styles.filterTab,
              ...(filter === 'all' ? styles.filterTabActive : {})
            }}
          >
            <Bell size={14} />
            All
          </button>
          <button 
            onClick={() => setFilter('project')} 
            style={{
              ...styles.filterTab,
              ...(filter === 'project' ? styles.filterTabActive : {})
            }}
          >
            <Folder size={14} />
            Projects
          </button>
          <button 
            onClick={() => setFilter('task')} 
            style={{
              ...styles.filterTab,
              ...(filter === 'task' ? styles.filterTabActive : {})
            }}
          >
            <TrendingUp size={14} />
            Tasks
          </button>
          <button 
            onClick={() => setFilter('query')} 
            style={{
              ...styles.filterTab,
              ...(filter === 'query' ? styles.filterTabActive : {})
            }}
          >
            <LifeBuoy size={14} />
            Queries
          </button>
        </div>
      </div>

      <div style={styles.listContainer}>
        {filteredNotifications.length === 0 ? (
          <div style={styles.emptyState}>
            <Bell size={48} color="#C6C6C8" />
            <h3>No notifications found</h3>
            <p>{filter === 'all' ? 'Project assignment updates will appear here.' : `No ${filter} notifications.`}</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredNotifications.map((notification) => {
              const notifType = getNotificationType(notification);
              const iconConfig = getNotificationIcon(notifType);
              const IconComponent = iconConfig.icon;
              return (
                <div
                  key={notification._id}
                  style={{
                    ...styles.notificationCard,
                    ...(notification.isRead ? {} : styles.unreadCard),
                  }}
                  className="notification-item"
                >
                  <div style={styles.cardInfo}>
                    <div
                      style={{
                        ...styles.iconWrapper,
                        backgroundColor: notification.isRead ? "#F2F2F7" : iconConfig.bg,
                      }}
                    >
                      <IconComponent size={20} color={notification.isRead ? "#8E8E93" : iconConfig.color} />
                    </div>
                    <div style={styles.textContent}>
                      <div style={styles.messageHeader}>
                        <p style={styles.messageText}>{notification.message}</p>
                        <span style={{
                          ...styles.typeBadge,
                          backgroundColor: iconConfig.bg,
                          color: iconConfig.color
                        }}>
                          {notifType}
                        </span>
                      </div>
                      <div style={styles.metaInfo}>
                        <Clock size={12} />
                        <span>{new Date(notification.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  {!notification.isRead && (
                    <button onClick={() => markAsRead(notification._id)} style={styles.actionBtn} title="Mark as read">
                      <CheckCircle size={20} color="#34C759" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .notification-item {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .notification-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    padding: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
  },
  headerActions: { display: "flex", alignItems: "center", gap: "12px" },
  unreadBadge: { padding: "6px 12px", backgroundColor: "#007AFF", color: "#fff", borderRadius: "12px", fontSize: "12px", fontWeight: 700 },
  title: {
    fontSize: "34px",
    fontWeight: 600,
    letterSpacing: "-0.5px",
    color: "#1C1C1E",
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "15px",
    color: "#8E8E93",
  },
  markReadBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    backgroundColor: "#F2F2F7",
    color: "#1C1C1E",
    border: "none",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  filterContainer: { marginBottom: "20px" },
  filterTabs: { display: "flex", gap: "8px", backgroundColor: "var(--bg-secondary)", padding: "4px", borderRadius: "12px", overflow: "auto" },
  filterTab: { padding: "8px 16px", border: "none", backgroundColor: "transparent", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" as const },
  filterTabActive: { backgroundColor: "var(--bg-primary)", color: "#007AFF", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  listContainer: {
    marginTop: "20px",
  },
  emptyState: {
    textAlign: "center",
    padding: "100px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  notificationCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    border: "1px solid #E5E5EA",
  },
  unreadCard: {
    borderLeft: "4px solid #007AFF",
    backgroundColor: "#FAFBFF",
  },
  cardInfo: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flex: 1,
  },
  iconWrapper: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textContent: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: 1,
  },
  messageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" },
  typeBadge: { padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700, textTransform: "capitalize" as const, whiteSpace: "nowrap" as const },
  messageText: {
    fontSize: "15px",
    color: "#1C1C1E",
    fontWeight: 500,
    margin: 0,
  },
  metaInfo: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#8E8E93",
  },
  actionBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    padding: "100px 20px",
  },
  spinner: {
    width: "32px",
    height: "32px",
    border: "3px solid #E5E5EA",
    borderTopColor: "#007AFF",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorContainer: {
    padding: "14px 16px",
    backgroundColor: "#FEF2F0",
    border: "1px solid #FF3B30",
    borderRadius: "12px",
    color: "#1C1C1E",
  },
};

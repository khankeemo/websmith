// PATH: C:\websmith\app\admin\notifications\page.tsx
"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle, Clock, MailOpen, Search } from "lucide-react";
import API from "../../../core/services/apiService";

interface Notification {
  _id: string;
  recipientId: string;
  senderId?: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNotifications = async () => {
    try {
      const response = await API.get("/admin/notifications");
      setNotifications(response.data.data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setError("Failed to load notifications. Please try again.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await API.patch(`/admin/notifications/${id}/read`);
      setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.isRead);
      await Promise.all(unread.map(n => API.patch(`/admin/notifications/${n._id}/read`)));
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  if (loading) {
    return (
      <div style={styles.container} className="wsd-page admin-panel-scope">
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="wsd-page admin-panel-scope">
      {/* Header */}
      <div style={styles.header} className="wsd-page-header">
        <div style={styles.headerTitleBlock}>
          <h1 style={styles.title}>Notifications</h1>
          <p style={styles.subtitle}>Stay updated with system activities, client queries, and team updates</p>
        </div>

        {/* Top & Middle Search */}
        <div style={styles.middleSearchWrap} className="notifications-middle-search">
          <div style={styles.searchBox} className="admin-search-box wsd-search-box">
            <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {/* Right Actions */}
        <div style={styles.headerButtons} className="wsd-page-actions">
          <button 
            onClick={markAllAsRead} 
            style={{
              ...styles.markReadBtn,
              opacity: notifications.some(n => !n.isRead) ? 1 : 0.5,
              cursor: notifications.some(n => !n.isRead) ? 'pointer' : 'default'
            }}
            disabled={!notifications.some(n => !n.isRead)}
          >
            <MailOpen size={16} />
            <span>Mark all read</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.errorContainer}>
          <p>{error}</p>
        </div>
      )}

      {/* Notifications List */}
      <div style={styles.listContainer}>
        {notifications.length === 0 ? (
          <div style={styles.emptyState}>
            <Bell size={48} color="var(--border-color)" />
            <h3 style={{ color: 'var(--text-primary)' }}>No notifications yet</h3>
            <p style={{ color: 'var(--text-secondary)' }}>We'll notify you here when critical system events or client actions occur.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {notifications.filter(n => (n.message || '').toLowerCase().includes(searchTerm.toLowerCase())).map((notification) => (
              <div 
                key={notification._id} 
                style={{
                  ...styles.notificationCard,
                  ...(notification.isRead ? {} : styles.unreadCard)
                }}
                className="notification-item"
              >
                <div style={styles.cardInfo}>
                  <div style={{
                    ...styles.iconWrapper,
                    backgroundColor: notification.isRead ? "var(--bg-secondary)" : "rgba(0, 122, 255, 0.1)"
                  }}>
                    <Bell size={20} color={notification.isRead ? "var(--text-secondary)" : "#007AFF"} />
                  </div>
                  <div style={styles.textContent}>
                    <p style={{
                      ...styles.messageText,
                      color: notification.isRead ? 'var(--text-secondary)' : 'var(--text-primary)',
                      fontWeight: notification.isRead ? 500 : 700
                    }}>{notification.message}</p>
                    <div style={styles.metaInfo}>
                      <Clock size={12} color="var(--text-secondary)" />
                      <span>{new Date(notification.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                {!notification.isRead && (
                  <button 
                    onClick={() => markAsRead(notification._id)}
                    style={styles.actionBtn}
                    className="notif-action-btn"
                    title="Mark as read"
                  >
                    <CheckCircle size={22} color="#34C759" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .notification-item { transition: all 0.25s ease; }
        .notification-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: var(--border-color); }
        .notif-action-btn:hover { background-color: rgba(52, 199, 89, 0.1); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    minHeight: '100%',
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '28px',
    width: '100%',
  },
  headerTitleBlock: {
    flexShrink: 0,
    minWidth: '180px',
  },
  middleSearchWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    minWidth: '220px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 18px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    width: '100%',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    width: '100%',
  },
  headerButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: '34px',
    fontWeight: 700,
    letterSpacing: '-1px',
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
  },
  markReadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 16px',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  listContainer: {
    marginTop: '20px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    textAlign: 'center',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '24px',
    border: '1px dashed var(--border-color)',
    gap: '12px',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  notificationCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    gap: '16px',
  },
  unreadCard: {
    borderLeft: '4px solid #007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.03)',
  },
  cardInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flex: 1,
  },
  iconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid var(--border-color)'
  },
  textContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  messageText: {
    fontSize: '16px',
    margin: 0,
    lineHeight: 1.4,
  },
  metaInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '10px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.25s ease',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '100px',
    gap: '20px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--border-color)',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorContainer: {
    padding: '20px',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    color: '#FF3B30',
    borderRadius: '16px',
    border: '1px solid rgba(255, 59, 48, 0.1)',
    marginBottom: '24px',
    fontWeight: 600,
  }
};

// PATH: C:\websmith\app\admin\notifications\page.tsx
"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle, Clock, Trash2, MailOpen } from "lucide-react";
import API from "../../../core/services/apiService";
import Card from "../../../components/ui/Card";

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
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Notifications</h1>
          <p style={styles.subtitle}>Stay updated with client activities</p>
        </div>
        <button 
          onClick={markAllAsRead} 
          style={styles.markReadBtn}
          disabled={!notifications.some(n => !n.isRead)}
        >
          <MailOpen size={18} />
          <span>Mark all as read</span>
        </button>
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
            <Bell size={48} color="#C6C6C8" />
            <h3>No notifications yet</h3>
            <p>We'll notify you here when clients complete setup or take actions.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {notifications.map((notification) => (
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
                    backgroundColor: notification.isRead ? "#F2F2F7" : "#E3F2FF"
                  }}>
                    <Bell size={20} color={notification.isRead ? "#8E8E93" : "#007AFF"} />
                  </div>
                  <div style={styles.textContent}>
                    <p style={styles.messageText}>{notification.message}</p>
                    <div style={styles.metaInfo}>
                      <Clock size={12} />
                      <span>{new Date(notification.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                {!notification.isRead && (
                  <button 
                    onClick={() => markAsRead(notification._id)}
                    style={styles.actionBtn}
                    title="Mark as read"
                  >
                    <CheckCircle size={20} color="#34C759" />
                  </button>
                )}
              </div>
            ))}
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
    padding: '8px 4px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
  },
  title: {
    fontSize: '34px',
    fontWeight: 600,
    letterSpacing: '-0.5px',
    color: '#1C1C1E',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#8E8E93',
  },
  markReadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#F2F2F7',
    color: '#1C1C1E',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  listContainer: {
    marginTop: '20px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '100px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  notificationCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E5E5EA',
  },
  unreadCard: {
    borderLeft: '4px solid #007AFF',
    backgroundColor: '#FAFBFF',
  },
  cardInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flex: 1,
  },
  iconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  messageText: {
    fontSize: '15px',
    color: '#1C1C1E',
    fontWeight: 500,
    margin: 0,
  },
  metaInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#8E8E93',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '100px',
    gap: '16px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5EA',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorContainer: {
    padding: '16px',
    backgroundColor: '#FEF2F0',
    color: '#FF3B30',
    borderRadius: '12px',
    marginBottom: '20px',
  }
};

// FILE: app/internal/api/auth/providers/NotificationProvider.tsx
// PURPOSE: Notification Provider for API Center
// FIXED: Only fetch notifications when user is authenticated

"use client";

import { useState, useCallback, useEffect } from "react";
import { Notification, NotificationContextType } from "../types/notification";
import { NotificationContext } from "../hooks/useNotifications";

const API_BASE_URL = "/internal/backend/api/notifications";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get auth headers
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("api_center_token");
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, []);

  // Check if user is authenticated
  const isAuthenticated = useCallback(() => {
    return !!localStorage.getItem("api_center_token");
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated()) {
      console.log("📝 Not authenticated, skipping unread count fetch");
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const response = await fetch(`${API_BASE_URL}/unread-count`, { headers });
      if (response.status === 401) {
        console.log("🔒 Session expired, clearing token");
        localStorage.removeItem("api_center_token");
        localStorage.removeItem("api_center_user");
        return;
      }
      const data = await response.json();
      if (data.success) {
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, [getAuthHeaders, isAuthenticated]);

  // Fetch notifications
  const fetchNotifications = useCallback(async (limit = 50) => {
    if (!isAuthenticated()) {
      console.log("📝 Not authenticated, skipping notifications fetch");
      setNotifications([]);
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}?limit=${limit}&offset=0`, { headers });
      if (response.status === 401) {
        console.log("🔒 Session expired, clearing token");
        localStorage.removeItem("api_center_token");
        localStorage.removeItem("api_center_user");
        setNotifications([]);
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setNotifications(data.data || []);
      } else {
        console.error("Failed to fetch notifications:", data.error);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, isAuthenticated]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: number) => {
    if (!isAuthenticated()) return;

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: "PUT",
        headers,
      });
      if (response.status === 401) {
        console.log("🔒 Session expired, clearing token");
        localStorage.removeItem("api_center_token");
        localStorage.removeItem("api_center_user");
        return;
      }
      const data = await response.json();
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }, [getAuthHeaders, isAuthenticated]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!isAuthenticated()) return;

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const response = await fetch(`${API_BASE_URL}/mark-read`, {
        method: "PUT",
        headers,
      });
      if (response.status === 401) {
        console.log("🔒 Session expired, clearing token");
        localStorage.removeItem("api_center_token");
        localStorage.removeItem("api_center_user");
        return;
      }
      const data = await response.json();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, [getAuthHeaders, isAuthenticated]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!isAuthenticated()) {
      console.log("❌ Clear all: Not authenticated");
      return;
    }

    if (notifications.length === 0) {
      console.log("📝 No notifications to delete");
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) return;

    console.log(`🗑️ Clearing ${notifications.length} notifications...`);
    let deletedCount = 0;
    let errorCount = 0;

    for (const notification of notifications) {
      try {
        const response = await fetch(`${API_BASE_URL}/${notification.id}`, {
          method: "DELETE",
          headers,
        });
        if (response.status === 401) {
          console.log("🔒 Session expired, clearing token");
          localStorage.removeItem("api_center_token");
          localStorage.removeItem("api_center_user");
          break;
        }
        if (response.ok) {
          deletedCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error deleting notification ${notification.id}:`, error);
      }
    }

    console.log(`📊 Delete summary: ${deletedCount} deleted, ${errorCount} failed`);
    setNotifications([]);
    setUnreadCount(0);
  }, [getAuthHeaders, isAuthenticated, notifications]);

  // Initialize - only fetch when authenticated
  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      const token = localStorage.getItem("api_center_token");
      if (token) {
        setIsInitialized(true);
        fetchNotifications();
        fetchUnreadCount();
      } else {
        setIsInitialized(false);
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    // Initial check
    checkAuth();

    // Listen for storage changes (login/logout in other tabs)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "api_center_token") {
        checkAuth();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Poll for token changes (for same-tab updates)
    const interval = setInterval(() => {
      const token = localStorage.getItem("api_center_token");
      if (token && !isInitialized) {
        setIsInitialized(true);
        fetchNotifications();
        fetchUnreadCount();
      } else if (!token && isInitialized) {
        setIsInitialized(false);
        setNotifications([]);
        setUnreadCount(0);
      }
    }, 5000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [fetchNotifications, fetchUnreadCount, isInitialized]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
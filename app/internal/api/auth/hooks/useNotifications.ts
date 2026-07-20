// FILE: app/internal/api/auth/hooks/useNotifications.ts
// PURPOSE: Notification hook for API Center
// FIX: Added authentication check before making API calls

"use client";

import { useContext } from "react";
import { NotificationContextType } from "../types/notification";

// Create context here to avoid circular imports
import React from "react";

export const NotificationContext = React.createContext<NotificationContextType | undefined>(undefined);

// Create a safe empty context for unauthenticated users
const emptyContext: NotificationContextType = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  fetchNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  clearAll: async () => {},
};

export function useNotifications(): NotificationContextType {
  // ✅ Check if we're on the client side and have a token
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem("api_center_token");
    if (!token) {
      console.log("📝 useNotifications: No token found, returning empty context");
      return emptyContext;
    }
  }

  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
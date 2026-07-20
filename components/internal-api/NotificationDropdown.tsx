// FILE: components/internal-api/NotificationDropdown.tsx
// PURPOSE: Notification dropdown list - SSR Safe
// FIX: Uses CSS variables for theming

"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications } from "@/app/internal/api/auth/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const [mounted, setMounted] = useState(false);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    fetchNotifications,
  } = useNotifications();

  useEffect(() => {
    setMounted(true);
    // Fetch notifications when dropdown opens
    fetchNotifications();
  }, [fetchNotifications]);

  // Don't render during SSR
  if (!mounted) {
    return (
      <div className="absolute right-0 top-12 w-80 max-h-[400px] overflow-hidden bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl shadow-black/50 z-50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-sm font-semibold text-[var(--text-secondary)]">Notifications</span>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-12 w-80 max-h-[400px] overflow-hidden bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl shadow-black/50 z-50 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/10">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 animate-pulse border border-blue-500/20">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <>
              <button
                onClick={markAllAsRead}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/30 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200 group"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
              </button>
              <button
                onClick={clearAll}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition-all duration-200 group"
                title="Clear all"
              >
                <Trash2 className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[320px] p-2 scrollbar-thin scrollbar-thumb-[var(--border-color)] scrollbar-track-transparent">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-10 h-10 text-[var(--bg-tertiary)] mx-auto mb-3 opacity-50" />
            <p className="text-sm text-[var(--text-secondary)]">No notifications</p>
            <p className="text-xs text-[var(--text-secondary)]/50 mt-1">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onRemove={clearAll}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[var(--border-color)] text-center bg-[var(--bg-tertiary)]/5">
          <button
            onClick={onClose}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200 hover:scale-105 transform"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
// FILE: components/internal-api/NotificationItem.tsx
// PURPOSE: Individual notification item
// FIX: Uses correct database field names (created_at, id as number)

"use client";

import { Notification } from "@/app/internal/api/auth/types/notification";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X, Bell, Sparkles, KeyRound, Package, CreditCard, Users, Shield } from "lucide-react";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
  onRemove: (id: number) => void;
}

// Map notification types to icons
const getTypeIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    license_created: KeyRound,
    license_activated: CheckCircle,
    license_expired: AlertTriangle,
    license_revoked: AlertCircle,
    trial_started: Sparkles,
    trial_converted: CheckCircle,
    payment_received: CreditCard,
    payment_failed: AlertCircle,
    product_updated: Package,
    system_alert: Shield,
    user_invite: Users,
    welcome: Bell,
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };
  return iconMap[type] || Bell;
};

// Map notification types to colors
const getTypeColor = (type: string) => {
  const colorMap: Record<string, string> = {
    license_created: "text-blue-400",
    license_activated: "text-green-400",
    license_expired: "text-amber-400",
    license_revoked: "text-red-400",
    trial_started: "text-purple-400",
    trial_converted: "text-green-400",
    payment_received: "text-emerald-400",
    payment_failed: "text-red-400",
    product_updated: "text-cyan-400",
    system_alert: "text-orange-400",
    user_invite: "text-indigo-400",
    welcome: "text-blue-400",
    success: "text-green-400",
    error: "text-red-400",
    warning: "text-amber-400",
    info: "text-blue-400",
  };
  return colorMap[type] || "text-slate-400";
};

export function NotificationItem({
  notification,
  onMarkAsRead,
  onRemove,
}: NotificationItemProps) {
  const Icon = getTypeIcon(notification.type);
  const colorClass = getTypeColor(notification.type);
  const isUnread = !notification.read;

  // Format time
  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`group relative flex items-start gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer
        ${isUnread 
          ? "bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15" 
          : "bg-[var(--bg-tertiary)]/10 hover:bg-[var(--bg-tertiary)]/20"
        }
      `}
      onClick={() => isUnread && onMarkAsRead(notification.id)}
    >
      {/* Unread indicator dot */}
      {isUnread && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse" />
      )}

      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isUnread ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
          {notification.title}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        {notification.link && (
          <a
            href={notification.link}
            className="text-xs text-blue-400 hover:underline mt-1 inline-block transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            View Details →
          </a>
        )}
        <p className="text-[10px] text-[var(--text-secondary)]/50 mt-1">
          {formatTime(notification.created_at)}
        </p>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(notification.id);
        }}
        className="flex-shrink-0 p-1 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
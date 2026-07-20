// FILE: app/internal/api/auth/types/notification.ts
// PURPOSE: Notification types for API Center
// FIX: Uses correct field names (created_at, read)

export type NotificationType =
  | "license_created"
  | "license_activated"
  | "license_expired"
  | "license_revoked"
  | "trial_started"
  | "trial_converted"
  | "payment_received"
  | "payment_failed"
  | "product_updated"
  | "system_alert"
  | "user_invite"
  | "welcome"
  | "success"
  | "error"
  | "warning"
  | "info";

export interface Notification {
  id: number;           // ✅ integer from database
  user_id: number;      // ✅ integer from database
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;        // ✅ matches database column
  link: string | null;
  created_at: string;   // ✅ matches database column
  updated_at: string;   // ✅ matches database column
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (limit?: number) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export interface NotificationProviderProps {
  children: React.ReactNode;
}
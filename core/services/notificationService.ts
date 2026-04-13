import API from "./apiService";

export interface Notification {
  _id: string;
  recipientId: string;
  senderId?: string;
  type:
    | "client_setup_complete"
    | "client_approval_required"
    | "task_completed"
    | "task_assigned"
    | "query_created"
    | "query_updated"
    | "project_status_changed"
    | "invoice_created"
    | "other";
  message: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export const getNotifications = async () => {
  const response = await API.get("/users/notifications");
  return response.data.data as Notification[];
};

export const markNotificationAsRead = async (id: string) => {
  const response = await API.patch(`/users/notifications/${id}/read`);
  return response.data.data as Notification;
};

export const markAllNotificationsAsRead = async () => {
  const response = await API.post("/users/notifications/mark-all-read");
  return response.data;
};

export const getUnreadCount = async () => {
  const notifications = await getNotifications();
  return notifications.filter((n) => !n.isRead).length;
};

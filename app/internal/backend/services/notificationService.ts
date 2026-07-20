// FILE: app/internal/backend/services/notificationService.ts
// PURPOSE: Notification database operations for API Center
// DATABASE: Neon PostgreSQL - notifications table
// FIXED: user_id changed from number to string to match users table

import { Pool } from "pg";

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ============================================================
// TYPES
// ============================================================

export interface Notification {
  id: number;
  user_id: string;  // ✅ Changed from number to string
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationData {
  user_id: string;  // ✅ Changed from number to string
  title: string;
  message: string;
  type: string;
  link?: string | null;
}

export interface NotificationResponse {
  success: boolean;
  data?: Notification | Notification[];
  error?: string;
  count?: number;
}

// ============================================================
// NOTIFICATION SERVICE
// ============================================================

export const notificationService = {
  /**
   * Get all notifications for a user
   */
  async getByUser(
    userId: string,  // ✅ Changed from number to string
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationResponse> {
    const client = await pool.connect();
    try {
      // Get notifications
      const result = await client.query(
        `SELECT id, user_id, title, message, type, read, link, created_at, updated_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM notifications WHERE user_id = $1`,
        [userId]
      );

      return {
        success: true,
        data: result.rows,
        count: parseInt(countResult.rows[0]?.total || "0"),
      };
    } catch (error) {
      console.error("[notificationService] getByUser error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      client.release();
    }
  },

  /**
   * Get a single notification by ID
   */
  async getById(id: number, userId: string): Promise<NotificationResponse> {  // ✅ Changed userId to string
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, user_id, title, message, type, read, link, created_at, updated_at
         FROM notifications
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: "Notification not found" };
      }

      return {
        success: true,
        data: result.rows[0],
      };
    } catch (error) {
      console.error("[notificationService] getById error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      client.release();
    }
  },

  /**
   * Create a new notification
   */
  async create(data: CreateNotificationData): Promise<NotificationResponse> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, title, message, type, read, link, created_at, updated_at`,
        [data.user_id, data.title, data.message, data.type, data.link || null]
      );

      return {
        success: true,
        data: result.rows[0],
      };
    } catch (error) {
      console.error("[notificationService] create error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      client.release();
    }
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(id: number, userId: string): Promise<NotificationResponse> {  // ✅ Changed userId to string
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE notifications
         SET read = TRUE, updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING id, user_id, title, message, type, read, link, created_at, updated_at`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: "Notification not found" };
      }

      return {
        success: true,
        data: result.rows[0],
      };
    } catch (error) {
      console.error("[notificationService] markAsRead error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      client.release();
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ success: boolean; error?: string; count?: number }> {  // ✅ Changed userId to string
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE notifications
         SET read = TRUE, updated_at = NOW()
         WHERE user_id = $1 AND read = FALSE
         RETURNING id`,
        [userId]
      );

      return {
        success: true,
        count: result.rows.length,
      };
    } catch (error) {
      console.error("[notificationService] markAllAsRead error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      client.release();
    }
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<{ success: boolean; error?: string; count?: number }> {  // ✅ Changed userId to string
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM notifications
         WHERE user_id = $1 AND read = FALSE`,
        [userId]
      );

      return {
        success: true,
        count: parseInt(result.rows[0]?.count || "0"),
      };
    } catch (error) {
      console.error("[notificationService] getUnreadCount error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      client.release();
    }
  },

  /**
   * Delete a notification
   */
  async delete(id: number, userId: string): Promise<{ success: boolean; error?: string }> {  // ✅ Changed userId to string
    const client = await pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (result.rowCount === 0) {
        return { success: false, error: "Notification not found" };
      }

      return { success: true };
    } catch (error) {
      console.error("[notificationService] delete error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      client.release();
    }
  },
};
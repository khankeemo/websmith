// FILE: app/internal/backend/api/notifications/mark-read/route.ts
// PURPOSE: Mark all notifications as read for a user
// DATABASE: Neon PostgreSQL
// FIXED: Using JWT token instead of x-user-id header

import { NextRequest, NextResponse } from "next/server";
import { notificationService } from "../../../services/notificationService";
import jwt from "jsonwebtoken";

// ============================================================
// HELPER: Get user ID from JWT token
// ============================================================

function getUserIdFromToken(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;
    if (!JWT_SECRET) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.id || null;
  } catch {
    return null;
  }
}

// ============================================================
// PUT /internal/backend/api/notifications/mark-read
// ============================================================

export async function PUT(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const result = await notificationService.markAllAsRead(userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "All notifications marked as read",
      count: result.count || 0,
    });
  } catch (error) {
    console.error("[PUT /api/notifications/mark-read] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
// FILE: app/internal/backend/api/notifications/route.ts
// PURPOSE: Notification API - GET all, POST create
// DATABASE: Neon PostgreSQL
// FIXED: Using JWT token instead of x-user-id header

import { NextRequest, NextResponse } from "next/server";
import { notificationService } from "../../services/notificationService";
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
// GET /internal/backend/api/notifications
// Query: ?limit=50&offset=0
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // Get user_id from JWT token
    const userId = getUserIdFromToken(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await notificationService.getByUser(userId, limit, offset);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[GET /api/notifications] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /internal/backend/api/notifications
// Body: { user_id, title, message, type, link? }
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.user_id || !body.title || !body.message || !body.type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: user_id, title, message, type" },
        { status: 400 }
      );
    }

    const userId = body.user_id;
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: "Invalid user_id - must be a string" },
        { status: 400 }
      );
    }

    const result = await notificationService.create({
      user_id: userId,
      title: body.title,
      message: body.message,
      type: body.type,
      link: body.link || null,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: "Notification created successfully",
    });
  } catch (error) {
    console.error("[POST /api/notifications] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
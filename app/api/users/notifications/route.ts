import { NextResponse } from "next/server";
import { MongoClient, ObjectId } from "@/lib/server/api";
import jwt from "jsonwebtoken";

function toNotification(doc: any) {
  return {
    _id: doc._id.toString(),
    recipientId: doc.recipientId,
    senderId: doc.senderId,
    type: doc.type,
    message: doc.message,
    isRead: doc.isRead ?? doc.is_read ?? false,
    metadata: doc.metadata,
    createdAt: doc.createdAt ?? doc.created_at ?? null,
    updatedAt: doc.updatedAt ?? doc.updated_at ?? null,
  };
}

export async function GET(request: Request) {
  let mongoClient = null;

  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required", message: "Authentication required" },
        { status: 401 }
      );
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return NextResponse.json(
        { success: false, error: "Authentication configuration missing" },
        { status: 500 }
      );
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { success: false, error: "Session invalid. Please log in again.", message: "Session invalid. Please log in again." },
        { status: 401 }
      );
    }

    const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || "";
    if (!MONGODB_URI) {
      return NextResponse.json(
        { success: false, error: "Database configuration missing" },
        { status: 500 }
      );
    }

    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const notificationsCollection = mongoClient.db("WSD").collection("notifications");

    const notifications = await notificationsCollection
      .find({ recipientId: payload.sub })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    await mongoClient.close();
    mongoClient = null;

    return NextResponse.json({
      success: true,
      data: notifications.map(toNotification),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Get notifications error (internal):", errMsg);
    if (mongoClient) {
      try { await mongoClient.close(); } catch (_) {}
    }
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

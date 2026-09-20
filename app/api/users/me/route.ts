import { NextResponse } from "next/server";
import { MongoClient, ObjectId } from "@/lib/server/api";
import jwt from "jsonwebtoken";

function toPublicUser(user: any) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? undefined,
    company: user.company ?? undefined,
    avatar: user.avatar ?? undefined,
    adminLevel: user.adminLevel ?? undefined,
    isTemporaryPassword: user.isTemporaryPassword ?? false,
    isForcedPasswordReset: user.isForcedPasswordReset ?? false,
    setupCompleted: user.setupCompleted ?? true,
    preferences: user.preferences,
    customId: user.customId,
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
    const usersCollection = mongoClient.db("WSD").collection("users");

    const user = await usersCollection.findOne({ _id: new ObjectId(payload.sub) });

    if (!user) {
      await mongoClient.close();
      mongoClient = null;
      return NextResponse.json(
        { success: false, error: "Account not found in authentication system" },
        { status: 404 }
      );
    }

    await mongoClient.close();
    mongoClient = null;

    return NextResponse.json({
      success: true,
      user: toPublicUser(user),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Get current user error (internal):", errMsg);
    if (mongoClient) {
      try { await mongoClient.close(); } catch (_) {}
    }
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

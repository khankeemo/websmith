import { NextResponse } from "next/server";
import { MongoClient, ObjectId } from "@/lib/server/api";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
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
        { success: false, error: "Database configuration missing" },
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

    const { newPassword, currentPassword } = await request.json();

    if (!newPassword) {
      return NextResponse.json(
        { success: false, error: "New password is required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
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

    if (currentPassword) {
      const currentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!currentPasswordValid) {
        await mongoClient.close();
        mongoClient = null;
        return NextResponse.json(
          { success: false, error: "Current password is incorrect", message: "Current password is incorrect" },
          { status: 400 }
        );
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
          isTemporaryPassword: false,
        },
      }
    );

    await mongoClient.close();
    mongoClient = null;

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Change password error (internal):", errMsg);
    if (mongoClient) {
      try { await mongoClient.close(); } catch (_) {}
    }
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
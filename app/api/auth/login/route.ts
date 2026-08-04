import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
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

function signToken(user: any): string {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function POST(request: Request) {
  let mongoClient = null;

  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Email/ID and password are required" },
        { status: 400 }
      );
    }

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      return NextResponse.json(
        { success: false, error: "Database configuration missing" },
        { status: 500 }
      );
    }

    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const usersCollection = mongoClient.db("WSD").collection("users");

    const identifierValue = identifier.trim();
    const user = await usersCollection.findOne({
      $or: [{ email: identifierValue.toLowerCase() }, { customId: identifierValue }],
    });

    if (!user) {
      await mongoClient.close();
      mongoClient = null;
      return NextResponse.json(
        { success: false, error: "Invalid credentials. Please try again." },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      await mongoClient.close();
      mongoClient = null;
      return NextResponse.json(
        { success: false, error: "Invalid credentials. Please try again." },
        { status: 401 }
      );
    }

    await mongoClient.close();
    mongoClient = null;

    return NextResponse.json({
      success: true,
      token: signToken(user),
      user: toPublicUser(user),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Login error (internal):", errMsg);
    if (mongoClient) {
      try { await mongoClient.close(); } catch (_) {}
    }
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

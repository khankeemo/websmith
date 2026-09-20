import { NextResponse } from "next/server";
import { MongoClient } from "@/lib/server/api";
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
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
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

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await usersCollection.findOne({ email: normalizedEmail });
    if (existing) {
      await mongoClient.close();
      mongoClient = null;
      return NextResponse.json(
        { success: false, error: "An account with this email already exists", message: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const customIdLast = await usersCollection
      .find({ customId: { $regex: /^CL-\d+$/ } })
      .sort({ customId: -1 })
      .limit(1)
      .toArray();
    const lastCustomNumber = customIdLast.length > 0
      ? parseInt(customIdLast[0].customId.replace("CL-", ""), 10)
      : 0;
    const customId = `CL-${String(lastCustomNumber + 1).padStart(4, "0")}`;

    const now = new Date();

    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "client",
      adminLevel: null,
      avatar: "",
      phone: "",
      company: "",
      preferences: {
        theme: "light",
        notifications: {
          email: true,
          push: true,
          projectUpdates: true,
          queryResponses: true,
        },
      },
      provider: null,
      providerId: "",
      isOAuthUser: false,
      customId,
      isTemporaryPassword: false,
      isApproved: true,
      setupCompleted: true,
      published: false,
      headline: "",
      bio: "",
      skills: [],
      status: "active",
      experienceYears: 0,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    };

    const insertResult = await usersCollection.insertOne(newUser);
    await mongoClient.close();
    mongoClient = null;

    const savedUser = { ...newUser, _id: insertResult.insertedId };

    return NextResponse.json({
      success: true,
      token: signToken(savedUser),
      user: toPublicUser(savedUser),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Register error (internal):", errMsg);
    if (mongoClient) {
      try { await mongoClient.close(); } catch (_) {}
    }
    if (/E11000 duplicate key/i.test(errMsg)) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists", message: "An account with this email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
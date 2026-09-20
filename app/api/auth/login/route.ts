import { NextResponse } from "next/server";
import { MongoClient } from "@/lib/server/api";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/backend-db";
import { sendLoginOtp } from "@/lib/otp/login-otp";
import { checkRateLimit, extractClientIp, rateLimitResponse } from "@/lib/server/rate-limiter";

const LOGIN_OTP_PURPOSE = "website_login";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.charAt(0)}***@${domain}`;
}

export async function POST(request: Request) {
  const ip = extractClientIp(request);
  const rateLimit = checkRateLimit(`login:${ip}`, 10, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.reset);
  }

  let mongoClient = null;

  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Email/ID and password are required" },
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

    const accountEmail =
      typeof user.email === "string" ? user.email : identifierValue.toLowerCase();

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

    const otpResult = await sendLoginOtp(await getDb(), LOGIN_OTP_PURPOSE, accountEmail, ipAddress);

    if (!otpResult.success) {
      console.error("Login OTP send failed:", otpResult.error);
      return NextResponse.json(
        { success: false, error: otpResult.error || "Failed to send verification code. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requires_otp: true,
      email: accountEmail,
      email_masked: maskEmail(accountEmail),
      expires_in: otpResult.expires_in,
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

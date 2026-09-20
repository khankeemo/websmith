// FILE: app/api/auth/login/otp/verify/route.ts
// PURPOSE: Website Login - STEP 2 of 2 (OTP verify)
//          Verifies the login OTP (purpose 'website_login'), then returns the
//          website JWT + public user. The session is ONLY established after
//          this server-side OTP check — never at the credentials step.

import { NextResponse } from "next/server";
import { MongoClient } from "@/lib/server/api";
import { getDb } from "@/lib/backend-db";
import { verifyLoginOtp } from "@/lib/otp/login-otp";
import { toPublicUser, signToken } from "@/lib/website-auth";

const LOGIN_OTP_PURPOSE = "website_login";

export async function POST(request: Request) {
  let mongoClient = null;

  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and verification code are required" },
        { status: 400 }
      );
    }

    if (typeof otp !== "string" || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "Invalid verification code format" },
        { status: 400 }
      );
    }

    // 1. Verify the login OTP (server-side authoritative check)
    const otpCheck = await verifyLoginOtp(await getDb(), LOGIN_OTP_PURPOSE, email, otp);

    if (!otpCheck.success) {
      return NextResponse.json(
        {
          success: false,
          error: otpCheck.error || "Verification failed",
          expired: otpCheck.expired,
          attempts_used: otpCheck.attempts_used,
          max_attempts: otpCheck.max_attempts,
        },
        { status: 400 }
      );
    }

    // 2. Re-fetch the user from database (authoritative store)
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

    const emailValue = email.trim().toLowerCase();
    const user = await usersCollection.findOne({ email: emailValue });

    if (!user) {
      await mongoClient.close();
      mongoClient = null;
      return NextResponse.json(
        { success: false, error: "Account not found. Please sign in again." },
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
    console.error("Login OTP verify error (internal):", errMsg);
    if (mongoClient) {
      try { await mongoClient.close(); } catch (_) {}
    }
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
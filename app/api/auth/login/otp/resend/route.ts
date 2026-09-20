// FILE: app/api/auth/login/otp/resend/route.ts
// PURPOSE: Website Login - RESEND login OTP (purpose 'website_login').
//          Re-sends a fresh code to the same email address. No session is
//          created.

import { NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { sendLoginOtp } from "@/lib/otp/login-otp";

const LOGIN_OTP_PURPOSE = "website_login";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

    const result = await sendLoginOtp(await getDb(), LOGIN_OTP_PURPOSE, email, ipAddress);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to resend verification code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      expires_in: result.expires_in,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Login OTP resend error (internal):", errMsg);
    return NextResponse.json(
      { success: false, error: "Failed to resend verification code" },
      { status: 500 }
    );
  }
}
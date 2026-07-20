import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { sendSMS } from "@/lib/sms/fast2sms";

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { phone, smsType } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
    }

    const cleanedPhone = phone.replace(/[^0-9]/g, "");
    if (cleanedPhone.length < 10) {
      return NextResponse.json({ success: false, error: "Invalid phone number (min 10 digits)" }, { status: 400 });
    }

    const smsTypeToUse = smsType || "test_message";
    const apiKeySet = !!process.env.FAST2SMS_API_KEY;
    const apiKeyFirstChars = process.env.FAST2SMS_API_KEY ? process.env.FAST2SMS_API_KEY.substring(0, 4) + "..." : "NOT SET";

    const client = await db.connect();
    try {
      const result = await sendSMS(client, smsTypeToUse, cleanedPhone, {
        customer_name: "Test User",
        product: "Test Product",
        otp_code: "123456",
        expiry_date: "2026-12-31",
        support_email: "support@websmithdigital.com",
      });

      return NextResponse.json({
        success: result.success,
        config: {
          api_key_configured: apiKeySet,
          api_key_preview: apiKeyFirstChars,
          sender_id: process.env.FAST2SMS_SENDER_ID || "WEBSMS (default)",
        },
        sms: {
          type: smsTypeToUse,
          phone: cleanedPhone,
          response: result.response || null,
          error: result.error || null,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /test-sms error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

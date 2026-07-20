import { NextRequest, NextResponse } from "next/server";
import { sendSMSWithRetry, loadSmsConfig } from "@/lib/sms/fast2sms";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { sms_type, phone, test, ...customData } = body;

    if (!sms_type) {
      return NextResponse.json({ success: false, error: "sms_type is required" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
    }

    client = await pool.connect();

    let smsConfig = null;
    try { smsConfig = await loadSmsConfig(client); } catch {}

    const result = await sendSMSWithRetry(client, sms_type, phone, customData, 0, smsConfig);

    if (result.success) {
      return NextResponse.json({ success: true, message: "SMS sent successfully", response: result.response });
    } else {
      return NextResponse.json({ success: false, error: result.error || "Failed to send SMS" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to send SMS" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

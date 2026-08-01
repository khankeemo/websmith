// FILE: app/internal/backend/admin/communication/history/route.ts
// PURPOSE: Real email history for a recipient (notification_logs + attachments).
// ACCESS: Internal admin (proxy auth headers)

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 5000,
});

export async function GET(request: NextRequest) {
  let client = null;
  try {
    const userEmail = request.headers.get("x-api-center-user-email") || "";
    if (!userEmail) {
      return NextResponse.json({ success: false, error: "Unauthorized - Please login" }, { status: 401 });
    }

    const email = request.nextUrl.searchParams.get("email") || "";
    if (!email) {
      return NextResponse.json({ success: false, error: "email query parameter is required", data: [] }, { status: 400 });
    }

    client = await pool.connect();
    const r = await client.query(
      `SELECT id, event_type, recipient, subject, status, error, created_at, license_key
       FROM notification_logs
       WHERE LOWER(recipient) = LOWER($1)
       ORDER BY created_at DESC LIMIT 100`,
      [email]
    );

    const history = await Promise.all(r.rows.map(async (row: any) => {
      let attachments: any[] = [];
      try {
        const a = await client!.query(
          `SELECT id, file_name, file_size, mime_type FROM email_attachments WHERE notification_log_id = $1`,
          [row.id]
        );
        attachments = a.rows;
      } catch { /* table may not exist */ }
      return { ...row, attachments };
    }));

    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    console.error("Email history error:", error);
    return NextResponse.json({ success: false, error: "Failed to load email history", data: [] }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

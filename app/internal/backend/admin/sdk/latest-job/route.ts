// FILE: app/internal/backend/admin/sdk/latest-job/route.ts
// PURPOSE: Latest completed SDK job for a product (used by the universal email
//          dialog to attach the SDK package to license emails).
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

    const productId = request.nextUrl.searchParams.get("product_id") || "";
    const jobId = request.nextUrl.searchParams.get("job_id") || "";

    if (!productId && !jobId) {
      return NextResponse.json({ success: false, error: "product_id or job_id query parameter is required", job: null }, { status: 400 });
    }

    client = await pool.connect();
    let rows: any[];
    if (jobId) {
      const r = await client.query(
        `SELECT job_id, status, filename, product_name, download_url, result->>'zipData' AS has_zip, created_at
         FROM sdk_jobs WHERE job_id = $1`,
        [jobId]
      );
      rows = r.rows;
    } else {
      const r = await client.query(
        `SELECT job_id, status, filename, product_name, download_url, result->>'zipData' AS has_zip, created_at
         FROM sdk_jobs
         WHERE status = 'completed' AND payload->>'productId' = $1
         ORDER BY created_at DESC LIMIT 1`,
        [productId]
      );
      rows = r.rows;
    }

    if (rows.length === 0 || rows[0].status !== 'completed') {
      return NextResponse.json({ success: true, job: null });
    }

    const job = rows[0];
    const size = job.has_zip ? Math.round((job.has_zip.length * 3) / 4) : 0;
    return NextResponse.json({
      success: true,
      job: {
        job_id: job.job_id,
        filename: job.filename,
        product_name: job.product_name,
        download_url: job.download_url,
        file_size: size,
        has_sdk: Boolean(job.has_zip),
      },
    });
  } catch (error: any) {
    console.error("SDK latest job error:", error);
    return NextResponse.json({ success: false, error: "Failed to load SDK job", job: null }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

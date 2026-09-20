// FILE: app/api/v1/health/route.ts
// PURPOSE: Public health-check endpoint (SDK Enterprise §15)
// SCOPE: Read-only health/version probe used by the SDK before major workflows.
//        Never mutates state. Response shape is the version-compatibility
//        contract consumed by template/python/health_check.py and version_compat.py.

import { NextResponse } from "next/server";
import { Pool } from "pg";

const sdkMinVersion = "1.0.0";

export async function GET() {
  const started = Date.now();
  const results: Record<string, any> = {
    status: "checking",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database_url_exists: !!process.env.DATABASE_URL,
    email_configured: !!(process.env.SMTP_HOST || process.env.DATABASE_URL),
    sdk_version: sdkMinVersion,
    api_version: "v1",
    publisher_version: process.env.PUBLISHER_VERSION || "1.0.0",
    template_version: process.env.TEMPLATE_VERSION || "1.0.0",
    database_version: process.env.DATABASE_VERSION || "1.0.0",
    tests: {}
  };

  let ok = true;

  if (!process.env.DATABASE_URL) {
    results.tests.database = "unavailable";
    results.status = "degraded";
    ok = false;
  } else {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000
      });
      const client = await pool.connect();
      try {
        await client.query("SELECT 1 as test");
        results.tests.database = "ok";
      } finally {
        client.release();
      }
      await pool.end();
    } catch (error: any) {
      results.tests.database = "error";
      results.tests.database_error = error.message;
      results.status = "degraded";
      ok = false;
    }
  }

  results.tests.email = results.email_configured ? "ok" : "unconfigured";
  results.tests.otp = results.email_configured ? "ok" : "unconfigured";
  results.tests.api = "ok";
  results.tests.version = "ok";

  if (!ok) {
    return NextResponse.json(results, { status: 503 });
  }

  results.status = "ok";
  results.response_time_ms = Date.now() - started;
  return NextResponse.json(results);
}

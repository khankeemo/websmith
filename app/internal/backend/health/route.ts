import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const results: any = {
    status: "checking",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database_url_exists: !!process.env.DATABASE_URL,
    tests: {}
  };

  try {
    // Test 1: Check DATABASE_URL
    if (!process.env.DATABASE_URL) {
      results.tests.database_url = "❌ MISSING";
      results.status = "failed";
      return NextResponse.json(results, { status: 500 });
    }
    results.tests.database_url = "✅ EXISTS";

    // Test 2: Try to connect
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    results.tests.connection = "✅ CONNECTED";

    // Test 3: Simple query
    const testResult = await client.query("SELECT 1 as test");
    results.tests.query = "✅ WORKING";
    results.tests.query_result = testResult.rows[0];

    client.release();

    // Test 4: Check products table
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'products'
      )
    `);
    results.tests.products_table_exists = tableCheck.rows[0].exists ? "✅ EXISTS" : "❌ MISSING";

    results.status = "healthy";
    return NextResponse.json(results);

  } catch (error: any) {
    results.status = "unhealthy";
    results.tests.error = error.message;
    results.tests.error_stack = error.stack;
    return NextResponse.json(results, { status: 500 });
  }
}
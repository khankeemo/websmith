import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function GET(request: Request) {
  let client = null;
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const email = url.searchParams.get('email');

    client = await pool.connect();

    let query = `SELECT * FROM communication_conversations WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }
    if (email) {
      query += ` AND customer_email = $${paramIndex++}`;
      params.push(email);
    }

    query += ` ORDER BY updated_at DESC LIMIT 100`;

    const result = await client.query(query, params);

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: { conversations: result.rows }
    });

  } catch (error: any) {
    console.error('Admin communication list error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list conversations.' }
    }, { status: 500 });
  }
}

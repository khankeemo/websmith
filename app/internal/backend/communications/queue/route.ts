import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let client = null;
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    client = await (await getDb()).connect();

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await client.query(
      `SELECT COUNT(*) FROM message_queue ${whereSQL}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await client.query(
      `SELECT * FROM message_queue ${whereSQL} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: { queue: result.rows, total, page, limit, total_pages: Math.ceil(total / limit) }
    });

  } catch (error: any) {
    console.error('Communications queue error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load queue.' }
    }, { status: 500 });
  }
}

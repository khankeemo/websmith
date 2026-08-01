import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    const url = new URL(_request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    client = await (await getDb()).connect();

    const countResult = await client.query(
      'SELECT COUNT(*) FROM mailbox_sync_logs WHERE mailbox_id = $1',
      [id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await client.query(
      `SELECT * FROM mailbox_sync_logs WHERE mailbox_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: {
        logs: result.rows,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('Mailbox sync logs error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load sync logs.' }
    }, { status: 500 });
  }
}
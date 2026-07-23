import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const pool = await getDb();
    const client = await pool.connect();

    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (status) {
        conditions.push(`r.status = $${paramIdx++}`);
        params.push(status);
      }

      if (search) {
        conditions.push(`(
          r.license_key ILIKE $${paramIdx} OR
          r.customer_name ILIKE $${paramIdx} OR
          r.customer_email ILIKE $${paramIdx} OR
          r.new_customer_name ILIKE $${paramIdx} OR
          r.new_customer_email ILIKE $${paramIdx}
        )`);
        params.push(`%${search}%`);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*) FROM reactivation_requests r ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await client.query(
        `SELECT r.* FROM reactivation_requests r
         ${whereClause}
         ORDER BY r.created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      );

      return NextResponse.json({
        success: true,
        data: result.rows,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total,
        },
      });
    } catch (dbError) {
      console.error('[Reactivation Requests] DB error:', dbError);
      const msg = dbError?.message || '';
      if (msg.includes('42P01') || msg.includes('relation "')) {
        return NextResponse.json(
          { success: false, error: 'Database migration is missing. Please run the latest Neon migration.' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Reactivation Requests] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}

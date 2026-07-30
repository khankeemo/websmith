import { NextRequest, NextResponse } from 'next/server';
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

const VALID_STATUSES = ['open', 'waiting_customer', 'waiting_support', 'waiting_sales', 'resolved', 'closed'];
const VALID_CATEGORIES = ['support', 'sales', 'activation', 'renewal', 'reactivation', 'hardware_replacement', 'general'];

export async function GET(request: NextRequest) {
  let client = null;
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const email = searchParams.get('email');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    client = await pool.connect();

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (status) {
      const statuses = status.split(',');
      const invalid = statuses.filter(s => !VALID_STATUSES.includes(s));
      if (invalid.length > 0) {
        return NextResponse.json({ success: false, error: { code: 'INVALID_STATUS', message: `Invalid status values: ${invalid.join(', ')}. Valid: ${VALID_STATUSES.join(', ')}` } }, { status: 400 });
      }
      whereClauses.push(`cc.status = ANY($${paramIndex++})`);
      params.push(statuses);
    }

    if (category) {
      const categories = category.split(',');
      const invalid = categories.filter(c => !VALID_CATEGORIES.includes(c));
      if (invalid.length > 0) {
        return NextResponse.json({ success: false, error: { code: 'INVALID_CATEGORY', message: `Invalid category values: ${invalid.join(', ')}. Valid: ${VALID_CATEGORIES.join(', ')}` } }, { status: 400 });
      }
      whereClauses.push(`cc.category = ANY($${paramIndex++})`);
      params.push(categories);
    }

    if (email) {
      whereClauses.push(`cc.customer_email ILIKE $${paramIndex++}`);
      params.push(`%${email}%`);
    }

    if (search) {
      whereClauses.push(`(cc.subject ILIKE $${paramIndex} OR cc.customer_name ILIKE $${paramIndex} OR cc.customer_email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await client.query(
      `SELECT COUNT(*) FROM communication_conversations cc ${whereSQL}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await client.query(
      `SELECT cc.*, 
        (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = cc.id) as message_count,
        (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = cc.id AND cm.sender_type = 'customer' AND cm.created_at > COALESCE(
          (SELECT MAX(cm2.created_at) FROM conversation_messages cm2 WHERE cm2.conversation_id = cc.id AND cm2.sender_type = 'admin')
        , '1970-01-01')) as unread_replies
       FROM communication_conversations cc
       ${whereSQL}
       ORDER BY cc.updated_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    client.release();
    client = null;

    const conversations = result.rows.map(c => ({
      ...c,
      last_message_preview: c.message ? c.message.substring(0, 200) : null,
    }));

    return NextResponse.json({
      success: true,
      data: { conversations, total, page, limit, total_pages: Math.ceil(total / limit) }
    });

  } catch (error: any) {
    console.error('Communications conversations list error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list conversations.' }
    }, { status: 500 });
  }
}

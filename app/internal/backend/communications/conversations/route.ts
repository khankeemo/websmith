import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

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
    const hasCustomer = searchParams.get('has_customer') === 'true';
    const showDeleted = searchParams.get('show_deleted') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    client = await (await getDb()).connect();

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // By default, exclude soft-deleted conversations
    if (!showDeleted) {
      whereClauses.push(`cc.deleted_at IS NULL`);
    } else {
      whereClauses.push(`cc.deleted_at IS NOT NULL`);
    }

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
      whereClauses.push(`(cc.subject ILIKE $${paramIndex} OR cc.customer_name ILIKE $${paramIndex} OR cc.customer_email ILIKE $${paramIndex} OR cc.license_key ILIKE $${paramIndex} OR EXISTS (SELECT 1 FROM conversation_messages cm WHERE cm.conversation_id = cc.id AND cm.message ILIKE $${paramIndex}))`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (hasCustomer) {
      whereClauses.push(`EXISTS (SELECT 1 FROM customers c WHERE c.email = cc.customer_email)`);
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
        (SELECT COUNT(*) FROM conversation_attachments ca JOIN conversation_messages cm ON cm.id = ca.message_id WHERE cm.conversation_id = cc.id) as attachment_count,
        (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = cc.id AND cm.sender_type = 'customer' AND cm.created_at > GREATEST(
          COALESCE((SELECT MAX(cm2.created_at) FROM conversation_messages cm2 WHERE cm2.conversation_id = cc.id AND cm2.sender_type = 'admin'), '1970-01-01'),
          COALESCE(cc.admin_read_at, '1970-01-01'))) as unread_replies
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

export async function DELETE(request: NextRequest) {
  let client = null;
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];

    client = await (await getDb()).connect();

    if (action === 'empty_trash') {
      // Permanently delete ALL soft-deleted conversations
      const result = await client.query(
        `DELETE FROM communication_conversations
         WHERE deleted_at IS NOT NULL
         RETURNING id`,
        []
      );
      const deletedCount = result.rows.length;

      client.release();
      client = null;

      return NextResponse.json({
        success: true,
        data: { message: `${deletedCount} conversation(s) permanently deleted.`, deleted: deletedCount }
      });
    }

    if (ids.length > 0) {
      // Permanently delete selected conversations (admin only)
      await client.query(
        `DELETE FROM conversation_messages WHERE conversation_id = ANY($1)`,
        [ids]
      );
      try {
        await client.query(
          `DELETE FROM message_queue WHERE conversation_id = ANY($1)`,
          [ids]
        );
      } catch (queueDeleteError) {
        console.warn('message_queue cleanup skipped:', queueDeleteError.message);
      }
      await client.query(
        `DELETE FROM communication_conversations WHERE id = ANY($1)`,
        [ids]
      );

      client.release();
      client = null;

      return NextResponse.json({
        success: true,
        data: { message: `${ids.length} conversation(s) permanently deleted.`, deleted: ids.length }
      });
    }

    client.release();
    client = null;

    return NextResponse.json({
      success: false,
      error: { code: 'INVALID_ACTION', message: 'Invalid delete action.' }
    }, { status: 400 });

  } catch (error: any) {
    console.error('Communications conversations delete error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete conversations.' }
    }, { status: 500 });
  }
}

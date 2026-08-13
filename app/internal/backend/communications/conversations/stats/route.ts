import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let client = null;
  try {
    const { searchParams } = request.nextUrl;
    const mailboxId = searchParams.get('mailbox_id');
    const showDeleted = searchParams.get('show_deleted') === 'true';

    client = await (await getDb()).connect();

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // By default, exclude soft-deleted conversations
    if (!showDeleted) {
      whereClauses.push('cc.deleted_at IS NULL');
    } else {
      whereClauses.push('cc.deleted_at IS NOT NULL');
    }

    if (mailboxId) {
      whereClauses.push('cc.mailbox_id = $' + paramIndex++);
      params.push(mailboxId);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const statusCounts = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('open', 'waiting_customer')) as inbox_count,
        COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as sent_count,
        COUNT(*) FILTER (WHERE status IN ('waiting_support', 'waiting_sales')) as waiting_count
      FROM communication_conversations cc ${whereSQL}
    `, params);

    const totalInbox = parseInt(statusCounts.rows[0].inbox_count, 10);

    // Trash = soft-deleted conversations (same state the Trash folder list
    // queries via show_deleted=true). Always matches the list, so counts stay
    // consistent with the database after any trash/restore/empty-trash action.
    const trashCount = await client.query(`
      SELECT COUNT(*) as count FROM communication_conversations cc ${whereSQL}
      WHERE cc.deleted_at IS NOT NULL
    `, params);

    let failed = 0;
    let queued = 0;
    try {
      const failedCount = await client.query(`
        SELECT COUNT(*) as count FROM message_queue 
        WHERE status = 'failed' OR retry_count >= max_retries
      `);
      failed = parseInt(failedCount.rows[0].count, 10);

      const queueCount = await client.query(`
        SELECT COUNT(*) as count FROM message_queue 
        WHERE status IN ('pending', 'sending')
      `);
      queued = parseInt(queueCount.rows[0].count, 10);
    } catch (queueError) {
      console.warn('message_queue table not available, skipping queue stats:', queueError.message);
    }

    // Unread = conversations with at least one customer message newer than both
    // the last admin reply and admin_read_at (same definition as the list view's
    // unread_replies). This stays in sync with mark_read / mark_unread, which set
    // admin_read_at on communication_conversations.
    const unreadCount = await client.query(`
      SELECT COUNT(*) as count FROM communication_conversations cc
      WHERE cc.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM conversation_messages cm
          WHERE cm.conversation_id = cc.id
            AND cm.sender_type = 'customer'
            AND (cm.is_internal IS NULL OR cm.is_internal = false)
            AND cm.created_at > GREATEST(
              COALESCE((
                SELECT MAX(cm2.created_at) FROM conversation_messages cm2
                WHERE cm2.conversation_id = cc.id AND cm2.sender_type = 'admin'
              ), '1970-01-01T00:00:00Z'),
              COALESCE(cc.admin_read_at, '1970-01-01T00:00:00Z')
            )
        )
    `, params);

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: {
        inbox: parseInt(statusCounts.rows[0].inbox_count, 10),
        sent: parseInt(statusCounts.rows[0].sent_count, 10),
        waiting: parseInt(statusCounts.rows[0].waiting_count, 10),
        failed,
        queued,
        unread: parseInt(unreadCount.rows[0].count, 10),
        trash: parseInt(trashCount.rows[0].count, 10),
      }
    });

  } catch (error: any) {
    console.error('Communications stats error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load stats.' }
    }, { status: 500 });
  }
}
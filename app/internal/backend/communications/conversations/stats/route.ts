import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let client = null;
  try {
    const { searchParams } = request.nextUrl;
    const mailboxId = searchParams.get('mailbox_id');
    const showDeleted = searchParams.get('show_deleted') === 'true';
    const category = searchParams.get('category');
    // Strict source separation: 'system' = Websmith Communications mail only
    // (mailbox_id IS NULL), 'mailbox' = configured mailbox mail only.
    const source = searchParams.get('source');
    if (source && !['system', 'mailbox'].includes(source)) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_SOURCE', message: `Invalid source: "${source}". Valid: system, mailbox` } }, { status: 400 });
    }

    client = await (await getDb()).connect();

    const sourceClause = source === 'system'
      ? 'cc.mailbox_id IS NULL'
      : source === 'mailbox'
        ? 'cc.mailbox_id IS NOT NULL'
        : null;

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // By default, exclude soft-deleted conversations
    if (!showDeleted) {
      whereClauses.push('cc.deleted_at IS NULL');
    } else {
      whereClauses.push('cc.deleted_at IS NOT NULL');
    }

    if (sourceClause) whereClauses.push(sourceClause);

    // Active-mailbox filtering — a conversation owned by a DISABLED mailbox is
    // never counted (mirrors the list route), so badges stay in sync with the
    // folder contents. System mail (mailbox_id IS NULL) is never affected.
    whereClauses.push(`(
      cc.mailbox_id IS NULL
      OR EXISTS (SELECT 1 FROM mailboxes mb WHERE mb.id = cc.mailbox_id AND mb.is_enabled = TRUE)
    )`);

    if (mailboxId) {
      whereClauses.push('cc.mailbox_id = $' + paramIndex++);
      params.push(mailboxId);
    }

    // Category scope (comma list) — mirrors the list route so badges agree
    // with the account-scoped conversation list (system accounts without a
    // mailbox route by their category list).
    if (category) {
      const categories = category.split(',').map(c => c.trim()).filter(Boolean);
      if (categories.length > 0) {
        whereClauses.push('cc.category = ANY($' + paramIndex++ + ')');
        params.push(categories);
      }
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const statusCounts = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('open', 'waiting_customer')) as inbox_count,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM conversation_messages cm
          WHERE cm.conversation_id = cc.id
            AND cm.sender_type = 'admin'
            AND cm.email_sent = true
        )) as sent_count,
        COUNT(*) FILTER (WHERE status IN ('waiting_support', 'waiting_sales')) as waiting_count
      FROM communication_conversations cc ${whereSQL}
    `, params);

    const totalInbox = parseInt(statusCounts.rows[0].inbox_count, 10);

    // Trash = soft-deleted conversations (same state the Trash folder list
    // queries via show_deleted=true). Always matches the list, so counts stay
    // consistent with the database after any trash/restore/empty-trash action.
    // Trash count needs its own WHERE list (deleted_at IS NOT NULL) — the
    // shared ${whereSQL} already contains its own WHERE clause (deleted_at IS
    // NULL for the default view), so it must never be concatenated here.
    const trashClauses: string[] = ['cc.deleted_at IS NOT NULL'];
    const trashParams: any[] = [];
    let trashParamIndex = 1;
    if (sourceClause) trashClauses.push(sourceClause);
    trashClauses.push(`(
      cc.mailbox_id IS NULL
      OR EXISTS (SELECT 1 FROM mailboxes mb WHERE mb.id = cc.mailbox_id AND mb.is_enabled = TRUE)
    )`);
    if (mailboxId) {
      trashClauses.push('cc.mailbox_id = $' + trashParamIndex++);
      trashParams.push(mailboxId);
    }
    if (category) {
      const categories = category.split(',').map(c => c.trim()).filter(Boolean);
      if (categories.length > 0) {
        trashClauses.push('cc.category = ANY($' + trashParamIndex++ + ')');
        trashParams.push(categories);
      }
    }
    const trashCount = await client.query(`
      SELECT COUNT(*) as count FROM communication_conversations cc
      WHERE ${trashClauses.join(' AND ')}
    `, trashParams);

    let failed = 0;
    let queued = 0;
    try {
      // Queue stats honor the same active-mailbox rule: rows tied to a
      // conversation owned by a DISABLED mailbox are never counted, so the
      // Failed/Queued badges agree with the filtered queue view. Orphaned
      // queue rows (conversation_id NULL) and system-mail rows stay visible.
      const failedCount = await client.query(`
        SELECT COUNT(*) as count FROM message_queue mq
        LEFT JOIN communication_conversations cc ON cc.id = mq.conversation_id
        LEFT JOIN mailboxes mb ON mb.id = cc.mailbox_id
        WHERE (cc.mailbox_id IS NULL OR mb.is_enabled = TRUE)
          AND (mq.status = 'failed' OR mq.retry_count >= mq.max_retries)
      `);
      failed = parseInt(failedCount.rows[0].count, 10);

      const queueCount = await client.query(`
        SELECT COUNT(*) as count FROM message_queue mq
        LEFT JOIN communication_conversations cc ON cc.id = mq.conversation_id
        LEFT JOIN mailboxes mb ON mb.id = cc.mailbox_id
        WHERE (cc.mailbox_id IS NULL OR mb.is_enabled = TRUE)
          AND mq.status IN ('pending', 'sending')
      `);
      queued = parseInt(queueCount.rows[0].count, 10);
    } catch (queueError) {
      console.warn('message_queue table not available, skipping queue stats:', queueError.message);
    }

    // Unread = conversations with at least one customer message newer than both
    // the last admin reply and admin_read_at (same definition as the list view's
    // unread_replies). This stays in sync with mark_read / mark_unread, which set
    // admin_read_at on communication_conversations. The default-view WHERE list
    // (deleted_at IS NULL + optional mailbox/category scope) is shared so scoped
    // badges always agree with the scoped list.
    const unreadClauses: string[] = ['cc.deleted_at IS NULL'];
    const unreadParams: any[] = [];
    let unreadParamIndex = 1;
    if (sourceClause) unreadClauses.push(sourceClause);
    unreadClauses.push(`(
      cc.mailbox_id IS NULL
      OR EXISTS (SELECT 1 FROM mailboxes mb WHERE mb.id = cc.mailbox_id AND mb.is_enabled = TRUE)
    )`);
    if (mailboxId) {
      unreadClauses.push('cc.mailbox_id = $' + unreadParamIndex++);
      unreadParams.push(mailboxId);
    }
    if (category) {
      const categories = category.split(',').map(c => c.trim()).filter(Boolean);
      if (categories.length > 0) {
        unreadClauses.push('cc.category = ANY($' + unreadParamIndex++ + ')');
        unreadParams.push(categories);
      }
    }
    const unreadCount = await client.query(`
      SELECT COUNT(*) as count FROM communication_conversations cc
      WHERE ${unreadClauses.join(' AND ')}
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
    `, unreadParams);

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
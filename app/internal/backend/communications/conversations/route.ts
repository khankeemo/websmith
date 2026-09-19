import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import {
  isEmailDeletionEnabled,
  permanentlyDeleteConversations,
  cleanupOrphanedAttachmentFiles,
} from '@/lib/communications/delete-conversations';

export const dynamic = 'force-dynamic';

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
    const mailboxId = searchParams.get('mailbox_id');
    const hasCustomer = searchParams.get('has_customer') === 'true';
    const showDeleted = searchParams.get('show_deleted') === 'true';
    // Real "Sent": conversations that contain at least one admin outbound
    // email (an admin message row whose send actually succeeded). This is the
    // true sent location — NOT a proxy like status='resolved,closed'.
    const sent = searchParams.get('sent') === 'true';
    // Strict source separation: 'system' = Websmith Communications mail only
    // (support@/sales@/no-reply@ + system accounts — conversations NOT owned by
    // a mailbox integration), 'mailbox' = configured mailbox mail only.
    const source = searchParams.get('source');
    if (source && !['system', 'mailbox'].includes(source)) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_SOURCE', message: `Invalid source: "${source}". Valid: system, mailbox` } }, { status: 400 });
    }
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

    if (mailboxId) {
      whereClauses.push(`cc.mailbox_id = $${paramIndex++}`);
      params.push(mailboxId);
    }

    // Strict source separation — a conversation is system mail when it is NOT
    // owned by a mailbox integration (mailbox_id IS NULL) and mailbox mail
    // when it IS. Never both.
    if (source === 'system') {
      whereClauses.push(`cc.mailbox_id IS NULL`);
    } else if (source === 'mailbox') {
      whereClauses.push(`cc.mailbox_id IS NOT NULL`);
    }

    // Active-mailbox filtering — the mailboxes.is_enabled flag is the source
    // of truth. Mailbox-owned conversations are visible ONLY while their owning
    // mailbox integration is enabled, so disabling a mailbox hides its email
    // data from EVERY mailbox view (Inbox / Sent / Draft / Waiting / Failed /
    // Queued / Spam / Trash + account-scoped lists) without deleting any row.
    // Re-enabling the mailbox restores visibility. System mail (mailbox_id IS
    // NULL — Websmith Communications support/sales/no-reply) is never affected.
    whereClauses.push(`(
      cc.mailbox_id IS NULL
      OR EXISTS (SELECT 1 FROM mailboxes mb WHERE mb.id = cc.mailbox_id AND mb.is_enabled = TRUE)
    )`);

    // Real Sent: conversation has an outbound admin email that was delivered.
    if (sent) {
      whereClauses.push(`EXISTS (
        SELECT 1 FROM conversation_messages cm
        WHERE cm.conversation_id = cc.id
          AND cm.sender_type = 'admin'
          AND cm.email_sent = true
      )`);
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

export async function PATCH(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { action, ids } = body || {};

    const SUPPORTED_ACTIONS = ['mark_read', 'mark_unread', 'archive', 'restore'];
    if (!SUPPORTED_ACTIONS.includes(action)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_ACTION', message: `Invalid action. Supported: ${SUPPORTED_ACTIONS.join(', ')}` }
      }, { status: 400 });
    }

    const idList: string[] = Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];
    if (idList.length === 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'NO_IDS', message: 'No conversation ids provided.' }
      }, { status: 400 });
    }

    client = await (await getDb()).connect();

    // Resolve which of the requested ids actually exist, so the response can
    // report a REAL per-id result (found + updated vs missing/failed).
    const existingResult = await client.query(
      `SELECT id, deleted_at FROM communication_conversations WHERE id = ANY($1)`,
      [idList]
    );
    const existing = new Map(existingResult.rows.map((r: any) => [String(r.id), r.deleted_at]));

    const now = new Date().toISOString();
    let updated = 0;

    switch (action) {
      case 'mark_read':
        updated = (await client.query(
          `UPDATE communication_conversations SET admin_read_at = NOW() WHERE id = ANY($1)`,
          [idList]
        )).rowCount || 0;
        break;
      case 'mark_unread':
        updated = (await client.query(
          `UPDATE communication_conversations SET admin_read_at = NULL WHERE id = ANY($1)`,
          [idList]
        )).rowCount || 0;
        break;
      case 'archive':
        // Only active (non-trashed) conversations can be archived — same rule
        // as the per-conversation PATCH endpoint.
        const archivable = idList.filter(id => !existing.get(id));
        if (archivable.length > 0) {
          updated = (await client.query(
            `UPDATE communication_conversations SET status = 'closed', updated_at = $1 WHERE id = ANY($2)`,
            [now, archivable]
          )).rowCount || 0;
        }
        break;
      case 'restore':
        // Only trashed conversations can be restored (idempotent for the rest).
        const restorable = idList.filter(id => !!existing.get(id));
        if (restorable.length > 0) {
          updated = (await client.query(
            `UPDATE communication_conversations SET deleted_at = NULL, updated_at = $1 WHERE id = ANY($2)`,
            [now, restorable]
          )).rowCount || 0;
        }
        break;
    }

    client.release();
    client = null;

    const notFound = idList.length - existing.size;
    const skipped = Math.max(0, existing.size - updated);
    const failed = notFound + skipped;

    return NextResponse.json({
      success: true,
      data: { action, total: idList.length, updated, failed, not_found: notFound }
    });
  } catch (error: any) {
    console.error('Communications conversations bulk patch error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update conversations.' }
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

    // Backend-enforced setting: Allow Email Deletion must be enabled for ANY
    // permanent delete path (bulk ids + empty_trash). Direct API calls are
    // rejected even if the UI hides the buttons.
    if (!(await isEmailDeletionEnabled(client))) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'EMAIL_DELETION_DISABLED', message: 'Email deletion is disabled by the admin. Enable "Allow Email Deletion" in Communication Settings to delete conversations.' }
      }, { status: 403 });
    }

    if (action === 'empty_trash') {
      // Strict source separation: empty ONLY the trash of the section that
      // requested it — 'system' = Universal/Websmith Communications mail
      // (mailbox_id IS NULL), 'mailbox' = configured mailbox mail
      // (mailbox_id IS NOT NULL), optionally narrowed to one mailbox. Without
      // a source param the legacy global behavior (all trash) is kept.
      const source = searchParams.get('source');
      if (source && !['system', 'mailbox'].includes(source)) {
        client.release();
        client = null;
        return NextResponse.json({ success: false, error: { code: 'INVALID_SOURCE', message: `Invalid source: "${source}". Valid: system, mailbox` } }, { status: 400 });
      }
      const mailboxId = searchParams.get('mailbox_id');
      const category = searchParams.get('category');

      const trashClauses: string[] = ['deleted_at IS NOT NULL'];
      const trashParams: any[] = [];
      if (source === 'system') {
        trashClauses.push('mailbox_id IS NULL');
      } else if (source === 'mailbox') {
        trashClauses.push('mailbox_id IS NOT NULL');
      }
      if (mailboxId) {
        trashClauses.push(`mailbox_id = $${trashParams.length + 1}`);
        trashParams.push(mailboxId);
      }
      if (category) {
        const categories = category.split(',');
        const invalid = categories.filter(c => !VALID_CATEGORIES.includes(c));
        if (invalid.length > 0) {
          client.release();
          client = null;
          return NextResponse.json({ success: false, error: { code: 'INVALID_CATEGORY', message: `Invalid category values: ${invalid.join(', ')}. Valid: ${VALID_CATEGORIES.join(', ')}` } }, { status: 400 });
        }
        trashClauses.push(`category = ANY($${trashParams.length + 1})`);
        trashParams.push(categories);
      }

      // Permanently delete the scoped soft-deleted conversations (one transaction)
      const target = await client.query(
        `SELECT id FROM communication_conversations WHERE ${trashClauses.join(' AND ')}`,
        trashParams
      );
      const trashIds = target.rows.map((r: any) => r.id);

      if (trashIds.length === 0) {
        client.release();
        client = null;
        return NextResponse.json({
          success: true,
          data: { message: 'Trash is already empty.', deleted: 0 }
        });
      }

      const { deleted, attachmentPaths } = await permanentlyDeleteConversations(client, trashIds);
      await cleanupOrphanedAttachmentFiles(client, attachmentPaths);

      client.release();
      client = null;

      return NextResponse.json({
        success: true,
        data: { message: `${deleted.length} conversation(s) permanently deleted.`, deleted: deleted.length }
      });
    }

    if (ids.length > 0) {
      // Permanently delete selected conversations (admin only, one transaction)
      const { deleted, attachmentPaths } = await permanentlyDeleteConversations(client, ids);
      await cleanupOrphanedAttachmentFiles(client, attachmentPaths);

      client.release();
      client = null;

      return NextResponse.json({
        success: true,
        data: { message: `${deleted.length} conversation(s) permanently deleted.`, deleted: deleted.length }
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

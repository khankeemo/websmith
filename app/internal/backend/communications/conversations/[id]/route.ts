import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import {
  isEmailDeletionEnabled,
  permanentlyDeleteConversations,
  cleanupOrphanedAttachmentFiles,
} from '@/lib/communications/delete-conversations';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  let deliveryLogsResult = { rows: [] };
  try {
    const { id } = await params;
    client = await (await getDb()).connect();

    const convResult = await client.query(
      `SELECT cc.*,
         (SELECT COUNT(*) FROM conversation_messages cm
          WHERE cm.conversation_id = cc.id
            AND cm.sender_type = 'customer'
            AND (cm.is_internal IS NULL OR cm.is_internal = false)
            AND cm.created_at > GREATEST(
              COALESCE((
                SELECT MAX(cm2.created_at) FROM conversation_messages cm2
                WHERE cm2.conversation_id = cc.id AND cm2.sender_type = 'admin'
              ), '1970-01-01T00:00:00Z'),
              COALESCE(cc.admin_read_at, '1970-01-01T00:00:00Z')
            )) as unread_replies
        FROM communication_conversations cc
        WHERE cc.id = $1
          AND (
            cc.mailbox_id IS NULL
            OR EXISTS (SELECT 1 FROM mailboxes mb WHERE mb.id = cc.mailbox_id AND mb.is_enabled = TRUE)
          )`,
      [id]
    );

    if (convResult.rows.length === 0) {
      client.release();
      return NextResponse.json({
        success: false,
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' }
      }, { status: 404 });
    }

    const conversation = convResult.rows[0];

    const messagesResult = await client.query(
      `SELECT cm.*, EXISTS (
         SELECT 1 FROM conversation_attachments ca WHERE ca.message_id = cm.id
       ) AS has_attachments
       FROM conversation_messages cm 
       WHERE cm.conversation_id = $1 AND (cm.is_internal = false OR cm.is_internal IS NULL)
       ORDER BY cm.created_at ASC`,
      [id]
    );

    const internalResult = await client.query(
      `SELECT cm.*, EXISTS (
         SELECT 1 FROM conversation_attachments ca WHERE ca.message_id = cm.id
       ) AS has_attachments
       FROM conversation_messages cm 
       WHERE cm.conversation_id = $1 AND cm.is_internal = true
       ORDER BY cm.created_at ASC`,
      [id]
    );

    try {
      deliveryLogsResult = await client.query(
        `SELECT * FROM message_queue
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [id]
      );
    } catch (deliveryLogsError) {
      console.warn('message_queue table not available, skipping delivery logs:', deliveryLogsError.message);
      deliveryLogsResult = { rows: [] };
    }

    // Attachments for every message in this conversation
    let attachmentsResult = { rows: [] };
    try {
      attachmentsResult = await client.query(
        `SELECT ca.id, ca.message_id, ca.file_name, ca.file_size, ca.mime_type,
                ca.storage_path, ca.uploaded_at,
                cm.sender_name, cm.created_at AS message_created_at
         FROM conversation_attachments ca
         JOIN conversation_messages cm ON cm.id = ca.message_id
         WHERE ca.message_id IN (SELECT id FROM conversation_messages WHERE conversation_id = $1)
         ORDER BY ca.uploaded_at DESC`,
        [id]
      );
    } catch (attachmentsError) {
      console.warn('conversation_attachments table not available, skipping:', attachmentsError.message);
    }

    const customerEmail = conversation.customer_email || '';

    // Customer record (single source of truth)
    let customerResult = { rows: [] };
    if (customerEmail) {
      try {
        customerResult = await client.query(
          `SELECT id, name, email, company, phone, mobile, country, city, state, postal_code, created_at
           FROM customers WHERE email = $1 LIMIT 1`,
          [customerEmail]
        );
      } catch (customerError) {
        console.warn('customers lookup skipped:', customerError.message);
      }
    }

    // Licenses for this customer
    let licensesResult = { rows: [] };
    if (customerEmail) {
      try {
        licensesResult = await client.query(
          `SELECT license_key, product_id, product_name, plan_name, status, expiry_date, activated_at, created_at
           FROM licenses WHERE customer_email = $1 ORDER BY created_at DESC LIMIT 10`,
          [customerEmail]
        );
      } catch (licenseError) {
        console.warn('licenses lookup skipped:', licenseError.message);
      }
    }

    // Orders + payments for this customer
    let ordersResult = { rows: [] };
    let paymentsResult = { rows: [] };
    if (customerEmail) {
      try {
        ordersResult = await client.query(
          `SELECT id, order_number, status, subtotal, discount, tax, total, currency, coupon_code, payment_gateway, created_at
           FROM orders WHERE customer_email = $1 ORDER BY created_at DESC LIMIT 10`,
          [customerEmail]
        );
        if (ordersResult.rows.length > 0) {
          const orderIds = ordersResult.rows.map((o: any) => o.id);
          paymentsResult = await client.query(
            `SELECT id, order_id, amount, currency, gateway, status, payment_intent_id, paid_at
             FROM payments WHERE order_id = ANY($1) ORDER BY created_at DESC LIMIT 20`,
            [orderIds]
          );
        }
      } catch (orderError) {
        console.warn('orders/payments lookup skipped:', orderError.message);
      }
    }

    // Audit history: events tied to this conversation or its license
    let auditResult = { rows: [] };
    try {
      const auditParams: any[] = [];
      const clauses: string[] = [];
      let pi = 1;
      if (conversation.license_key) {
        clauses.push(`license_key = $${pi++}`);
        auditParams.push(conversation.license_key);
      }
      if (customerEmail) {
        clauses.push(`message ILIKE $${pi++}`);
        auditParams.push(`%${customerEmail}%`);
      }
      clauses.push(`message ILIKE $${pi++}`);
      auditParams.push(`%${id}%`);
      auditResult = await client.query(
        `SELECT event_type, message, timestamp FROM audit_logs
         WHERE (${clauses.join(' OR ')})
         ORDER BY timestamp DESC LIMIT 20`,
        auditParams
      );
    } catch (auditError) {
      console.warn('audit lookup skipped:', auditError.message);
    }

    client.release();
    client = null;

    const messages = messagesResult.rows;
    const internalNotes = internalResult.rows;
    const deliveryLogs = deliveryLogsResult.rows;

    return NextResponse.json({
      success: true,
      data: {
        conversation,
        messages,
        internal_notes: internalNotes,
        delivery_logs: deliveryLogs,
        attachments: attachmentsResult.rows,
        customer: customerResult.rows[0] || null,
        licenses: licensesResult.rows,
        orders: ordersResult.rows,
        payments: paymentsResult.rows,
        audit: auditResult.rows,
      }
    });

  } catch (error: any) {
    console.error('Communications conversation detail error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load conversation.' }
    }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    client = await (await getDb()).connect();

    const convResult = await client.query(
      'SELECT * FROM communication_conversations WHERE id = $1',
      [id]
    );

    if (convResult.rows.length === 0) {
      client.release();
      return NextResponse.json({
        success: false,
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' }
      }, { status: 404 });
    }

    const conversation = convResult.rows[0];

    // Check if this is a permanent delete request (admin only)
    const searchParams = new URL(_request.url).searchParams;
    const permanent = searchParams.get('permanent') === 'true';

    if (permanent) {
      // Backend-enforced setting: Allow Email Deletion must be enabled.
      // Never rely on the UI to hide this — direct API calls are rejected too.
      if (!(await isEmailDeletionEnabled(client))) {
        client.release();
        client = null;
        return NextResponse.json({
          success: false,
          error: { code: 'EMAIL_DELETION_DISABLED', message: 'Email deletion is disabled by the admin. Enable "Allow Email Deletion" in Communication Settings to delete conversations.' }
        }, { status: 403 });
      }

      // Permanent delete — one atomic transaction (messages + attachments via
      // FK cascade, queue records, the conversation row). Attachment files are
      // removed after commit and only when no other record still references
      // them (shared files are never deleted).
      const { deleted, attachmentPaths } = await permanentlyDeleteConversations(client, [id]);
      await cleanupOrphanedAttachmentFiles(client, attachmentPaths);

      client.release();
      client = null;

      return NextResponse.json({ success: true, data: { message: `${deleted.length} conversation permanently deleted.` } });
    }

    // Soft delete - set deleted_at timestamp. Idempotent: a conversation that
    // is already in Trash is treated as a SUCCESS (the desired end state is
    // already reached), exactly like professional mail clients. The UI must
    // never see "already deleted" while the row is still listed as active.
    if (conversation.deleted_at) {
      client.release();
      client = null;
      return NextResponse.json({
        success: true,
        data: { message: 'Conversation is already in trash.', already: true }
      });
    }

    const now = new Date().toISOString();
    await client.query(
      'UPDATE communication_conversations SET deleted_at = $1, updated_at = $2 WHERE id = $3',
      [now, now, id]
    );

    client.release();
    client = null;

    return NextResponse.json({ success: true, data: { message: 'Conversation moved to trash.' } });

  } catch (error: any) {
    console.error('Communications conversation delete error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete conversation.' }
    }, { status: 500 });
  }
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    const body = await _request.json();
    const { action } = body;

    const SUPPORTED_ACTIONS = ['restore', 'mark_read', 'mark_unread', 'archive'];
    if (!SUPPORTED_ACTIONS.includes(action)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_ACTION', message: `Invalid action. Supported: ${SUPPORTED_ACTIONS.join(', ')}` }
      }, { status: 400 });
    }

    client = await (await getDb()).connect();

    const convResult = await client.query(
      'SELECT * FROM communication_conversations WHERE id = $1',
      [id]
    );

    if (convResult.rows.length === 0) {
      client.release();
      return NextResponse.json({
        success: false,
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' }
      }, { status: 404 });
    }

    const conversation = convResult.rows[0];

    if (action === 'mark_read') {
      await client.query(
        'UPDATE communication_conversations SET admin_read_at = NOW() WHERE id = $1',
        [id]
      );
      client.release();
      client = null;
      return NextResponse.json({ success: true, data: { message: 'Conversation marked as read.' } });
    }

    if (action === 'mark_unread') {
      await client.query(
        'UPDATE communication_conversations SET admin_read_at = NULL WHERE id = $1',
        [id]
      );
      client.release();
      client = null;
      return NextResponse.json({ success: true, data: { message: 'Conversation marked as unread.' } });
    }

    if (action === 'archive') {
      if (conversation.deleted_at) {
        client.release();
        return NextResponse.json({
          success: false,
          error: { code: 'ALREADY_DELETED', message: 'Conversation is in trash; restore it before archiving.' }
        }, { status: 400 });
      }
      const now = new Date().toISOString();
      await client.query(
        `UPDATE communication_conversations SET status = 'closed', updated_at = $1 WHERE id = $2`,
        [now, id]
      );
      client.release();
      client = null;
      return NextResponse.json({ success: true, data: { message: 'Conversation archived.' } });
    }

    if (action === 'restore') {
      if (!conversation.deleted_at) {
        client.release();
        return NextResponse.json({
          success: false,
          error: { code: 'NOT_DELETED', message: 'Conversation is not deleted.' }
        }, { status: 400 });
      }

      const now = new Date().toISOString();
      await client.query(
        'UPDATE communication_conversations SET deleted_at = NULL, updated_at = $1 WHERE id = $2',
        [now, id]
      );

      client.release();
      client = null;

      return NextResponse.json({ success: true, data: { message: 'Conversation restored from trash.' } });
    }

    client.release();
    client = null;

  } catch (error: any) {
    console.error('Communications conversation restore error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to restore conversation.' }
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'retry') {
      client = await (await getDb()).connect();

const convResult = await client.query(
      `SELECT cc.*,
         (SELECT COUNT(*) FROM conversation_messages cm
          WHERE cm.conversation_id = cc.id
            AND cm.sender_type = 'customer'
            AND (cm.is_internal IS NULL OR cm.is_internal = false)
            AND cm.created_at > GREATEST(
              COALESCE((
                SELECT MAX(cm2.created_at) FROM conversation_messages cm2
                WHERE cm2.conversation_id = cc.id AND cm2.sender_type = 'admin'
              ), '1970-01-01T00:00:00Z'),
              COALESCE(cc.admin_read_at, '1970-01-01T00:00:00Z')
            )) as unread_replies
       FROM communication_conversations cc
       WHERE cc.id = $1`,
      [id]
    );

      if (convResult.rows.length === 0) {
        client.release();
        return NextResponse.json({
          success: false,
          error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' }
        }, { status: 404 });
      }

      const retryResult = await client.query(
        `UPDATE message_queue
         SET status = 'pending', retry_count = 0, last_error = NULL, next_retry_at = NOW()
         WHERE conversation_id = $1 AND status = 'failed'
         RETURNING id`,
        [id]
      );

      client.release();
      client = null;

      const retried = retryResult.rows.length;

      return NextResponse.json({
        success: true,
        data: { message: `${retried} failed message(s) queued for retry.`, retried }
      });
    }

    return NextResponse.json({
      success: false,
      error: { code: 'INVALID_ACTION', message: 'Invalid action. Supported: retry' }
    }, { status: 400 });

  } catch (error: any) {
    console.error('Communications conversation post error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to process request.' }
    }, { status: 500 });
  }
}

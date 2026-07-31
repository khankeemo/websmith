import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

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

    const messagesResult = await client.query(
      `SELECT * FROM conversation_messages 
       WHERE conversation_id = $1 AND (is_internal = false OR is_internal IS NULL)
       ORDER BY created_at ASC`,
      [id]
    );

    const internalResult = await client.query(
      `SELECT * FROM conversation_messages 
       WHERE conversation_id = $1 AND is_internal = true
       ORDER BY created_at ASC`,
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

    client.release();
    client = null;

    const conversation = convResult.rows[0];
    const messages = messagesResult.rows;
    const internalNotes = internalResult.rows;
    const deliveryLogs = deliveryLogsResult.rows;

    return NextResponse.json({
      success: true,
      data: { conversation, messages, internal_notes: internalNotes, delivery_logs: deliveryLogs }
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
      // Permanent delete - remove all related data
      await client.query('DELETE FROM conversation_messages WHERE conversation_id = $1', [id]);
      try {
        await client.query('DELETE FROM message_queue WHERE conversation_id = $1', [id]);
      } catch (queueDeleteError) {
        console.warn('message_queue cleanup skipped:', queueDeleteError.message);
      }
      await client.query('DELETE FROM communication_conversations WHERE id = $1', [id]);

      client.release();
      client = null;

      return NextResponse.json({ success: true, data: { message: 'Conversation permanently deleted.' } });
    }

    // Soft delete - set deleted_at timestamp
    if (conversation.deleted_at) {
      client.release();
      return NextResponse.json({
        success: false,
        error: { code: 'ALREADY_DELETED', message: 'Conversation is already deleted.' }
      }, { status: 400 });
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

    if (action !== 'restore') {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'Invalid action. Supported: restore' }
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

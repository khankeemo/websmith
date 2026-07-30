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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    client = await pool.connect();

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

    const deliveryLogsResult = await client.query(
      `SELECT * FROM message_queue
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [id]
    );

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
    client = await pool.connect();

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

    await client.query('DELETE FROM conversation_messages WHERE conversation_id = $1', [id]);
    await client.query('DELETE FROM communication_conversations WHERE id = $1', [id]);

    client.release();
    client = null;

    return NextResponse.json({ success: true, data: { message: 'Conversation deleted.' } });

  } catch (error: any) {
    console.error('Communications conversation delete error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete conversation.' }
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
      client = await pool.connect();

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

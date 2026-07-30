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

    const attachmentsResult = await client.query(
      `SELECT * FROM conversation_attachments 
       WHERE message_id IN (SELECT id FROM conversation_messages WHERE conversation_id = $1)
       ORDER BY uploaded_at ASC`,
      [id]
    );

    client.release();
    client = null;

    const conversation = convResult.rows[0];
    const messages = messagesResult.rows;
    const internalNotes = internalResult.rows;
    const attachments = attachmentsResult.rows;

    return NextResponse.json({
      success: true,
      data: { conversation, messages, internal_notes: internalNotes, attachments }
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

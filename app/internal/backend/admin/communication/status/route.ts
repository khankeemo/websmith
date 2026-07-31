import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

const VALID_STATUSES = ['open', 'waiting_customer', 'waiting_support', 'waiting_sales', 'resolved', 'closed'];

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { conversation_id, status } = body;

    if (!conversation_id || !status) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'conversation_id and status are required' }
      }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `status must be one of: ${VALID_STATUSES.join(', ')}` }
      }, { status: 400 });
    }

    client = await (await getDb()).connect();

    const convResult = await client.query(
      'SELECT * FROM communication_conversations WHERE id = $1',
      [conversation_id]
    );

    if (convResult.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' }
      }, { status: 404 });
    }

    const now = new Date().toISOString();
    await client.query(
      'UPDATE communication_conversations SET status = $1, updated_at = $2 WHERE id = $3',
      [status, now, conversation_id]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['conversation_status_changed', `Conversation ${conversation_id} status changed to ${status}`, now]
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      message: 'Status updated successfully.',
    });

  } catch (error: any) {
    console.error('Admin communication status error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update status.' }
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let client = null;
  try {
    client = await (await getDb()).connect();

    const [conversationsResult, mailboxResult, queueResult, logsResult] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS total FROM communication_conversations WHERE deleted_at IS NULL`),
      client.query(`SELECT COUNT(*)::int AS total FROM mailboxes WHERE is_enabled = TRUE`),
      client.query(`SELECT COUNT(*)::int AS total FROM message_queue WHERE status IN ('pending','sending')`),
      client.query(`SELECT COUNT(*)::int AS total FROM audit_logs`),
    ]);

    const payload = {
      success: true,
      data: {
        status: 'ready',
        total_conversations: Number(conversationsResult.rows[0]?.total || 0),
        active_mailboxes: Number(mailboxResult.rows[0]?.total || 0),
        queued_messages: Number(queueResult.rows[0]?.total || 0),
        audit_log_count: Number(logsResult.rows[0]?.total || 0),
        endpoints: {
          settings: '/internal/backend/communications/settings',
          conversations: '/internal/backend/communications/conversations',
          queue: '/internal/backend/communications/queue',
          delivery_logs: '/internal/backend/communications/delivery-logs',
          native_receive: '/internal/backend/communications/native-receive',
        },
      },
    };

    client.release();
    client = null;

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('Communications index error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: true,
      data: {
        status: 'ready',
        total_conversations: 0,
        active_mailboxes: 0,
        queued_messages: 0,
        audit_log_count: 0,
        endpoints: {
          settings: '/internal/backend/communications/settings',
          conversations: '/internal/backend/communications/conversations',
          queue: '/internal/backend/communications/queue',
          delivery_logs: '/internal/backend/communications/delivery-logs',
          native_receive: '/internal/backend/communications/native-receive',
        },
      },
    });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      status: 'ready',
      message: 'Communications backend is available.',
    },
  });
}

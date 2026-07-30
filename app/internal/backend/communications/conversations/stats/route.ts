import { NextResponse } from 'next/server';
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

export async function GET() {
  let client = null;
  try {
    client = await pool.connect();

    const statusCounts = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('open', 'waiting_customer')) as inbox_count,
        COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as sent_count,
        COUNT(*) FILTER (WHERE status IN ('waiting_support', 'waiting_sales')) as waiting_count
      FROM communication_conversations
    `);

    const failedCount = await client.query(`
      SELECT COUNT(*) as count FROM message_queue 
      WHERE status = 'failed' OR retry_count >= max_retries
    `);

    const queueCount = await client.query(`
      SELECT COUNT(*) as count FROM message_queue 
      WHERE status IN ('pending', 'sending')
    `);

    const unreadCount = await client.query(`
      SELECT COUNT(*) as count FROM conversation_messages 
      WHERE sender_type = 'customer' AND email_sent = false
    `);

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: {
        inbox: parseInt(statusCounts.rows[0].inbox_count, 10),
        sent: parseInt(statusCounts.rows[0].sent_count, 10),
        waiting: parseInt(statusCounts.rows[0].waiting_count, 10),
        failed: parseInt(failedCount.rows[0].count, 10),
        queued: parseInt(queueCount.rows[0].count, 10),
        unread: parseInt(unreadCount.rows[0].count, 10),
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

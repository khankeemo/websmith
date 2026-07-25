import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { sendEmail } from '@/lib/email/brevo';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const CATEGORY_ROUTE_MAP: Record<string, string> = {
  support: 'support_reply',
  sales: 'sales_reply',
  activation: 'support_reply',
  renewal: 'support_reply',
  reactivation: 'support_reply',
  hardware_replacement: 'support_reply',
  general: 'support_reply',
};

const CATEGORY_ADMIN_EMAIL_MAP: Record<string, string> = {
  support: process.env.MAIL_SUPPORT_ADDRESS || 'support@example.com',
  sales: process.env.MAIL_SALES_ADDRESS || 'sales@example.com',
  activation: process.env.MAIL_SUPPORT_ADDRESS || 'support@example.com',
  renewal: process.env.MAIL_SUPPORT_ADDRESS || 'support@example.com',
  reactivation: process.env.MAIL_SUPPORT_ADDRESS || 'support@example.com',
  hardware_replacement: process.env.MAIL_SUPPORT_ADDRESS || 'support@example.com',
  general: process.env.MAIL_SUPPORT_ADDRESS || 'support@example.com',
};

export async function POST(request: NextRequest) {
  let client = null;

  try {
    const body = await request.json();
    const { conversation_id, message, sender_name, is_internal } = body;

    if (!conversation_id || !message || !message.trim()) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'conversation_id and message are required' }
      }, { status: 400 });
    }

    client = await pool.connect();

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

    const conv = convResult.rows[0];
    const now = new Date().toISOString();
    const adminName = sender_name || 'Support Team';

    await client.query(
      `INSERT INTO conversation_messages
       (conversation_id, sender_type, sender_name, sender_email, message, is_internal, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [conversation_id, 'admin', adminName, '', message, is_internal || false, now]
    );

    await client.query(
      'UPDATE communication_conversations SET status = $1, updated_at = $2 WHERE id = $3',
      ['waiting_customer', now, conversation_id]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['admin_conversation_reply', `Admin reply added to conversation ${conversation_id}`, now]
    );

    if (!is_internal && conv.customer_email && process.env.BREVO_API_KEY) {
      const emailTemplate = CATEGORY_ROUTE_MAP[conv.category] || 'support_reply';
      const adminEmail = CATEGORY_ADMIN_EMAIL_MAP[conv.category] || process.env.MAIL_SUPPORT_ADDRESS || 'support@example.com';
      try {
        const emailResult = await sendEmail(
          pool,
          emailTemplate,
          { email: adminEmail, name: conv.category === 'sales' ? 'Sales' : 'Support' },
          {
            conversation_id,
            customer_name: conv.customer_name || 'N/A',
            customer_email: conv.customer_email,
            message,
          }
        );
        if (!emailResult.success) {
          console.error(`[Admin Comm] Reply email delivery failed for ${conversation_id}:`, emailResult.error);
          await client.query(
            `INSERT INTO audit_logs (event_type, message, timestamp)
             VALUES ($1, $2, $3)`,
            ['email_failed', `Admin reply email failed for ${conversation_id}: ${emailResult.error || 'Unknown error'}`, now]
          );
        }
      } catch (emailError: any) {
        console.error(`[Admin Comm] Reply email delivery failed for ${conversation_id}:`, emailError?.message || emailError);
        await client.query(
          `INSERT INTO audit_logs (event_type, message, timestamp)
           VALUES ($1, $2, $3)`,
          ['email_failed', `Admin reply email failed for ${conversation_id}: ${emailError?.message || 'Unknown error'}`, now]
        );
      }
    }

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully.',
    });

  } catch (error: any) {
    console.error('Admin communication reply error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send reply.' }
    }, { status: 500 });
  }
}

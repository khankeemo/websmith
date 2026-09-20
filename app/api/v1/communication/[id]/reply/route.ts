import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey } from '@/lib/public-api/auth';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest } from '@/lib/public-api/audit';
import { sendEmail } from '@/lib/email/mailer';

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

const CATEGORY_EMAIL_MAP: Record<string, string> = {
  support: process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com',
  sales: process.env.MAIL_SALES_ADDRESS || 'sales@websmithdigital.com',
  activation: process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com',
  renewal: process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com',
  reactivation: process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com',
  hardware_replacement: process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com',
  general: process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const startTime = Date.now();
  let client = null;
  let apiKeyId = '';

  try {
    const apiKey = request.headers.get('X-API-Key');
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_API_KEY', message: 'X-API-Key header is required' }
      }, { status: 401 });
    }

    let authResult;
    try {
      authResult = await validateApiKey(apiKey);
      apiKeyId = authResult.apiKeyId;
    } catch (authError: any) {
      return NextResponse.json({
        success: false,
        error: { code: authError.code || 'AUTH_ERROR', message: authError.message || 'Authentication failed' }
      }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, `/api/v1/communication/${id}/reply`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Try again later.' }
      }, { status: 429 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' }
      }, { status: 400 });
    }

    const { message, customer_name, customer_email, hardware_id } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_MESSAGE', message: 'message is required' }
      }, { status: 400 });
    }

    client = await pool.connect();

    const convResult = await client.query(
      'SELECT * FROM communication_conversations WHERE id = $1',
      [id]
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
    if (conv.status === 'closed' || conv.status === 'resolved') {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'CONVERSATION_CLOSED', message: 'This conversation is closed. Cannot reply.' }
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    await client.query(
      `INSERT INTO conversation_messages
       (conversation_id, sender_type, sender_name, sender_email, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, 'customer', customer_name || conv.customer_name || '', customer_email || conv.customer_email || '', message, now]
    );

    const newStatus = conv.category === 'sales' ? 'waiting_sales' : 'waiting_support';
    await client.query(
      'UPDATE communication_conversations SET status = $1, updated_at = $2 WHERE id = $3',
      [newStatus, now, id]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
       VALUES ($1, $2, $3, $4, $5)`,
      ['conversation_customer_reply', `Customer reply added to conversation ${id}`, now, ipAddress, conv.license_key || null]
    );

    client.release();
    client = null;

    const emailTemplate = CATEGORY_ROUTE_MAP[conv.category] || 'support_reply';
    const adminEmail = CATEGORY_EMAIL_MAP[conv.category] || process.env.MAIL_SUPPORT_ADDRESS || 'support@example.com';

    try {
      const emailResult = await sendEmail(
        pool,
        emailTemplate,
        { email: adminEmail, name: conv.category === 'sales' ? 'Sales' : 'Support' },
        {
          conversation_id: id,
          customer_name: customer_name || conv.customer_name || 'N/A',
          customer_email: customer_email || conv.customer_email || 'N/A',
          message: message,
        }
      );
      if (!emailResult.success) {
        console.error(`[Communication] Reply email delivery failed for ${id}:`, emailResult.error);
      }
    } catch (emailError: any) {
      console.error(`[Communication] Reply email delivery failed for ${id}:`, emailError?.message || emailError);
      try {
        const auditClient = await pool.connect();
        await auditClient.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
           VALUES ($1, $2, $3, $4)`,
          ['email_failed', `Reply email failed for ${id}: ${emailError?.message || 'Unknown error'}`, now, ipAddress]
        );
        auditClient.release();
      } catch (auditError) {
        console.error(`[Communication Reply] Failed to write audit log for email failure (conversation ${id}):`, auditError instanceof Error ? auditError.message : auditError);
      }
    }
 
    await logRequest({
      apiKeyId, endpoint: `/api/v1/communication/${id}/reply`, method: 'POST',
      statusCode: 200, ipAddress, userAgent,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully.',
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Communication reply error:', error);

    if (client) { client.release(); }

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send reply.' }
    }, { status: 500 });
  }
}
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

const MAIL_SUPPORT_ADDRESS = process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com';
const MAIL_SALES_ADDRESS = process.env.MAIL_SALES_ADDRESS || 'sales@websmithdigital.com';

const CATEGORY_ROUTES: Record<string, { email: string; template: string }> = {
  support: { email: MAIL_SUPPORT_ADDRESS, template: 'admin_notification' },
  sales: { email: MAIL_SALES_ADDRESS, template: 'new_sales_enquiry' },
  activation: { email: MAIL_SUPPORT_ADDRESS, template: 'admin_notification' },
  renewal: { email: MAIL_SUPPORT_ADDRESS, template: 'admin_notification' },
  reactivation: { email: MAIL_SUPPORT_ADDRESS, template: 'admin_notification' },
  hardware_replacement: { email: MAIL_SUPPORT_ADDRESS, template: 'admin_notification' },
  general: { email: MAIL_SUPPORT_ADDRESS, template: 'admin_notification' },
};

const VALID_CATEGORIES = Object.keys(CATEGORY_ROUTES);

export async function POST(request: NextRequest) {
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

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/communication/create');
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

    const {
      category, customer_email, customer_name, subject, message,
      product_id, license_key, hardware_id, sdk_version, runtime_type,
    } = body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_CATEGORY', message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }
      }, { status: 400 });
    }

    if (!message || !message.trim()) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_MESSAGE', message: 'message is required' }
      }, { status: 400 });
    }

    const normalizedEmail = (customer_email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_EMAIL', message: 'customer_email is required' }
      }, { status: 400 });
    }

    client = await pool.connect();

    const now = new Date().toISOString();
    const conversationId = `CONV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await client.query(
      `INSERT INTO communication_conversations
       (id, category, status, customer_email, customer_name, subject,
        product_id, license_key, hardware_id, sdk_version, runtime_type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [conversationId, category, 'open', normalizedEmail, customer_name || '',
       subject || '', product_id || '', license_key || '', hardware_id || '',
       sdk_version || '', runtime_type || '', now, now]
    );

    await client.query(
      `INSERT INTO conversation_messages
       (conversation_id, sender_type, sender_name, sender_email, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [conversationId, 'customer', customer_name || normalizedEmail, normalizedEmail, message, now]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
       VALUES ($1, $2, $3, $4, $5)`,
      ['conversation_created', `Conversation ${conversationId} created (${category}) by ${normalizedEmail}`, now, ipAddress, license_key || null]
    );

    client.release();
    client = null;

    const route = CATEGORY_ROUTES[category];
    try {
      const emailResult = await sendEmail(
        pool,
        route.template,
        { email: route.email, name: category === 'sales' ? 'Sales' : 'Support' },
        {
          conversation_id: conversationId,
          customer_name: customer_name || 'N/A',
          customer_email: normalizedEmail,
          product_name: product_id || 'N/A',
          license_key: license_key || 'N/A',
          hardware_id: hardware_id || 'N/A',
          subject: subject || `${category} conversation`,
          message: message,
          category: category,
        }
      );
      if (!emailResult.success) {
        console.error(`[Communication] Email delivery failed for ${conversationId}:`, emailResult.error);
      }
    } catch (emailError: any) {
      console.error(`[Communication] Email delivery failed for ${conversationId}:`, emailError?.message || emailError);
      try {
        const auditClient = await pool.connect();
        await auditClient.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
           VALUES ($1, $2, $3, $4)`,
          ['email_failed', `Communication email failed for ${conversationId}: ${emailError?.message || 'Unknown error'}`, now, ipAddress]
        );
        auditClient.release();
      } catch (auditError) {
        console.error(`[Communication] Failed to write audit log for email failure (conversation ${conversationId}):`, auditError instanceof Error ? auditError.message : auditError);
      }
    }
 
    await logRequest({
      apiKeyId, endpoint: '/api/v1/communication/create', method: 'POST',
      statusCode: 200, ipAddress, userAgent,
      latencyMs: Date.now() - startTime,
      requestRedacted: { license_key: license_key ? '[REDACTED]' : undefined }
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation created successfully.',
      conversation_id: conversationId,
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Communication create error:', error);

    if (client) { client.release(); }

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create conversation. Please try again.' }
    }, { status: 500 });
  }
}
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

const SUPPORT_EMAIL = process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com';

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

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/support');
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
      request_type, license_key, customer_name, customer_email,
      hardware_id, subject, message, product_name, plan_name,
    } = body;

    if (!request_type || request_type !== 'SUPPORT') {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_REQUEST_TYPE', message: 'request_type must be SUPPORT' }
      }, { status: 400 });
    }

    if (!message || !message.trim()) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_MESSAGE', message: 'message is required' }
      }, { status: 400 });
    }

    client = await pool.connect();

    const now = new Date().toISOString();
    const requestId = `SUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await client.query(
      `INSERT INTO requests (request_id, request_type, status, customer_email, customer_name,
        product_id, product_name, plan_name, license_key, hardware_id,
        subject, message, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [requestId, 'SUPPORT', 'open', customer_email || null, customer_name || null,
       authResult?.productId || null, product_name || null, plan_name || null,
       license_key || null, hardware_id || null,
       subject || 'Support Request', message, now, now]
    );

    // Insert audit log for the support request
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
       VALUES ($1, $2, $3, $4, $5)`,
      ['support_request_created', `Support request ${requestId} created by ${customer_email || 'anonymous'}`, now, ipAddress, license_key || null]
    );

    client.release();
    client = null;

    // Send email notification - log failures but don't lose the request
    try {
      const emailBody = [
        `Request ID: ${requestId}`,
        `Type: SUPPORT`,
        `Customer: ${customer_name || 'Anonymous'}`,
        `Email: ${customer_email || 'Not provided'}`,
        `License: ${license_key || 'N/A'}`,
        `Subject: ${subject || 'Support Request'}`,
        ``,
        `Message:`,
        `${message}`,
      ].join('\n');

      const emailResult = await sendEmail(
        pool,
        'admin_notification',
        { email: SUPPORT_EMAIL, name: 'Support' },
        {
          request_id: requestId,
          request_type: 'SUPPORT',
          customer_name: customer_name || 'Anonymous',
          customer_email: customer_email || 'Not provided',
          product_name: product_name || 'N/A',
          plan_name: plan_name || 'N/A',
          license_key: license_key || 'N/A',
          subject: subject || 'Support Request',
          message: emailBody,
        }
      );
      console.log(`[Support] Email sent for ${requestId}:`, emailResult.success ? 'success' : 'failed', emailResult.messageId ? `(messageId: ${emailResult.messageId})` : '');
    } catch (emailError: any) {
      console.error(`[Support] Email delivery failed for ${requestId}:`, emailError?.message || emailError);
      try {
        const auditClient = await pool.connect();
        await auditClient.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
           VALUES ($1, $2, $3, $4, $5)`,
          ['email_failed', `Support email delivery failed for request ${requestId}: ${emailError?.message || 'Unknown error'}`, now, ipAddress, license_key || null]
        );
        auditClient.release();
      } catch (auditError) {
        console.error(`[Support] Failed to write audit log for email failure (request ${requestId}):`, auditError instanceof Error ? auditError.message : auditError);
      }
    }

    await logRequest({
      apiKeyId, endpoint: '/api/v1/support', method: 'POST',
      statusCode: 200, ipAddress, userAgent,
      latencyMs: Date.now() - startTime,
      requestRedacted: { license_key: license_key ? '[REDACTED]' : undefined }
    });

    return NextResponse.json({
      success: true,
      message: 'Support request submitted successfully.',
      data: { request_id: requestId }
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Support request error:', error);

    if (client) { client.release(); }

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit support request. Please try again.' }
    }, { status: 500 });
  }
}

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

const SUPPORT_EMAIL = 'support@websmithdigital.com';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const startTime = Date.now();
  let client = null;
  let apiKeyId = '';
  
  try {
    const { requestId } = await params;
    
    const apiKey = request.headers.get('X-API-Key');
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
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

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, `/api/v1/support/${requestId}/reply`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Try again later.' }
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.reset)
        }
      });
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
        error: { code: 'MISSING_MESSAGE', message: 'Message is required' }
      }, { status: 400 });
    }

    if (!customer_name || !customer_email) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_CUSTOMER_INFO', message: 'customer_name and customer_email are required' }
      }, { status: 400 });
    }

    if (!hardware_id) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_HARDWARE_ID', message: 'hardware_id is required' }
      }, { status: 400 });
    }

    client = await pool.connect();
    const now = new Date().toISOString();

    // Verify request exists
    const requestResult = await client.query(
      `SELECT request_id, customer_email, customer_name, product_name, plan_name, license_key, subject, status 
       FROM requests WHERE request_id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      client.release();
      client = null;
      
      return NextResponse.json({
        success: false,
        error: { code: 'REQUEST_NOT_FOUND', message: 'Support request not found' }
      }, { status: 404 });
    }

    const reqData = requestResult.rows[0];

    // Verify customer info matches (optional but recommended)
    // We'll allow reply regardless but log the attempt

    // Store the customer reply in conversation_messages
    const insertResult = await client.query(
      `INSERT INTO conversation_messages (request_id, sender_type, sender_name, sender_email, message, is_internal, created_at)
       VALUES ($1, 'customer', $2, $3, $4, FALSE, $5)
       RETURNING id`,
      [requestId, customer_name, customer_email, message.trim(), now]
    );

    const messageId = insertResult.rows[0].id;

    // Update request updated_at
    await client.query(
      `UPDATE requests SET updated_at = $1 WHERE request_id = $2`,
      [now, requestId]
    );

    // Create audit log for customer reply
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
       VALUES ($1, $2, $3, $4, $5)`,
      ['support_customer_reply', `Customer replied to support request ${requestId}`, now, ipAddress, reqData.license_key || null]
    );

    client.release();
    client = null;

    // Send email notification to support team
    try {
      const emailBody = [
        `Customer Reply to Request: ${requestId}`,
        `Original Subject: ${reqData.subject || 'Support Request'}`,
        ``,
        `From: ${customer_name} <${customer_email}>`,
        `Product: ${reqData.product_name || 'N/A'}`,
        `Plan: ${reqData.plan_name || 'N/A'}`,
        `License: ${reqData.license_key || 'N/A'}`,
        `Hardware: ${hardware_id}`,
        ``,
        `Message:`,
        message,
      ].join('\n');

      const emailResult = await sendEmail(
        pool,
        'admin_notification',
        { email: SUPPORT_EMAIL, name: 'Support' },
        {
          request_id: requestId,
          request_type: 'SUPPORT_REPLY',
          customer_name: customer_name,
          customer_email: customer_email,
          product_name: reqData.product_name || 'N/A',
          plan_name: reqData.plan_name || 'N/A',
          license_key: reqData.license_key || 'N/A',
          subject: `Re: ${reqData.subject || 'Support Request'}`,
          message: emailBody,
        }
      );
      console.log(`[Support Reply] Email notification for ${requestId}: ${emailResult.success ? 'success' : 'failed'}`, emailResult.messageId ? `(messageId: ${emailResult.messageId})` : '');
    } catch (emailError: any) {
      console.error(`[Support Reply] Email notification failed for ${requestId}:`, emailError?.message || emailError);
    }

    await logRequest({
      apiKeyId,
      endpoint: `/api/v1/support/${requestId}/reply`,
      method: 'POST',
      statusCode: 200,
      ipAddress,
      userAgent,
      latencyMs: Date.now() - startTime,
      requestRedacted: { request_id: requestId, customer_email: customer_email }
    });

    return NextResponse.json({
      success: true,
      message: 'Reply submitted successfully',
      data: { message_id: messageId, request_id: requestId }
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Support reply error:', error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' }
    }, { status: 500 });
  }
}
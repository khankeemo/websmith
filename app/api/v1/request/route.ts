import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getDb } from '@/lib/backend-db';
import { sendEmail } from '@/lib/email/mailer';
import { validateApiKey } from '@/lib/public-api/auth';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest } from '@/lib/public-api/audit';

const VALID_TYPES = ['BUY', 'RENEW', 'SUPPORT', 'ACTIVATION', 'DEVICE_REPLACEMENT', 'HARDWARE', 'GENERAL'];

function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'REQ-';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let client = null;

  try {
    const apiKey = request.headers.get('X-API-Key');
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    let apiKeyId = '';
    let productId = '';

    if (apiKey) {
      try {
        const authResult = await validateApiKey(apiKey);
        apiKeyId = authResult.apiKeyId;
        productId = authResult.productId;
      } catch {
        // Anonymous requests allowed - no API key required
      }
    }

    const body = await request.json();
    const {
      request_type,
      customer_email,
      customer_name,
      product_name,
      plan_name,
      license_key,
      hardware_id,
      sdk_version,
      runtime_type,
      subject,
      message,
    } = body;

    if (!request_type || !VALID_TYPES.includes(request_type)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_REQUEST_TYPE', message: `request_type must be one of: ${VALID_TYPES.join(', ')}` }
      }, { status: 400 });
    }

    if (!message || !message.trim()) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_MESSAGE', message: 'message is required' }
      }, { status: 400 });
    }

    const db = await getDb();
    client = await db.connect();

    const requestId = generateRequestId();
    const now = new Date().toISOString();

    // Create the request record
    await client.query(
      `INSERT INTO requests (
        request_id, request_type, status, customer_email, customer_name,
        product_id, product_name, plan_name, license_key, hardware_id,
        sdk_version, runtime_type, subject, message, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [requestId, request_type, 'open', customer_email || null, customer_name || null,
       productId || null, product_name || null, plan_name || null, license_key || null,
       hardware_id || null, sdk_version || null, runtime_type || null,
       subject || `${request_type} Request`, message, now, now]
    );

    client.release();
    client = null;

    // Send email to support
    const supportEmail = process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com';
    const emailData: Record<string, string> = {
      request_id: requestId,
      request_type,
      customer_name: customer_name || 'Anonymous',
      customer_email: customer_email || 'Not provided',
      product_name: product_name || 'N/A',
      plan_name: plan_name || 'N/A',
      license_key: license_key || 'N/A',
      hardware_id: hardware_id || 'N/A',
      sdk_version: sdk_version || 'N/A',
      subject: subject || `${request_type} Request`,
      message: message,
    };

    try {
      const adminEmailResult = await sendEmail(
        db,
        'admin_notification',
        { email: supportEmail, name: 'Support' },
        {
          ...emailData,
          message: `New ${request_type} request from ${customer_name || 'Anonymous'} (${customer_email || 'no email'}):\n\n${message}`,
        }
      );
      if (!adminEmailResult.success) {
        console.error(`[Request] Admin notification email failed for request ${requestId}:`, adminEmailResult.error);
      } else {
        console.log(`[Request] Admin notification email sent for ${requestId}`, adminEmailResult.messageId ? `(messageId: ${adminEmailResult.messageId})` : '');
      }
    } catch (emailError) {
      console.error(`[Request] Admin notification email error for ${requestId}:`, emailError instanceof Error ? emailError.message : emailError);
    }

    if (customer_email) {
      try {
        const customerEmailResult = await sendEmail(
          db,
          'welcome_customer',
          { email: customer_email, name: customer_name || 'Valued Customer' },
          {
            ...emailData,
            customer_name: customer_name || 'Valued Customer',
            product: product_name || 'our product',
            order_number: requestId,
          }
        );
        if (!customerEmailResult.success) {
          console.error(`[Request] Customer confirmation email failed for request ${requestId}:`, customerEmailResult.error);
        } else {
          console.log(`[Request] Customer confirmation email sent for ${requestId}`, customerEmailResult.messageId ? `(messageId: ${customerEmailResult.messageId})` : '');
        }
      } catch (emailError) {
        console.error(`[Request] Customer confirmation email error for ${requestId}:`, emailError instanceof Error ? emailError.message : emailError);
      }
    }

    await logRequest({
      apiKeyId: apiKeyId || 'anonymous',
      endpoint: '/api/v1/request',
      method: 'POST',
      statusCode: 200,
      ipAddress,
      userAgent,
      latencyMs: Date.now() - startTime,
      requestRedacted: { request_type, customer_email: customer_email ? '[REDACTED]' : undefined }
    });

    return NextResponse.json({
      success: true,
      data: {
        request_id: requestId,
        message: 'Your request has been submitted. We will get back to you shortly.',
      }
    });

  } catch (error: any) {
    console.error('Request API error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const requestId = searchParams.get('request_id');
  let getClient = null;

  if (!email && !requestId) {
    return NextResponse.json({
      status: 'ok',
      message: 'Universal Request API v1',
      request_types: VALID_TYPES,
    });
  }

  try {
    const db = await getDb();
    getClient = await db.connect();

    let result;
    if (requestId) {
      result = await getClient.query(
        `SELECT request_id, request_type, status, subject, message, created_at, updated_at
         FROM requests WHERE request_id = $1`,
        [requestId]
      );
    } else {
      result = await getClient.query(
        `SELECT request_id, request_type, status, subject, message, created_at, updated_at
         FROM requests WHERE customer_email = $1 ORDER BY created_at DESC LIMIT 50`,
        [email]
      );
    }

    getClient.release();
    getClient = null;

    return NextResponse.json({
      success: true,
      data: {
        requests: result.rows,
      }
    });
  } catch (error: any) {
    if (getClient) { getClient.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to lookup requests' }
    }, { status: 500 });
  }
}

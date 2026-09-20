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

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/reactivations');
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

    const { license_key, customer_name, customer_email, hardware_id, message } = body;

    if (!license_key) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_LICENSE_KEY', message: 'license_key is required' }
      }, { status: 400 });
    }

    client = await pool.connect();

    const licenseResult = await client.query(
      `SELECT l.license_key, l.product_id, l.customer_name, l.customer_email,
              l.plan, l.status, p.name as product_name
       FROM licenses l
       LEFT JOIN products p ON l.product_id = p.product_id
       WHERE l.license_key = $1`,
      [license_key.toUpperCase()]
    );

    if (licenseResult.rows.length === 0) {
      client.release();
      client = null;

      await logRequest({
        apiKeyId, endpoint: '/api/v1/reactivations', method: 'POST',
        statusCode: 404, ipAddress, userAgent,
        latencyMs: Date.now() - startTime,
        requestRedacted: { license_key: '[REDACTED]' }
      });

      return NextResponse.json({
        success: false,
        error: { code: 'LICENSE_NOT_FOUND', message: 'License key not found' }
      }, { status: 404 });
    }

    const lic = licenseResult.rows[0];

    const now = new Date().toISOString();
    const reqId = `REACT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await client.query(
      `INSERT INTO requests (request_id, request_type, status, customer_email, customer_name,
        product_id, product_name, license_key, hardware_id, subject, message, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [reqId, 'ACTIVATION', 'open', customer_email || lic.customer_email || '',
       customer_name || lic.customer_name || 'N/A',
       lic.product_id, lic.product_name || '',
       license_key.toUpperCase(), hardware_id || '',
       'License Reactivation Request',
       message || `Reactivation request for license ${license_key.toUpperCase()}`, now, now]
    );

    client.release();
    client = null;

    const emailBody = [
      `License Key: ${license_key.toUpperCase()}`,
      `Customer: ${customer_name || lic.customer_name || 'N/A'}`,
      `Email: ${customer_email || lic.customer_email || 'N/A'}`,
      `Plan: ${lic.plan || 'N/A'}`,
      `Status: ${lic.status || 'N/A'}`,
      `Message: ${message || 'N/A'}`,
      `Request ID: ${reqId}`,
    ].join('\n');

    try {
      const emailResult = await sendEmail(
        pool,
        'admin_notification',
        { email: SUPPORT_EMAIL, name: 'Support' },
        {
          request_id: reqId,
          request_type: 'ACTIVATION',
          customer_name: customer_name || lic.customer_name || 'N/A',
          customer_email: customer_email || lic.customer_email || 'N/A',
          product_name: lic.product_name || 'N/A',
          plan_name: lic.plan || 'N/A',
          license_key: license_key.toUpperCase(),
          subject: 'License Reactivation Request',
          message: emailBody,
        }
      );
      if (!emailResult.success) {
        console.error(`[Reactivation] Email delivery failed for request ${reqId}:`, emailResult.error);
      } else {
        console.log(`[Reactivation] Admin notification email sent for ${reqId}`, emailResult.messageId ? `(messageId: ${emailResult.messageId})` : '');
      }
    } catch (emailError) {
      console.error(`[Reactivation] Email send error for request ${reqId}:`, emailError instanceof Error ? emailError.message : emailError);
    }

    await logRequest({
      apiKeyId, endpoint: '/api/v1/reactivations', method: 'POST',
      statusCode: 200, ipAddress, userAgent,
      latencyMs: Date.now() - startTime,
      requestRedacted: { license_key: '[REDACTED]' }
    });

    return NextResponse.json({
      success: true,
      message: 'Reactivation request submitted successfully.',
      request_id: reqId,
      data: {
        license_key: license_key.toUpperCase(),
        support_email: SUPPORT_EMAIL,
      }
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Reactivation request error:', error);

    if (client) { client.release(); }

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit reactivation request. Please try again.' }
    }, { status: 500 });
  }
}

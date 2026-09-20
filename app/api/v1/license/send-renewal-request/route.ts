import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey, validateProductMatch } from '@/lib/public-api/auth';
import { verifySignature } from '@/lib/public-api/signature';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest, logSecurityViolation } from '@/lib/public-api/audit';
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

const SENDER_EMAIL = process.env.MAIL_FROM_ADDRESS || 'no-reply@websmithdigital.com';
const SENDER_NAME = process.env.MAIL_SENDER_NAME || 'Websmith Support';
const SUPPORT_EMAIL = process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let client = null;
  let apiKeyId = '';
  let productId = '';

  try {
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
      productId = authResult.productId;
    } catch (authError: any) {
      await logSecurityViolation('', request.url, 'POST', ipAddress, userAgent, authError);
      return NextResponse.json({
        success: false,
        error: { code: authError.code || 'AUTH_ERROR', message: authError.message || 'Authentication failed' }
      }, { status: 401 });
    }

    const hasHmacHeaders = request.headers.has('X-Timestamp') &&
                           request.headers.has('X-Nonce') &&
                           request.headers.has('X-Signature');

    if (hasHmacHeaders) {
      try {
        await verifySignature(request, apiKey);
      } catch (sigError: any) {
        await logSecurityViolation(apiKeyId, request.url, 'POST', ipAddress, userAgent, sigError);
        return NextResponse.json({
          success: false,
          error: { code: sigError.code || 'SIGNATURE_ERROR', message: sigError.message || 'Signature verification failed' }
        }, { status: 401 });
      }
    }

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/license/send-renewal-request');
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
      license_key,
      customer_name,
      customer_email,
      customer_mobile,
      email,
      mobile,
      message,
      request_type,
      current_plan_id,
      current_plan_name,
      requested_plan_id,
      requested_plan_name,
      current_plan,
      selected_plan,
      selected_plan_id,
      selected_plan_name,
    } = body;

    if (!license_key) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_LICENSE_KEY', message: 'license_key is required' }
      }, { status: 400 });
    }

    if (!request_type || !['renew', 'new'].includes(request_type)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_REQUEST_TYPE', message: 'request_type must be "renew" or "new"' }
      }, { status: 400 });
    }

    const normalizedLicenseKey = license_key.toUpperCase();
    const now = new Date();
    const nowISO = now.toISOString();
    const todayDate = nowISO.split('T')[0];

    const finalEmail = customer_email || email || '';
    const finalMobile = customer_mobile || mobile || '';
    const finalCurrentPlanId = current_plan_id || '';
    const finalCurrentPlanName = current_plan_name || current_plan || '';
    const finalRequestedPlanId = requested_plan_id || selected_plan_id || '';
    const finalRequestedPlanName = requested_plan_name || selected_plan_name || selected_plan || '';

    client = await pool.connect();

    const licenseResult = await client.query(
      `SELECT l.product_id, l.status, l.customer_name, l.customer_email, l.plan, p.name as product_name
       FROM licenses l
       LEFT JOIN products p ON l.product_id = p.product_id
       WHERE l.license_key = $1`,
      [normalizedLicenseKey]
    );

    if (licenseResult.rows.length === 0) {
      client.release();
      client = null;

      await logRequest({
        apiKeyId,
        endpoint: '/api/v1/license/send-renewal-request',
        method: 'POST',
        statusCode: 404,
        ipAddress,
        userAgent,
        latencyMs: Date.now() - startTime,
        requestRedacted: { license_key: '[REDACTED]' }
      });

      return NextResponse.json({
        success: false,
        error: { code: 'LICENSE_NOT_FOUND', message: 'License key not found' }
      }, { status: 404 });
    }

    const lic = licenseResult.rows[0];

    try {
      await validateProductMatch(productId, lic.product_id);
    } catch (productError: any) {
      client.release();
      client = null;

      await logSecurityViolation(apiKeyId, request.url, 'POST', ipAddress, userAgent, productError);

      return NextResponse.json({
        success: false,
        error: { code: productError.code || 'PRODUCT_MISMATCH', message: productError.message || 'Product mismatch' }
      }, { status: 403 });
    }

    const reqTypeLabel = request_type === 'renew' ? 'Renew' : 'New';
    const customerName = customer_name || lic.customer_name || 'N/A';

    const dbResult = await client.query(
      `INSERT INTO renewal_requests
       (license_key, product_id, product_name, customer_name, customer_email, customer_mobile,
        current_plan_id, current_plan_name, selected_plan_id, selected_plan_name,
        request_type, message, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, $13)
       RETURNING id`,
      [
        normalizedLicenseKey,
        lic.product_id,
        lic.product_name || '',
        customerName,
        finalEmail,
        finalMobile,
        finalCurrentPlanId,
        finalCurrentPlanName || lic.plan || '',
        finalRequestedPlanId,
        finalRequestedPlanName || '',
        request_type,
        message || '',
        nowISO,
      ]
    );

    const requestId = dbResult.rows[0].id;

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'license_renewal_request',
        `Renewal request #${requestId} submitted: ${reqTypeLabel} — ${customerName} (${finalEmail}) | Current: ${finalCurrentPlanName || 'N/A'} -> Requested: ${finalRequestedPlanName || 'N/A'}`,
        nowISO,
        ipAddress,
        normalizedLicenseKey,
        ''
      ]
    );

    client.release();
    client = null;

    const emailSubject = `[Renewal Request] ${lic.product_name || 'Product'} - ${customerName}`;
    const emailBody = `
License Key:
${normalizedLicenseKey}

Customer:
${customerName}

Email:
${finalEmail}

Current Plan:
${finalCurrentPlanName || 'N/A'}

Requested Plan:
${finalRequestedPlanName || 'N/A'}

Request Type:
${reqTypeLabel}

Message:
${message || 'N/A'}

Created:
${todayDate}
    `.trim();

    let emailSent = false;
    try {
      const emailDbClient = await pool.connect();
      try {
        const emailResult = await sendEmail(emailDbClient, 'admin_notification', {
          email: SUPPORT_EMAIL,
          name: 'Support Team',
        }, {
          request_type: reqTypeLabel,
          customer_name: customerName || 'N/A',
          customer_email: finalEmail || 'N/A',
          product_name: lic.product_name || 'N/A',
          plan_name: finalCurrentPlanName || 'N/A',
          license_key: normalizedLicenseKey,
          hardware_id: body.hardware_id || 'N/A',
          message: message || 'N/A',
          requested_plan: finalRequestedPlanName || 'N/A',
          company_name: process.env.BRANDING_COMPANY_NAME || 'Websmith Digital',
          support_email: SUPPORT_EMAIL,
          website: process.env.BRANDING_WEBSITE_URL || 'https://websmithdigital.com',
        });
        emailSent = emailResult.success;
      } finally {
        emailDbClient.release();
      }
    } catch (emailError) {
      console.error('Email send error:', emailError);
    }

    await logRequest({
      apiKeyId,
      endpoint: '/api/v1/license/send-renewal-request',
      method: 'POST',
      statusCode: 200,
      ipAddress,
      userAgent,
      latencyMs: Date.now() - startTime,
      requestRedacted: { license_key: '[REDACTED]', email: '[REDACTED]' }
    });

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'Renewal request submitted successfully.'
        : 'Renewal request submitted. Email service is currently unavailable — support will follow up.',
      request_id: `REQ-${String(requestId).padStart(5, '0')}`,
      data: {
        license_key: normalizedLicenseKey,
        request_type,
        current_plan: finalCurrentPlanName,
        requested_plan: finalRequestedPlanName,
        email_sent: emailSent,
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
    console.error('Send renewal request error:', error);

    if (client) {
      client.release();
    }

    await logRequest({
      apiKeyId: apiKeyId || 'unknown',
      endpoint: '/api/v1/license/send-renewal-request',
      method: 'POST',
      statusCode: 500,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      latencyMs: Date.now() - startTime,
      requestRedacted: { error: error.message }
    });

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit renewal request. Please try again.' }
    }, { status: 500 });
  }
}

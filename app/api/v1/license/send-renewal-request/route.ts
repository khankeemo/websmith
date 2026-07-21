// ============================================================
// FILE: app/api/v1/license/send-renewal-request/route.ts
// PURPOSE: Customer-facing renewal request — validates, emails support, audits
// DATABASE: licenses, audit_logs
// SECURITY: API Key + HMAC + Rate Limit + Audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey, validateProductMatch } from '@/lib/public-api/auth';
import { verifySignature } from '@/lib/public-api/signature';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest, logSecurityViolation } from '@/lib/public-api/audit';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'support@websmithdigital.com';
const SENDER_NAME = 'Websmith Digital';
const SUPPORT_EMAIL = 'support@websmithdigital.com';

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
      email,
      mobile,
      subject,
      message,
      request_type,
      current_plan,
      selected_plan,
      product_id,
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

    client = await pool.connect();

    // Verify license exists and product matches
    const licenseResult = await client.query(
      `SELECT product_id, status, customer_name, customer_email
       FROM licenses WHERE license_key = $1`,
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

    // Product isolation
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

    // Build email content
    const reqTypeLabel = request_type === 'renew' ? 'Renew Existing License' : 'Request New License';
    const emailSubject = subject || 'License Renewal Request';
    const emailBody = `
Renewal Request Received
========================

Request Type: ${reqTypeLabel}
License Key: ${normalizedLicenseKey}
Customer Name: ${customer_name || 'N/A'}
Customer Email: ${email || 'N/A'}
Customer Mobile: ${mobile || 'N/A'}
Current Plan: ${current_plan || 'N/A'}
Requested Plan: ${selected_plan || (current_plan || 'N/A')}
Product ID: ${product_id || 'N/A'}

Message:
${message || 'No additional details provided.'}

---
Submitted: ${nowISO}
IP Address: ${ipAddress}
Source: SDK Renewal Dialog
    `.trim();

    // Send email to support
    let emailSent = false;
    if (BREVO_API_KEY) {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: SUPPORT_EMAIL, name: 'Websmith Support' }],
            subject: emailSubject,
            textContent: emailBody,
            htmlContent: `<pre style="font-family: monospace; white-space: pre-wrap;">${emailBody}</pre>`,
          }),
        });

        emailSent = response.ok;
        if (!response.ok) {
          const errText = await response.text();
          console.error(`Brevo send failed [renewal_request -> ${SUPPORT_EMAIL}]: ${errText}`);
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'license_renewal_request',
        `Renewal request submitted: ${reqTypeLabel} — ${customer_name || 'N/A'} (${email || 'N/A'}) | Current: ${current_plan || 'N/A'} -> Requested: ${selected_plan || (current_plan || 'N/A')}`,
        nowISO,
        ipAddress,
        normalizedLicenseKey,
        ''
      ]
    );

    client.release();
    client = null;

    // Log success
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
        ? 'Your renewal request has been sent to Websmith Digital.'
        : 'Your renewal request has been logged. Email service is currently unavailable — support will follow up.',
      data: {
        license_key: normalizedLicenseKey,
        request_type,
        current_plan: current_plan || '',
        selected_plan: selected_plan || current_plan || '',
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

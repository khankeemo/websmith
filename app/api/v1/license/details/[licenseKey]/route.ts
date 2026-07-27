// ============================================================
// FILE: app/api/v1/license/details/[licenseKey]/route.ts
// PURPOSE: GET license details by license key (for renewal dialog)
// DATABASE: licenses, customers, plans, products, activations
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ licenseKey: string }> }
) {
  const startTime = Date.now();
  let client = null;
  let apiKeyId = '';
  let productId = '';

  try {
    const { licenseKey } = await params;

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
      await logSecurityViolation('', request.url, 'GET', ipAddress, userAgent, authError);
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
        await logSecurityViolation(apiKeyId, request.url, 'GET', ipAddress, userAgent, sigError);
        return NextResponse.json({
          success: false,
          error: { code: sigError.code || 'SIGNATURE_ERROR', message: sigError.message || 'Signature verification failed' }
        }, { status: 401 });
      }
    }

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/license/details');
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Try again later.' }
      }, { status: 429 });
    }

    if (!licenseKey) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_LICENSE_KEY', message: 'License key is required' }
      }, { status: 400 });
    }

    const normalizedLicenseKey = licenseKey.toUpperCase();
    const now = new Date();

    client = await pool.connect();

    const licenseResult = await client.query(
      `SELECT
        l.license_key,
        l.customer_name,
        l.customer_email,
        l.customer_phone,
        l.customer_mobile,
        l.plan,
        l.plan_id,
        l.status,
        l.expiry_date,
        l.max_devices,
        l.device_count,
        l.product_id,
        l.is_trial,
        l.inactive_reason,
        l.deleted_at,
        l.created_at,
        l.last_validated,
        p.name as product_name,
        p.is_active as product_is_active,
        p.is_deleted as product_is_deleted
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
        endpoint: '/api/v1/license/details',
        method: 'GET',
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

    // Do not return details for deleted licenses
    if (lic.deleted_at) {
      client.release();
      client = null;

      await logRequest({
        apiKeyId,
        endpoint: '/api/v1/license/details',
        method: 'GET',
        statusCode: 404,
        ipAddress,
        userAgent,
        latencyMs: Date.now() - startTime,
        requestRedacted: { license_key: '[REDACTED]' }
      });

      return NextResponse.json({
        success: false,
        error: { code: 'LICENSE_DELETED', message: 'License has been deleted' }
      }, { status: 404 });
    }

    // Product isolation
    try {
      await validateProductMatch(productId, lic.product_id);
    } catch (productError: any) {
      client.release();
      client = null;

      await logSecurityViolation(apiKeyId, request.url, 'GET', ipAddress, userAgent, productError);

      return NextResponse.json({
        success: false,
        error: { code: productError.code || 'PRODUCT_MISMATCH', message: productError.message || 'Product mismatch' }
      }, { status: 403 });
    }

    // Get device count
    const deviceCountResult = await client.query(
      `SELECT COUNT(*) as count FROM activations WHERE license_key = $1 AND is_active = true`,
      [normalizedLicenseKey]
    );
    const activeDevices = parseInt(deviceCountResult.rows[0]?.count || '0');

    // Compute days left
    const expiryDate = lic.expiry_date ? new Date(lic.expiry_date) : null;
    const nowTime = now.getTime();
    const daysLeft = expiryDate
      ? Math.max(0, Math.ceil((expiryDate.getTime() - nowTime) / (1000 * 60 * 60 * 24)))
      : 0;

    client.release();
    client = null;

    // Log success
    await logRequest({
      apiKeyId,
      endpoint: '/api/v1/license/details',
      method: 'GET',
      statusCode: 200,
      ipAddress,
      userAgent,
      latencyMs: Date.now() - startTime,
      requestRedacted: { license_key: '[REDACTED]' }
    });

    return NextResponse.json({
      success: true,
      data: {
        license_key: lic.license_key,
        customer_name: lic.customer_name || '',
        email: lic.customer_email || '',
        mobile: lic.customer_mobile || lic.customer_phone || '',
        plan: lic.plan || '',
        status: lic.status || '',
        expiry_date: lic.expiry_date ? lic.expiry_date.split('T')[0] : '',
        days_left: daysLeft,
        max_devices: lic.max_devices || 0,
        device_count: lic.device_count || 0,
        active_devices: activeDevices,
        is_trial: lic.is_trial || false,
        product_name: lic.product_name || '',
        created_at: lic.created_at?.toISOString() || '',
        last_validated: lic.last_validated?.toISOString() || '',
      }
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('License details error:', error);

    if (client) {
      client.release();
    }

    await logRequest({
      apiKeyId: apiKeyId || 'unknown',
      endpoint: '/api/v1/license/details',
      method: 'GET',
      statusCode: 500,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      latencyMs: Date.now() - startTime,
      requestRedacted: { error: error.message }
    });

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch license details.' }
    }, { status: 500 });
  }
}

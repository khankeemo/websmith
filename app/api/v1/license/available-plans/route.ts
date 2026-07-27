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

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/license/available-plans');
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

    const { license_key } = body;

    if (!license_key) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_LICENSE_KEY', message: 'license_key is required' }
      }, { status: 400 });
    }

    const normalizedLicenseKey = license_key.toUpperCase();

    client = await pool.connect();

    const licenseResult = await client.query(
      `SELECT
        l.license_key,
        l.product_id,
        l.plan,
        l.plan_id,
        l.status,
        l.deleted_at,
        p.name as product_name
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
        endpoint: '/api/v1/license/available-plans',
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
        error: { code: 'PRODUCT_MISMATCH', message: productError.message || 'Product mismatch' }
      }, { status: 403 });
    }

    // Do not return plans for deleted licenses
    if (lic.deleted_at) {
      client.release();
      client = null;

      return NextResponse.json({
        success: false,
        error: { code: 'LICENSE_DELETED', message: 'License has been deleted' }
      }, { status: 404 });
    }

    const plansResult = await client.query(
      `SELECT id, name, default_expiry_days, max_devices, price
       FROM plans
       WHERE product_id = $1 AND is_active = TRUE AND is_trial_plan = FALSE
       ORDER BY name ASC`,
      [lic.product_id]
    );

    const plans = plansResult.rows.map((p: any) => ({
      id: p.id,
      name: p.name || '',
      duration_days: p.default_expiry_days || 365,
      max_devices: p.max_devices || 1,
      price: p.price || 0,
    }));

    client.release();
    client = null;

    await logRequest({
      apiKeyId,
      endpoint: '/api/v1/license/available-plans',
      method: 'POST',
      statusCode: 200,
      ipAddress,
      userAgent,
      latencyMs: Date.now() - startTime,
      requestRedacted: { license_key: '[REDACTED]' }
    });

    return NextResponse.json({
      success: true,
      product: {
        id: lic.product_id,
        name: lic.product_name || '',
      },
      current_plan: {
        id: lic.plan_id || '',
        name: lic.plan || '',
      },
      plans,
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Available plans error:', error);

    if (client) {
      client.release();
    }

    await logRequest({
      apiKeyId: apiKeyId || 'unknown',
      endpoint: '/api/v1/license/available-plans',
      method: 'POST',
      statusCode: 500,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      latencyMs: Date.now() - startTime,
      requestRedacted: { error: error.message }
    });

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch available plans. Please try again.' }
    }, { status: 500 });
  }
}

// ============================================================
// FILE: app/api/v1/license/verify-renewal/route.ts
// PURPOSE: Verify a license key for renewal eligibility
// DATABASE: licenses, customers, plans, products
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

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/license/verify-renewal');
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
        l.product_id,
        l.is_trial,
        l.inactive_reason,
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
        endpoint: '/api/v1/license/verify-renewal',
        method: 'POST',
        statusCode: 404,
        ipAddress,
        userAgent,
        latencyMs: Date.now() - startTime,
        requestRedacted: { license_key: '[REDACTED]' }
      });

      return NextResponse.json({
        success: false,
        valid: false,
        message: 'License key not found'
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
        valid: false,
        message: productError.message || 'Product mismatch'
      }, { status: 403 });
    }

    // Check product active
    if (!lic.product_is_active || lic.product_is_active === null) {
      client.release();
      client = null;

      return NextResponse.json({
        success: false,
        valid: false,
        message: 'Product is currently inactive'
      }, { status: 403 });
    }

    // Check product deleted
    if (lic.product_is_deleted) {
      client.release();
      client = null;

      return NextResponse.json({
        success: false,
        valid: false,
        message: 'Product has been deleted'
      }, { status: 403 });
    }

    // Compute expiry
    const expiryDate = lic.expiry_date ? new Date(lic.expiry_date) : null;
    const nowTime = now.getTime();
    const isExpired = expiryDate ? expiryDate.getTime() < nowTime : false;
    const daysLeft = expiryDate
      ? Math.max(0, Math.ceil((expiryDate.getTime() - nowTime) / (1000 * 60 * 60 * 24)))
      : 0;

    // Valid for renewal = exists (any status except revoked can request renewal info)
    const valid = lic.status !== 'revoked';

    // Fetch available plans for this product
    let availablePlans: Array<{id: string; name: string; duration: string; is_current_plan: boolean}> = [];
    try {
      const plansResult = await client.query(
        `SELECT id, name, default_expiry_days
         FROM plans
         WHERE product_id = $1 AND is_active = TRUE AND is_trial_plan = FALSE
         ORDER BY name ASC`,
        [lic.product_id]
      );
      const currentPlanId = lic.plan_id ? Number(lic.plan_id) : null;
      availablePlans = plansResult.rows.map((p: any) => ({
        id: String(p.id),
        name: p.name || '',
        duration: p.default_expiry_days
          ? `${p.default_expiry_days} Days`
          : 'Lifetime',
        is_current_plan: currentPlanId !== null && Number(p.id) === currentPlanId,
      }));
    } catch (e) {
      // Non-fatal: available plans won't be included
      console.warn('Failed to fetch available plans for renewal:', e);
    }

    client.release();
    client = null;

    // Log success
    await logRequest({
      apiKeyId,
      endpoint: '/api/v1/license/verify-renewal',
      method: 'POST',
      statusCode: 200,
      ipAddress,
      userAgent,
      latencyMs: Date.now() - startTime,
      requestRedacted: { license_key: '[REDACTED]' }
    });

    return NextResponse.json({
      success: true,
      valid,
      message: valid
        ? (isExpired ? 'License is expired but eligible for renewal' : 'License verified for renewal')
        : 'License has been revoked and cannot be renewed',
      customer_name: lic.customer_name || '',
      email: lic.customer_email || '',
      mobile: lic.customer_mobile || lic.customer_phone || '',
      plan: lic.plan || '',
      plan_id: lic.plan_id || '',
      status: lic.status || '',
      expiry_date: lic.expiry_date ? lic.expiry_date.split('T')[0] : '',
      days_left: daysLeft,
      is_expired: isExpired,
      is_trial: lic.is_trial || false,
      license_key: lic.license_key,
      product_id: lic.product_id || '',
      product_name: lic.product_name || '',
      available_plans: availablePlans,
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Verify renewal error:', error);

    if (client) {
      client.release();
    }

    await logRequest({
      apiKeyId: apiKeyId || 'unknown',
      endpoint: '/api/v1/license/verify-renewal',
      method: 'POST',
      statusCode: 500,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      latencyMs: Date.now() - startTime,
      requestRedacted: { error: error.message }
    });

    return NextResponse.json({
      success: false,
      valid: false,
      error: { code: 'INTERNAL_ERROR', message: 'Verification failed. Please try again.' }
    }, { status: 500 });
  }
}

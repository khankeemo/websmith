// ============================================================
// FILE: app/api/v1/license/verify-renewal/route.ts
// PURPOSE: Verify a license key for renewal eligibility.
// DATABASE: Neon PostgreSQL only (via shared Global License Status service)
// SECURITY: API Key + HMAC + Rate Limit + Audit
//
// NOTE: Business decisions live ONLY in the shared service
// (resolveGlobalLicenseStatus). This route is a thin proxy:
// it fetches available plans for display, but eligibility status
// comes from the service — no independent license-state logic.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey, validateProductMatch } from '@/lib/public-api/auth';
import { verifySignature } from '@/lib/public-api/signature';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest, logSecurityViolation } from '@/lib/public-api/audit';
import { resolveGlobalLicenseStatus } from '@/lib/license/serializer';

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

    // Delegate ALL status derivation to the shared service.
    const { verdict, ctx, daysLeft, expiredAt } = await resolveGlobalLicenseStatus(pool, {
      licenseKey: normalizedLicenseKey,
    });

    const lic = ctx?.license || null;

    // Product isolation
    if (lic && productId) {
      try {
        await validateProductMatch(productId, lic.product_id);
      } catch (productError: any) {
        await logSecurityViolation(apiKeyId, request.url, 'POST', ipAddress, userAgent, productError);
        return NextResponse.json({
          success: false,
          valid: false,
          status: verdict.status,
          code: verdict.code,
          error: { code: productError.code || 'PRODUCT_MISMATCH', message: productError.message || 'Product mismatch' },
          message: productError.message || 'Product mismatch',
        }, { status: 403 });
      }
    }

    // Renewal eligibility = ACTIVE or EXPIRED (renewable). Everything else
    // (revoked/inactive/no_customer) is non-renewable.
    const eligible = verdict.status === 'ACTIVE' || verdict.status === 'EXPIRED';

    // Fetch available plans for the product (display only).
    let availablePlans: Array<{id: string; name: string; duration: string; is_current_plan: boolean}> = [];
    if (eligible && lic?.product_id) {
      try {
        const client = await pool.connect();
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
        } finally {
          client.release();
        }
      } catch (e) {
        console.warn('Failed to fetch available plans for renewal:', e);
      }
    }

    // Log
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

    const expiredAtDate = expiredAt ? new Date(expiredAt).getTime() : null;
    const isExpired = expiredAtDate !== null && expiredAtDate < Date.now();

    return NextResponse.json({
      success: true,
      valid: eligible,
      status: verdict.status,
      code: verdict.code,
      message: eligible
        ? (verdict.status === 'EXPIRED' ? 'License is expired but eligible for renewal' : 'License verified for renewal')
        : verdict.message,
      actions: verdict.actions,
      customer_name: lic?.customer_name || '',
      email: lic?.customer_email || '',
      mobile: lic?.customer_mobile || lic?.customer_phone || '',
      plan: lic?.plan || '',
      plan_id: lic?.plan_id || '',
      expiry_date: lic?.expiry_date ? new Date(lic.expiry_date).toISOString().split('T')[0] : '',
      days_left: daysLeft,
      is_expired: isExpired,
      is_trial: lic?.is_trial || false,
      license_key: lic?.license_key || normalizedLicenseKey,
      product_id: lic?.product_id || '',
      product_name: lic?.product_name || '',
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
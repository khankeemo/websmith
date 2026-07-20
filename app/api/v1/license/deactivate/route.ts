// ============================================================
// FILE: app/api/v1/license/deactivate/route.ts
// PURPOSE: Customer-facing device deactivation (laptop replacement, migration)
// SECURITY: API Key + HMAC — NO admin required
// FLOW    : Customer SDK → /api/v1/license/deactivate → deactivate device
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

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/license/deactivate');
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

    const { license_key, hardware_id } = body;

    if (!license_key) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_LICENSE_KEY', message: 'License key is required' }
      }, { status: 400 });
    }

    if (!hardware_id) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_HARDWARE_ID', message: 'hardware_id is required for deactivation' }
      }, { status: 400 });
    }

    const normalizedLicenseKey = license_key.toUpperCase();
    const now = new Date();
    const nowISO = now.toISOString();

    client = await pool.connect();

    const licenseResult = await client.query(
      `SELECT product_id, status, customer_name, customer_email
       FROM licenses WHERE license_key = $1`,
      [normalizedLicenseKey]
    );

    if (licenseResult.rows.length === 0) {
      client.release();
      client = null;
      await logRequest({ apiKeyId, endpoint: '/api/v1/license/deactivate', method: 'POST', statusCode: 404, ipAddress, userAgent, latencyMs: Date.now() - startTime, requestRedacted: { license_key: '[REDACTED]' } });
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

    if (lic.status === 'inactive') {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'LICENSE_INACTIVE', message: 'License is already inactive' }
      }, { status: 409 });
    }

    if (lic.status === 'revoked') {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'LICENSE_REVOKED', message: 'License has been revoked' }
      }, { status: 403 });
    }

    if (lic.status === 'expired') {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'LICENSE_EXPIRED', message: 'License has expired' }
      }, { status: 403 });
    }

    const deactResult = await client.query(
      `UPDATE activations
       SET is_active = false, last_seen = $1
       WHERE license_key = $2 AND hardware_id = $3 AND is_active = true`,
      [nowISO, normalizedLicenseKey, hardware_id]
    );

    if (deactResult.rowCount === 0) {
      client.release();
      client = null;
      await logRequest({ apiKeyId, endpoint: '/api/v1/license/deactivate', method: 'POST', statusCode: 404, ipAddress, userAgent, latencyMs: Date.now() - startTime, requestRedacted: { license_key: '[REDACTED]', hardware_id: '[REDACTED]' } });
      return NextResponse.json({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found or already deactivated' }
      }, { status: 404 });
    }

    await client.query(
      `UPDATE licenses
       SET device_count = GREATEST(device_count - 1, 0),
           updated_at = $1
       WHERE license_key = $2`,
      [nowISO, normalizedLicenseKey]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['device_deactivated', `Device ${hardware_id} deactivated from license ${normalizedLicenseKey} by customer`, nowISO, ipAddress, normalizedLicenseKey, hardware_id]
    );

    client.release();
    client = null;

    await logRequest({ apiKeyId, endpoint: '/api/v1/license/deactivate', method: 'POST', statusCode: 200, ipAddress, userAgent, latencyMs: Date.now() - startTime, requestRedacted: { license_key: '[REDACTED]', hardware_id: '[REDACTED]' } });

    return NextResponse.json({
      success: true,
      data: {
        message: 'License deactivated successfully. You may now activate this license on another device.',
        license_key: normalizedLicenseKey,
        hardware_id: hardware_id,
        status: 'inactive'
      }
    });

  } catch (error: any) {
    console.error('License deactivation error:', error);

    if (client) {
      client.release();
    }

    await logRequest({
      apiKeyId: apiKeyId || 'unknown',
      endpoint: '/api/v1/license/deactivate',
      method: 'POST',
      statusCode: 500,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      latencyMs: Date.now() - startTime,
      requestRedacted: { error: error.message }
    });

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Deactivation failed. Please try again.' }
    }, { status: 500 });
  }
}

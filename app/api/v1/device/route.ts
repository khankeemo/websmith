// ============================================================
// FILE: app/api/v1/device/route.ts
// PURPOSE: Public Device API - bind, reset, replace
// DATABASE: activations, licenses
// SECURITY: API Key + HMAC + Rate Limit + Audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey, validateProductMatch } from '@/lib/public-api/auth';
import { verifySignature } from '@/lib/public-api/signature';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest, logSecurityViolation } from '@/lib/public-api/audit';
import { validateHardwareId, validateDeviceActivation } from '@/core/utils/validation-system';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ============================================================
// POST /api/v1/device
// ============================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let client = null;
  let apiKeyId = '';
  let productId = '';
  
  try {
    // ============================================================
    // 1. EXTRACT HEADERS
    // ============================================================
    
    const apiKey = request.headers.get('X-API-Key');
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: 'X-API-Key header is required'
        }
      }, { status: 401 });
    }

    // ============================================================
    // 2. VALIDATE API KEY
    // ============================================================
    
    let authResult;
    try {
      authResult = await validateApiKey(apiKey);
      apiKeyId = authResult.apiKeyId;
      productId = authResult.productId;
    } catch (authError: any) {
      await logSecurityViolation('', request.url, 'POST', ipAddress, userAgent, authError);
      return NextResponse.json({
        success: false,
        error: {
          code: authError.code || 'AUTH_ERROR',
          message: authError.message || 'Authentication failed'
        }
      }, { status: 401 });
    }

    // ============================================================
    // 3. VERIFY SIGNATURE (optional — generated clients may not sign)
    // ============================================================
    
    const hasHmacHeaders = request.headers.has('X-Timestamp') &&
                           request.headers.has('X-Nonce') &&
                           request.headers.has('X-Signature');

    if (hasHmacHeaders) {
      try {
        // HMAC uses API key as shared secret — matches SDK signing key
        await verifySignature(request, apiKey);
      } catch (sigError: any) {
        await logSecurityViolation(apiKeyId, request.url, 'POST', ipAddress, userAgent, sigError);
        return NextResponse.json({
          success: false,
          error: {
            code: sigError.code || 'SIGNATURE_ERROR',
            message: sigError.message || 'Signature verification failed'
          }
        }, { status: 401 });
      }
    }

    // ============================================================
    // 4. RATE LIMIT CHECK
    // ============================================================
    
    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/device');
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Try again later.'
        }
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.reset)
        }
      });
    }

    // ============================================================
    // 5. PARSE REQUEST BODY
    // ============================================================
    
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid JSON body'
        }
      }, { status: 400 });
    }

    const { action, license_key, hardware_id, device_name, old_hardware_id, new_hardware_id } = body;

    if (!action) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_ACTION',
          message: 'action is required (bind, reset)'
        }
      }, { status: 400 });
    }

    if (!license_key) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_LICENSE_KEY',
          message: 'license_key is required'
        }
      }, { status: 400 });
    }

    // ============================================================
    // 6. PROCESS ACTION
    // ============================================================
    
    const normalizedLicenseKey = license_key.toUpperCase();
    const now = new Date();
    const nowISO = now.toISOString();
    
    client = await pool.connect();

    switch (action) {
      case 'bind':
        // ============================================================
        // 6a. BIND DEVICE
        // ============================================================
        
        if (!hardware_id) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'MISSING_HARDWARE_ID',
              message: 'hardware_id is required for binding'
            }
          }, { status: 400 });
        }

        const hwValidation = validateHardwareId(hardware_id);
        if (!hwValidation.valid) {
          client.release();
          client = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'INVALID_HARDWARE_ID',
              message: hwValidation.errors[0].message
            }
          }, { status: 400 });
        }

        // Verify license exists and product matches
        const bindLicense = await client.query(
          `SELECT license_key, max_devices, status, product_id 
           FROM licenses WHERE license_key = $1`,
          [normalizedLicenseKey]
        );

        if (bindLicense.rows.length === 0) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_NOT_FOUND',
              message: 'License key not found'
            }
          }, { status: 404 });
        }

        const licData = bindLicense.rows[0];

        try {
          await validateProductMatch(productId, licData.product_id);
        } catch (productError: any) {
          client.release();
          client = null;
          
          await logSecurityViolation(apiKeyId, request.url, 'POST', ipAddress, userAgent, productError);
          
          return NextResponse.json({
            success: false,
            error: {
              code: productError.code || 'PRODUCT_MISMATCH',
              message: productError.message || 'Product mismatch'
            }
          }, { status: 403 });
        }

        if (licData.status === 'expired' || licData.status === 'revoked') {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_INACTIVE',
              message: `License is ${licData.status}`
            }
          }, { status: 403 });
        }

        // Check if already bound
        const existingBind = await client.query(
          `SELECT id FROM activations WHERE license_key = $1 AND hardware_id = $2 AND is_active = true`,
          [normalizedLicenseKey, hardware_id]
        );

        if (existingBind.rows.length > 0) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: true,
            data: {
              message: 'Device already bound to this license',
              already_bound: true
            }
          });
        }

        // Check device limit
        const currentBinds = await client.query(
          `SELECT COUNT(*) as count FROM activations WHERE license_key = $1 AND is_active = true`,
          [normalizedLicenseKey]
        );
        const bindCount = parseInt(currentBinds.rows[0]?.count || '0');

        if (bindCount >= licData.max_devices) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'MAX_DEVICES_EXCEEDED',
              message: `Device limit reached (${licData.max_devices} devices max)`
            }
          }, { status: 403 });
        }

        // Create binding
        await client.query(
          `INSERT INTO activations (
            license_key,
            hardware_id,
            device_name,
            ip_address,
            activated_at,
            last_seen,
            is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [normalizedLicenseKey, hardware_id, device_name || 'Unknown Device', ipAddress, nowISO, nowISO]
        );

        // Update license
        await client.query(
          `UPDATE licenses 
           SET device_count = device_count + 1,
                status = 'active',
                inactive_reason = NULL,
               updated_at = $1
           WHERE license_key = $2`,
          [nowISO, normalizedLicenseKey]
        );

        // Audit log device bind
        await client.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
           VALUES ($1, $2, $3, $4, $5)`,
          ['device_bound', `Device ${hardware_id} bound to license ${normalizedLicenseKey}`, nowISO, ipAddress, normalizedLicenseKey]
        );

        client.release();
        client = null;

        await logRequest({
          apiKeyId,
          endpoint: '/api/v1/device',
          method: 'POST',
          statusCode: 200,
          ipAddress,
          userAgent,
          latencyMs: Date.now() - startTime,
          requestRedacted: { action, license_key: '[REDACTED]', hardware_id: '[REDACTED]' }
        });

        return NextResponse.json({
          success: true,
          data: {
            message: 'Device bound successfully',
            license_key: normalizedLicenseKey,
            hardware_id: hardware_id,
            current_devices: bindCount + 1,
            max_devices: licData.max_devices,
            bound_at: nowISO
          }
        }, {
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset)
          }
        });

      case 'reset':
        // ============================================================
        // 6b. RESET DEVICE
        // ============================================================
        
        if (!hardware_id) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'MISSING_HARDWARE_ID',
              message: 'hardware_id is required for reset'
            }
          }, { status: 400 });
        }

        const resetHwValidation = validateHardwareId(hardware_id);
        if (!resetHwValidation.valid) {
          client.release();
          client = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'INVALID_HARDWARE_ID',
              message: resetHwValidation.errors[0].message
            }
          }, { status: 400 });
        }

        // Verify license exists and product matches
        const resetLicense = await client.query(
          `SELECT product_id FROM licenses WHERE license_key = $1`,
          [normalizedLicenseKey]
        );

        if (resetLicense.rows.length === 0) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_NOT_FOUND',
              message: 'License key not found'
            }
          }, { status: 404 });
        }

        try {
          await validateProductMatch(productId, resetLicense.rows[0].product_id);
        } catch (productError: any) {
          client.release();
          client = null;
          
          await logSecurityViolation(apiKeyId, request.url, 'POST', ipAddress, userAgent, productError);
          
          return NextResponse.json({
            success: false,
            error: {
              code: productError.code || 'PRODUCT_MISMATCH',
              message: productError.message || 'Product mismatch'
            }
          }, { status: 403 });
        }

        // Deactivate device
        const resetResult = await client.query(
          `UPDATE activations 
           SET is_active = false, last_seen = $1
           WHERE license_key = $2 AND hardware_id = $3 AND is_active = true`,
          [nowISO, normalizedLicenseKey, hardware_id]
        );

        if (resetResult.rowCount === 0) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'DEVICE_NOT_FOUND',
              message: 'Device not found or already reset'
            }
          }, { status: 404 });
        }

        // Update device count
        await client.query(
          `UPDATE licenses 
           SET device_count = GREATEST(device_count - 1, 0),
               updated_at = $1
           WHERE license_key = $2`,
          [nowISO, normalizedLicenseKey]
        );

        // Audit log device reset (parity with the device_bound audit write)
        await client.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
           VALUES ($1, $2, $3, $4, $5)`,
          ['device_reset', `Device ${hardware_id} reset from license ${normalizedLicenseKey}`, nowISO, ipAddress, normalizedLicenseKey]
        );

        client.release();
        client = null;

        await logRequest({
          apiKeyId,
          endpoint: '/api/v1/device',
          method: 'POST',
          statusCode: 200,
          ipAddress,
          userAgent,
          latencyMs: Date.now() - startTime,
          requestRedacted: { action, license_key: '[REDACTED]', hardware_id: '[REDACTED]' }
        });

        return NextResponse.json({
          success: true,
          data: {
            message: 'Device reset successfully',
            license_key: normalizedLicenseKey,
            hardware_id: hardware_id,
            reset_at: nowISO
          }
        }, {
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset)
          }
        });

      default:
        client.release();
        client = null;
        
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: `Invalid action: ${action}. Supported: bind, reset`
          }
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Device API error:', error);
    
    if (client) {
      client.release();
    }
    
    await logRequest({
      apiKeyId: apiKeyId || 'unknown',
      endpoint: '/api/v1/device',
      method: 'POST',
      statusCode: 500,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      latencyMs: Date.now() - startTime,
      requestRedacted: { error: error.message }
    });

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred'
      }
    }, { status: 500 });
  }
}

// ============================================================
// GET /api/v1/device
// ============================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Public Device API v1',
    actions: ['bind', 'reset'],
    documentation: '/internal/api/docs/public-api'
  });
}
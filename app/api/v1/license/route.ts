// ============================================================
// FILE: app/api/v1/license/route.ts
// PURPOSE: Public License API - validate, activate, deactivate
// DATABASE: licenses, activations, plans, products
// SECURITY: API Key + HMAC + Rate Limit + Audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey, validateProductMatch } from '@/lib/public-api/auth';
import { verifySignature } from '@/lib/public-api/signature';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest, logSecurityViolation, redactSensitiveData } from '@/lib/public-api/audit';
import { buildLicenseResponse, resolveGlobalLicenseStatus } from '@/lib/license/serializer';

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
// POST /api/v1/license
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
    
    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/license');
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

    const { action, license_key, hardware_id, device_name, extra_days } = body;

    if (!action) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_ACTION',
          message: 'action is required (validate, activate, deactivate)'
        }
      }, { status: 400 });
    }

    // hardware_id-only validation is allowed for validate action (existing customer lookup)
    if (!license_key && !(action === 'validate' && hardware_id)) {
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
    
    const normalizedLicenseKey = license_key ? license_key.toUpperCase() : '';
    const now = new Date();
    const nowISO = now.toISOString();
    
    client = await pool.connect();

    switch (action) {
      case 'validate':
        // ============================================================
        // 6a. VALIDATE LICENSE
        // Delegates all status derivation to the shared Global License
        // Status service. No business decision happens in this route.
        // ============================================================

        const validateVerdict = await resolveGlobalLicenseStatus(pool, {
          licenseKey: normalizedLicenseKey || undefined,
          hardwareId: hardware_id,
        });

        const validateLicense = validateVerdict.ctx?.license || null;

        if (!validateLicense) {
          client.release();
          client = null;

          await logRequest({
            apiKeyId,
            endpoint: '/api/v1/license',
            method: 'POST',
            statusCode: validateVerdict.verdict.httpStatus,
            ipAddress,
            userAgent,
            latencyMs: Date.now() - startTime,
            requestRedacted: { action, license_key: hardware_id ? '[HARDWARE_LOOKUP]' : '[REDACTED]' }
          });

          return NextResponse.json({
            success: false,
            status: validateVerdict.verdict.status,
            code: validateVerdict.verdict.code,
            reason: validateVerdict.verdict.reason,
            message: validateVerdict.verdict.message,
            actions: validateVerdict.verdict.actions,
          }, { status: validateVerdict.verdict.httpStatus });
        }

        const licenseData = validateLicense;

        // Product isolation
        try {
          await validateProductMatch(productId, licenseData.product_id);
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

        // Only ACTIVE / TRIAL_ACTIVE licenses are valid for validation.
        if (validateVerdict.verdict.status !== 'ACTIVE' && validateVerdict.verdict.status !== 'TRIAL_ACTIVE') {
          client.release();
          client = null;

          return NextResponse.json({
            success: false,
            status: validateVerdict.verdict.status,
            code: validateVerdict.verdict.code,
            reason: validateVerdict.verdict.reason,
            message: validateVerdict.verdict.message,
            actions: validateVerdict.verdict.actions,
          }, { status: validateVerdict.verdict.httpStatus });
        }

        // Update last_validated
        await client.query(
          `UPDATE licenses SET last_validated = $1 WHERE license_key = $2`,
          [nowISO, normalizedLicenseKey]
        );

        // Enrichment reads (device state for the response) — not status decisions.
        const deviceCountResult = await client.query(
          `SELECT COUNT(*) as count FROM activations WHERE license_key = $1 AND is_active = true`,
          [normalizedLicenseKey]
        );
        const totalActiveDevices = parseInt(deviceCountResult.rows[0]?.count || '0');

        let thisDeviceActivated = false;
        if (hardware_id) {
          const thisDeviceResult = await client.query(
            `SELECT id FROM activations WHERE license_key = $1 AND hardware_id = $2 AND is_active = true`,
            [normalizedLicenseKey, hardware_id]
          );
          thisDeviceActivated = thisDeviceResult.rows.length > 0;
        }

        const effectiveDeviceCount = thisDeviceActivated ? totalActiveDevices - 1 : totalActiveDevices;

        client.release();
        client = null;

        const expiryDate = licenseData.expiry_date ? new Date(licenseData.expiry_date) : null;
        const daysLeft = expiryDate
          ? Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        await logRequest({
          apiKeyId,
          endpoint: '/api/v1/license',
          method: 'POST',
          statusCode: 200,
          ipAddress,
          userAgent,
          latencyMs: Date.now() - startTime,
          requestRedacted: { action, license_key: '[REDACTED]' }
        });

        const hasActiveLicenseOnOtherDevice = !thisDeviceActivated && totalActiveDevices > 0;

        const serializedResponse = buildLicenseResponse(
          {
            ...licenseData,
            device_count: effectiveDeviceCount,
          },
          hardware_id,
          thisDeviceActivated,
          hasActiveLicenseOnOtherDevice,
        );

        return NextResponse.json({
          ...serializedResponse,
          license: {
            ...serializedResponse.license,
            product_id: licenseData.product_id,
            product_name: licenseData.product_name,
            days_left: daysLeft,
            last_validated: nowISO,
          },
          customer: serializedResponse.customer,
          hardware: hardware_id
            ? {
                hardware_id,
                is_activated: thisDeviceActivated,
                device_name: device_name || '',
              }
            : undefined,
        }, {
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset)
          }
        });

      case 'activate':
        // ============================================================
        // 6b. ACTIVATE LICENSE
        // ============================================================
        
        if (!hardware_id) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'MISSING_HARDWARE_ID',
              message: 'hardware_id is required for activation'
            }
          }, { status: 400 });
        }

        // Global License Status — single source of truth.
        const activateVerdict = await resolveGlobalLicenseStatus(pool, {
          licenseKey: normalizedLicenseKey,
          hardwareId: hardware_id,
        });

        const license = activateVerdict.ctx?.license || null;

        if (!license) {
          client.release();
          client = null;

          return NextResponse.json({
            success: false,
            status: activateVerdict.verdict.status,
            code: activateVerdict.verdict.code,
            reason: activateVerdict.verdict.reason,
            message: activateVerdict.verdict.message,
            actions: activateVerdict.verdict.actions,
          }, { status: activateVerdict.verdict.httpStatus });
        }

        // Product isolation
        try {
          await validateProductMatch(productId, license.product_id);
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

        // Activation only allowed for ACTIVE / TRIAL_ACTIVE licenses.
        if (activateVerdict.verdict.status !== 'ACTIVE' && activateVerdict.verdict.status !== 'TRIAL_ACTIVE') {
          client.release();
          client = null;

          return NextResponse.json({
            success: false,
            status: activateVerdict.verdict.status,
            code: activateVerdict.verdict.code,
            reason: activateVerdict.verdict.reason,
            message: activateVerdict.verdict.message,
            actions: activateVerdict.verdict.actions,
          }, { status: activateVerdict.verdict.httpStatus });
        }

        // Check if hardware already activated
        const existingActivation = await client.query(
          `SELECT id FROM activations WHERE license_key = $1 AND hardware_id = $2 AND is_active = true`,
          [normalizedLicenseKey, hardware_id]
        );

        console.log(`[ACTIVATE] license=${normalizedLicenseKey} hardware_id=${hardware_id} existing_activation=${existingActivation.rows.length > 0} max_devices=${license.max_devices}`);

        if (existingActivation.rows.length > 0) {
          console.log(`[ACTIVATE] Device already activated — returning already_activated=true`);
          client.release();
          client = null;
          
          return NextResponse.json({
            success: true,
            status: 'licensed',
            message: 'License already activated on this device',
            license: {
              license_key: license.license_key,
              plan: license.plan,
              expiry_date: license.expiry_date?.split('T')[0],
              max_devices: license.max_devices,
              device_count: license.device_count,
              is_trial: license.is_trial || false,
            },
            hardware: {
              hardware_id,
              is_activated: true,
            },
          });
        }

        // Check device limit
        const currentActivations = await client.query(
          `SELECT COUNT(*) as count FROM activations WHERE license_key = $1 AND is_active = true`,
          [normalizedLicenseKey]
        );
        const currentCount = parseInt(currentActivations.rows[0]?.count || '0');
        console.log(`[ACTIVATE] current_count=${currentCount} max_devices=${license.max_devices} limit_reached=${currentCount >= license.max_devices}`);

        if (currentCount >= license.max_devices) {
          console.log(`[ACTIVATE] Device limit reached — ${currentCount}/${license.max_devices}`);
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'MAX_DEVICES_EXCEEDED',
              message: `Device limit reached (${license.max_devices} devices max)`
            }
          }, { status: 403 });
        }

        // Create activation
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
            SET status = 'active',
                inactive_reason = NULL,
               is_activated = true,
               activated_at = $1,
               device_count = device_count + 1,
               updated_at = $1
           WHERE license_key = $2`,
          [nowISO, normalizedLicenseKey]
        );

        // Audit log activation
        await client.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
           VALUES ($1, $2, $3, $4, $5)`,
          ['license_activated', `License activated on hardware ${hardware_id}`, nowISO, ipAddress, normalizedLicenseKey]
        );

        client.release();
        client = null;

        // Log success
        await logRequest({
          apiKeyId,
          endpoint: '/api/v1/license',
          method: 'POST',
          statusCode: 200,
          ipAddress,
          userAgent,
          latencyMs: Date.now() - startTime,
          requestRedacted: { action, license_key: '[REDACTED]', hardware_id: '[REDACTED]' }
        });

        const licExpiry = license.expiry_date ? new Date(license.expiry_date) : null;
        const daysLeftAct = licExpiry ? Math.max(0, Math.ceil((licExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

        return NextResponse.json({
          success: true,
          status: 'licensed',
          license: {
            license_key: normalizedLicenseKey,
            plan: license.plan,
            expiry_date: license.expiry_date?.split('T')[0],
            max_devices: license.max_devices,
            device_count: currentCount + 1,
            is_trial: false,
          },
          customer: {
            name: license.customer_name || '',
            email: license.customer_email || '',
            phone: license.customer_phone || license.customer_mobile || '',
            mobile: license.customer_mobile || license.customer_phone || '',
          },
          plan: {
            name: license.plan || '',
          },
          hardware: {
            hardware_id: hardware_id,
            is_activated: true,
          },
          message: 'License activated successfully',
        }, {
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset)
          }
        });

      case 'deactivate':
        // ============================================================
        // 6c. DEACTIVATE LICENSE
        // ============================================================
        
        if (!hardware_id) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'MISSING_HARDWARE_ID',
              message: 'hardware_id is required for deactivation'
            }
          }, { status: 400 });
        }

        // Verify license exists and product matches
        const deactLicense = await client.query(
          `SELECT product_id FROM licenses WHERE license_key = $1`,
          [normalizedLicenseKey]
        );

        if (deactLicense.rows.length === 0) {
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
          await validateProductMatch(productId, deactLicense.rows[0].product_id);
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
        const deactResult = await client.query(
          `UPDATE activations 
           SET is_active = false, last_seen = $1
           WHERE license_key = $2 AND hardware_id = $3 AND is_active = true`,
          [nowISO, normalizedLicenseKey, hardware_id]
        );

        if (deactResult.rowCount === 0) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'DEVICE_NOT_FOUND',
              message: 'Device not found or already deactivated'
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

        // Audit log
        await client.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          ['device_deactivated', `Device ${hardware_id} deactivated from license ${normalizedLicenseKey} by customer`, nowISO, ipAddress, normalizedLicenseKey, hardware_id]
        );

        client.release();
        client = null;

        // Log success
        await logRequest({
          apiKeyId,
          endpoint: '/api/v1/license',
          method: 'POST',
          statusCode: 200,
          ipAddress,
          userAgent,
          latencyMs: Date.now() - startTime,
          requestRedacted: { action, license_key: '[REDACTED]', hardware_id: '[REDACTED]' }
        });

        return NextResponse.json({
          success: true,
          status: 'unlicensed',
          message: 'Device deactivated successfully',
          hardware: hardware_id ? { hardware_id, is_activated: false } : undefined,
        }, {
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset)
          }
        });

      case 'renew':
        // ============================================================
        // 6d. RENEW LICENSE
        // ============================================================
        
        // Global License Status — single source of truth.
        const renewVerdict = await resolveGlobalLicenseStatus(pool, {
          licenseKey: normalizedLicenseKey,
        });

        const renewLicenseData = renewVerdict.ctx?.license || null;

        if (!renewLicenseData) {
          client.release();
          client = null;
          
          await logRequest({
            apiKeyId,
            endpoint: '/api/v1/license',
            method: 'POST',
            statusCode: renewVerdict.verdict.httpStatus,
            ipAddress,
            userAgent,
            latencyMs: Date.now() - startTime,
            requestRedacted: { action, license_key: '[REDACTED]' }
          });
          
          return NextResponse.json({
            success: false,
            status: renewVerdict.verdict.status,
            code: renewVerdict.verdict.code,
            reason: renewVerdict.verdict.reason,
            message: renewVerdict.verdict.message,
            actions: renewVerdict.verdict.actions,
          }, { status: renewVerdict.verdict.httpStatus });
        }

        // Renewal only allowed for ACTIVE / EXPIRED licenses.
        if (renewVerdict.verdict.status !== 'ACTIVE' && renewVerdict.verdict.status !== 'EXPIRED') {
          client.release();
          client = null;

          return NextResponse.json({
            success: false,
            status: renewVerdict.verdict.status,
            code: renewVerdict.verdict.code,
            reason: renewVerdict.verdict.reason,
            message: renewVerdict.verdict.message,
            actions: renewVerdict.verdict.actions,
          }, { status: renewVerdict.verdict.httpStatus });
        }

        // Product isolation
        try {
          await validateProductMatch(productId, renewLicenseData.product_id);
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

        // Calculate new expiry
        const daysToAdd = extra_days && typeof extra_days === 'number' ? extra_days : 365;
        const oldExpiry = renewLicenseData.expiry_date;
        const baseDate = new Date(oldExpiry) > now ? new Date(oldExpiry) : now;
        const newExpiry = new Date(baseDate);
        newExpiry.setDate(newExpiry.getDate() + daysToAdd);
        const newExpiryISO = newExpiry.toISOString();

        // Update license
        await client.query(
          `UPDATE licenses SET expiry_date = $1, last_renewed_at = $2, updated_at = $3 WHERE license_key = $4`,
          [newExpiryISO, nowISO, nowISO, normalizedLicenseKey]
        );

        // Log to renewal_history
        await client.query(
          `INSERT INTO renewal_history (license_key, old_plan, new_plan, old_expiry_date, new_expiry_date, extra_days, renewed_by, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [normalizedLicenseKey, renewLicenseData.plan, renewLicenseData.plan,
           oldExpiry, newExpiryISO, daysToAdd, apiKeyId, 'SDK renew']
        );

        await client.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
           VALUES ($1, $2, $3, $4, $5)`,
          ['license_renewed', `License renewed for ${daysToAdd} days`, nowISO, ipAddress, normalizedLicenseKey]
        );

        client.release();
        client = null;

        await logRequest({
          apiKeyId,
          endpoint: '/api/v1/license',
          method: 'POST',
          statusCode: 200,
          ipAddress,
          userAgent,
          latencyMs: Date.now() - startTime,
          requestRedacted: { action, license_key: '[REDACTED]' }
        });

        return NextResponse.json({
          success: true,
          data: {
            message: `License renewed for ${daysToAdd} days`,
            license_key: normalizedLicenseKey,
            old_expiry_date: oldExpiry,
            new_expiry_date: newExpiryISO,
            extra_days: daysToAdd
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
            message: `Invalid action: ${action}. Supported: validate, activate, deactivate, renew`
          }
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('License API error:', error);
    
    if (client) {
      client.release();
    }
    
    await logRequest({
      apiKeyId: apiKeyId || 'unknown',
      endpoint: '/api/v1/license',
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
// GET /api/v1/license
// ============================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Public License API v1',
    actions: ['validate', 'activate', 'deactivate', 'renew'],
    documentation: '/internal/api/docs/public-api'
  });
}
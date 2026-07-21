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
import { validateLicenseBeforeAction, computeLicenseStatus, computeInactiveReason } from '@/core/utils/validation-system';

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
      case 'validate':
        // ============================================================
        // 6a. VALIDATE LICENSE
        // ============================================================
        
        const validateResult = await client.query(
          `SELECT 
            l.license_key,
            l.customer_name,
            l.customer_email,
            l.customer_phone,
            l.customer_mobile,
            l.plan,
            l.status,
            l.expiry_date,
            l.max_devices,
            l.device_count,
            l.product_id,
            l.is_trial,
            l.inactive_reason,
            l.status as license_status,
            p.name as product_name,
            p.is_active as product_is_active,
            p.is_deleted as product_is_deleted
          FROM licenses l
          LEFT JOIN products p ON l.product_id = p.product_id
          WHERE l.license_key = $1`,
          [normalizedLicenseKey]
        );

        if (validateResult.rows.length === 0) {
          client.release();
          client = null;
          
          await logRequest({
            apiKeyId,
            endpoint: '/api/v1/license',
            method: 'POST',
            statusCode: 404,
            ipAddress,
            userAgent,
            latencyMs: Date.now() - startTime,
            requestRedacted: { action, license_key: '[REDACTED]' }
          });
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_NOT_FOUND',
              message: 'License key not found'
            }
          }, { status: 404 });
        }

        const licenseData = validateResult.rows[0];

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

        // Check product active
        if (!licenseData.product_is_active || licenseData.product_is_active === null) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'PRODUCT_INACTIVE',
              message: 'Product is currently inactive'
            }
          }, { status: 403 });
        }

        // Check product deleted
        if (licenseData.product_is_deleted) {
          client.release();
          client = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'PRODUCT_DELETED',
              message: 'Product has been deleted'
            }
          }, { status: 403 });
        }

        // Compute business status
        const computedStatus = computeLicenseStatus(
          licenseData.status,
          licenseData.expiry_date,
          !!licenseData.deleted_at,
          true,
          licenseData.is_trial || false,
          licenseData.inactive_reason
        );

        const inactiveReason = computeInactiveReason(licenseData);

        // Check status
        if (computedStatus === 'Expired') {
          await client.query(
            `UPDATE licenses SET status = 'expired', inactive_reason = $1 WHERE license_key = $2`,
            [inactiveReason || 'Subscription Expired', normalizedLicenseKey]
          );
          client.release();
          client = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_EXPIRED',
              message: inactiveReason ? `License ${inactiveReason.toLowerCase()}` : 'License has expired',
              inactive_reason: inactiveReason
            }
          }, { status: 403 });
        }

        if (computedStatus === 'Revoked') {
          client.release();
          client = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_REVOKED',
              message: 'License has been revoked',
              inactive_reason: 'License Revoked'
            }
          }, { status: 403 });
        }

        if (computedStatus === 'Suspended') {
          client.release();
          client = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_SUSPENDED',
              message: 'License is suspended',
              inactive_reason: licenseData.inactive_reason || 'Suspended'
            }
          }, { status: 403 });
        }

        if (computedStatus === 'Disabled') {
          client.release();
          client = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_DISABLED',
              message: 'License is disabled',
              inactive_reason: licenseData.inactive_reason || 'Manual Deactivation'
            }
          }, { status: 403 });
        }

        // Check raw expiry
        const expiryDate = new Date(licenseData.expiry_date);
        if (expiryDate < now) {
          await client.query(
            `UPDATE licenses SET status = 'expired', inactive_reason = 'Subscription Expired' WHERE license_key = $1`,
            [normalizedLicenseKey]
          );
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_EXPIRED',
              message: 'License has expired',
              inactive_reason: 'Subscription Expired'
            }
          }, { status: 403 });
        }

        // Update last_validated
        await client.query(
          `UPDATE licenses SET last_validated = $1 WHERE license_key = $2`,
          [nowISO, normalizedLicenseKey]
        );

        // Get total active device count
        const deviceCountResult = await client.query(
          `SELECT COUNT(*) as count FROM activations WHERE license_key = $1 AND is_active = true`,
          [normalizedLicenseKey]
        );
        const totalActiveDevices = parseInt(deviceCountResult.rows[0]?.count || '0');

        // Check if current hardware is already activated for this license
        let thisDeviceActivated = false;
        if (hardware_id) {
          const thisDeviceResult = await client.query(
            `SELECT id FROM activations WHERE license_key = $1 AND hardware_id = $2 AND is_active = true`,
            [normalizedLicenseKey, hardware_id]
          );
          thisDeviceActivated = thisDeviceResult.rows.length > 0;
          console.log(`[VALIDATE] license=${normalizedLicenseKey} hardware_id=${hardware_id} this_device_activated=${thisDeviceActivated} total_active=${totalActiveDevices} max_devices=${licenseData.max_devices}`);
        }

        // If this device is already activated, exclude it from the count
        // so the SDK client-side pre-check does not falsely block activation
        const effectiveDeviceCount = thisDeviceActivated ? totalActiveDevices - 1 : totalActiveDevices;

        client.release();
        client = null;

        const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        // Log success
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
            valid: true,
            license_key: licenseData.license_key,
            status: licenseData.status,
            inactive_reason: inactiveReason,
            product_id: licenseData.product_id,
            product_name: licenseData.product_name,
            plan: licenseData.plan,
            expiry_date: licenseData.expiry_date?.split('T')[0],
            days_left: daysLeft,
            customer_name: licenseData.customer_name,
            customer_email: licenseData.customer_email,
            customer_phone: licenseData.customer_phone,
            customer_mobile: licenseData.customer_mobile,
            max_devices: licenseData.max_devices,
            device_count: effectiveDeviceCount,
            active_devices: effectiveDeviceCount,
            this_device_activated: thisDeviceActivated,
            total_active_devices: totalActiveDevices,
            last_validated: nowISO
          }
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

        // Get license with product check
        const licenseResult = await client.query(
          `SELECT 
            l.license_key,
            l.customer_name,
            l.customer_email,
            l.plan,
            l.status,
            l.expiry_date,
            l.max_devices,
            l.product_id,
            p.is_active as product_is_active
          FROM licenses l
          LEFT JOIN products p ON l.product_id = p.product_id
          WHERE l.license_key = $1`,
          [normalizedLicenseKey]
        );

        if (licenseResult.rows.length === 0) {
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

        const license = licenseResult.rows[0];

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

        // Check product active
        if (!license.product_is_active || license.product_is_active === null) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'PRODUCT_INACTIVE',
              message: 'Product is currently inactive'
            }
          }, { status: 403 });
        }

        // Check status
        if (license.status === 'expired') {
          client.release();
          client = null;

          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_EXPIRED',
              message: 'License has expired'
            }
          }, { status: 403 });
        }

        if (license.status === 'revoked') {
          client.release();
          client = null;

          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_REVOKED',
              message: 'License has been revoked'
            }
          }, { status: 403 });
        }

        // Check expiry
        const licExpiry = new Date(license.expiry_date);
        if (licExpiry < now) {
          await client.query(
            `UPDATE licenses SET status = 'expired', inactive_reason = 'License Expired' WHERE license_key = $1`,
            [normalizedLicenseKey]
          );
          await client.query(
            `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
             VALUES ($1, $2, $3, $4, $5)`,
            ['license_expired', `License expired during activation check`, nowISO, ipAddress, normalizedLicenseKey]
          );
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_EXPIRED',
              message: 'License has expired'
            }
          }, { status: 403 });
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
            message: 'License already activated on this device',
            already_activated: true
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

        const daysLeftAct = Math.max(0, Math.ceil((licExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        return NextResponse.json({
          success: true,
          data: {
            message: 'License activated successfully',
            license_key: normalizedLicenseKey,
            expiry_date: license.expiry_date?.split('T')[0],
            days_left: daysLeftAct,
            plan: license.plan,
            max_devices: license.max_devices,
            device_count: currentCount + 1
          }
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
          data: {
            message: 'Device deactivated successfully',
            license_key: normalizedLicenseKey,
            hardware_id: hardware_id
          }
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
        
        // Verify license exists
        const renewLicenseData = await client.query(
          `SELECT product_id, expiry_date, plan, plan_id FROM licenses WHERE license_key = $1`,
          [normalizedLicenseKey]
        );

        if (renewLicenseData.rows.length === 0) {
          client.release();
          client = null;
          
          await logRequest({
            apiKeyId,
            endpoint: '/api/v1/license',
            method: 'POST',
            statusCode: 404,
            ipAddress,
            userAgent,
            latencyMs: Date.now() - startTime,
            requestRedacted: { action, license_key: '[REDACTED]' }
          });
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'LICENSE_NOT_FOUND',
              message: 'License key not found'
            }
          }, { status: 404 });
        }

        // Product isolation
        try {
          await validateProductMatch(productId, renewLicenseData.rows[0].product_id);
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
        const oldExpiry = renewLicenseData.rows[0].expiry_date;
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
          [normalizedLicenseKey, renewLicenseData.rows[0].plan, renewLicenseData.rows[0].plan,
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
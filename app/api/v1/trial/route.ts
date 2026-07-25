// ============================================================
// FILE: app/api/v1/trial/route.ts
// PURPOSE: Public Trial API - start, status, convert
// DATABASE: trials, products, plans, licenses
// SECURITY: API Key + HMAC + Rate Limit + Audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey } from '@/lib/public-api/auth';
import { verifySignature } from '@/lib/public-api/signature';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest, logSecurityViolation } from '@/lib/public-api/audit';
import { validateTrialStart, validateTrialConversion, validateEmail, validateHardwareId, generateLicenseKey } from '@/core/utils/validation-system';

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
// POST /api/v1/trial
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
    // 3. VERIFY SIGNATURE (optional — onboarding clients may not sign)
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
    
    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/trial');
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

    const { action, hardware_id, customer_email, customer_name, plan, sdk_version, runtime_type, activation_source } = body;

    if (!action) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_ACTION',
          message: 'action is required (start, status, convert)'
        }
      }, { status: 400 });
    }

    if (!hardware_id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_HARDWARE_ID',
          message: 'hardware_id is required'
        }
      }, { status: 400 });
    }

    // ============================================================
    // 6. PROCESS ACTION
    // ============================================================
    
    const now = new Date();
    const nowISO = now.toISOString();
    
    client = await pool.connect();

    switch (action) {
      case 'start':
        // ============================================================
        // 6a. START TRIAL
        // ============================================================
        
        if (!customer_email) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'MISSING_CUSTOMER_EMAIL',
              message: 'customer_email is required'
            }
          }, { status: 400 });
        }

        if (customer_email) {
          const emailResult = validateEmail(customer_email);
          if (!emailResult.valid) {
            client.release();
            client = null;
            return NextResponse.json({
              success: false,
              error: {
                code: 'INVALID_EMAIL',
                message: 'Invalid email address'
              }
            }, { status: 400 });
          }
        }

        // Paid license takes precedence over trial
        const paidCheckStart = await client.query(
          `SELECT EXISTS (
            SELECT 1 FROM licenses l
            INNER JOIN activations a ON l.license_key = a.license_key AND a.hardware_id = $1
            WHERE (l.is_trial IS NULL OR l.is_trial = false)
          ) OR EXISTS (
            SELECT 1 FROM licenses l
            WHERE l.customer_email = $2 AND (l.is_trial IS NULL OR l.is_trial = false)
          ) AS has_paid_license`,
          [hardware_id, customer_email]
        );
        if (paidCheckStart.rows[0]?.has_paid_license) {
          client.release();
          client = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'PAID_LICENSE_EXISTS',
              message: 'A paid license is associated with this hardware or email. Trial is not available.'
            }
          }, { status: 400 });
        }

        // TRIAL_ALREADY_CONSUMED enforcement
        // One verified email = one lifetime trial. Period.
        const normalizedEmail = (customer_email || '').trim().toLowerCase();
        const existingTrialByEmail = await client.query(
          `SELECT id, status, expiry_date FROM trials 
           WHERE customer_email = $1 AND product_id = $2`,
          [normalizedEmail, productId]
        );

        if (existingTrialByEmail.rows.length > 0) {
          const trial = existingTrialByEmail.rows[0];

          await client.query(
            `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, hardware_id)
             VALUES ($1, $2, $3, $4, $5)`,
            ['trial_rejected_already_consumed', `Trial rejected for ${normalizedEmail} - already consumed (status: ${trial.status})`, nowISO, ipAddress, hardware_id]
          );

          client.release();
          client = null;

          return NextResponse.json({
            success: false,
            error: {
              code: 'TRIAL_ALREADY_CONSUMED',
              message: 'This email has already used its free trial. Please activate a license, renew an existing license, or contact sales.'
            }
          }, { status: 400 });
        }

        // Validate trial start (product exists, formats) — runs after paid-license and existing-trial checks
        const trialStartValidation = await validateTrialStart(pool, hardware_id, productId, customer_email);
        if (!trialStartValidation.valid) {
          client.release();
          client = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'TRIAL_VALIDATION_FAILED',
              message: trialStartValidation.errors[0].message
            }
          }, { status: 400 });
        }

        // Get trial duration from sdk_runtime_settings (per-product), then trial_templates, then 7
        const sdkSettingsResult = await client.query(
          `SELECT trial_duration_days FROM sdk_runtime_settings WHERE product_id = $1 LIMIT 1`,
          [productId]
        );
        let trialDuration = 14;
        if (sdkSettingsResult.rows.length > 0 && sdkSettingsResult.rows[0].trial_duration_days != null) {
          trialDuration = sdkSettingsResult.rows[0].trial_duration_days;
        } else {
          const universalTrialResult = await client.query(
            `SELECT duration_days FROM trial_templates WHERE is_system_default = true AND is_active = true LIMIT 1`
          );
          if (universalTrialResult.rows.length > 0) {
            trialDuration = universalTrialResult.rows[0].duration_days || 7;
          }
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + trialDuration);
        const expiryDateISO = expiryDate.toISOString();

        // Create trial
        await client.query(
          `INSERT INTO trials (
            hardware_id,
            product_id,
            customer_email,
            customer_name,
            status,
            expiry_date,
            started_at,
            trial_duration_days,
            sdk_version,
            runtime_type,
            activation_source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [hardware_id, productId, customer_email, customer_name || 'Unknown', 'active', expiryDateISO, nowISO, trialDuration, sdk_version || '', runtime_type || 'python', activation_source || 'sdk_onboarding']
        );

        client.release();
        client = null;

        // Audit log for trial start
        client = await pool.connect();
        try {
          await client.query(
            `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, hardware_id)
             VALUES ($1, $2, $3, $4, $5)`,
            ['trial_started', `Trial started for ${customer_email} on ${productId}`, nowISO, ipAddress, hardware_id]
          );
        } finally {
          client.release();
          client = null;
        }

        // Log success
        await logRequest({
          apiKeyId,
          endpoint: '/api/v1/trial',
          method: 'POST',
          statusCode: 200,
          ipAddress,
          userAgent,
          latencyMs: Date.now() - startTime,
          requestRedacted: { action, hardware_id: '[REDACTED]', customer_email: '[REDACTED]' }
        });

        return NextResponse.json({
          success: true,
          data: {
            active: true,
            days_left: trialDuration,
            expiry_date: expiryDateISO,
            duration_days: trialDuration,
            message: `${trialDuration}-day trial started successfully`
          }
        }, {
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset)
          }
        });

      case 'status':
        // ============================================================
        // 6b. TRIAL STATUS
        // ============================================================
        
        const statusResult = await client.query(
          `SELECT id, status, expiry_date, started_at, customer_name, customer_email, mobile_number as customer_phone
           FROM trials 
           WHERE hardware_id = $1 AND product_id = $2`,
          [hardware_id, productId]
        );

        if (statusResult.rows.length === 0) {
          client.release();
          client = null;
          return NextResponse.json({
            success: true,
            data: {
              has_trial: false,
              message: 'No trial found for this hardware'
            }
          });
        }

        const trial = statusResult.rows[0];

        // Paid license takes precedence over trial
        const paidCheckStatus = await client.query(
          `SELECT EXISTS (
            SELECT 1 FROM licenses l
            INNER JOIN activations a ON l.license_key = a.license_key AND a.hardware_id = $1
            WHERE (l.is_trial IS NULL OR l.is_trial = false)
          ) OR EXISTS (
            SELECT 1 FROM licenses l
            WHERE l.customer_email = $2 AND (l.is_trial IS NULL OR l.is_trial = false)
          ) AS has_paid_license`,
          [hardware_id, trial.customer_email || '']
        );
        if (paidCheckStatus.rows[0]?.has_paid_license) {
          client.release();
          client = null;
          return NextResponse.json({
            success: true,
            data: {
              has_trial: false,
              message: 'Trial is not available - paid license detected'
            }
          });
        }
        const tExpiry = new Date(trial.expiry_date);
        const daysLeftStatus = Math.max(0, Math.ceil((tExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        // Auto-expire trial if expired
        if (tExpiry < now && trial.status === 'active') {
          await client.query(
            `UPDATE trials SET status = 'expired', expired_at = $1 WHERE id = $2`,
            [nowISO, trial.id]
          );
          await client.query(
            `INSERT INTO audit_logs (event_type, message, timestamp, license_key, hardware_id)
             VALUES ($1, $2, $3, $4, $5)`,
            ['trial_expired', `Trial for hardware ${hardware_id} expired`, nowISO, '', hardware_id]
          );
          trial.status = 'expired';
        }

        client.release();
        client = null;

        await logRequest({
          apiKeyId,
          endpoint: '/api/v1/trial',
          method: 'POST',
          statusCode: 200,
          ipAddress,
          userAgent,
          latencyMs: Date.now() - startTime,
          requestRedacted: { action, hardware_id: '[REDACTED]' }
        });

        return NextResponse.json({
          success: true,
          data: {
            has_trial: true,
            trial_id: trial.id,
            status: trial.status,
            days_left: daysLeftStatus,
            expiry_date: trial.expiry_date,
            started_at: trial.started_at,
            customer_name: trial.customer_name,
            customer_email: trial.customer_email,
            customer_phone: trial.customer_phone || trial.mobile_number || ''
          }
        }, {
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset)
          }
        });

      case 'convert':
        // ============================================================
        // 6c. CONVERT TRIAL TO LICENSE
        // ============================================================
        
        if (!plan) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'MISSING_PLAN',
              message: 'plan is required for conversion'
            }
          }, { status: 400 });
        }

        if (!customer_name) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'MISSING_CUSTOMER_NAME',
              message: 'customer_name is required for conversion'
            }
          }, { status: 400 });
        }

        // Use comprehensive trial conversion validation
        const conversionValidation = await validateTrialConversion(pool, hardware_id, productId, plan, customer_name);
        if (!conversionValidation.valid) {
          client.release();
          client = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'CONVERSION_VALIDATION_FAILED',
              message: conversionValidation.errors[0].message
            }
          }, { status: 400 });
        }

        // Verify trial exists and is active
        const trialToConvert = await client.query(
          `SELECT id, status, expiry_date, customer_email 
           FROM trials 
           WHERE hardware_id = $1 AND product_id = $2 AND status = 'active'`,
          [hardware_id, productId]
        );

        if (trialToConvert.rows.length === 0) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'TRIAL_NOT_FOUND',
              message: 'No active trial found for conversion'
            }
          }, { status: 404 });
        }

        const trialData = trialToConvert.rows[0];

        // Get plan details
        const planResult = await client.query(
          `SELECT id, max_devices, price, name, default_expiry_days FROM plans 
           WHERE name = $1 AND product_id = $2 AND is_active = true`,
          [plan, productId]
        );

        if (planResult.rows.length === 0) {
          client.release();
          client = null;
          
          return NextResponse.json({
            success: false,
            error: {
              code: 'PLAN_NOT_FOUND',
              message: `Plan "${plan}" not found for this product`
            }
          }, { status: 404 });
        }

        const planData = planResult.rows[0];

        // Generate license key
        const licenseKey = generateLicenseKey();

        // Calculate expiry from plan's default_expiry_days
        const planDurationDays = planData.default_expiry_days || 365;
        const licExpiry = new Date();
        licExpiry.setDate(licExpiry.getDate() + planDurationDays);
        const licExpiryISO = licExpiry.toISOString();

        // Create license
        await client.query(
          `INSERT INTO licenses (
            license_key,
            product_id,
            plan,
            plan_id,
            customer_name,
            customer_email,
            customer_username,
            status,
            expiry_date,
            duration_days,
            max_devices,
            is_trial,
            inactive_reason,
            notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            licenseKey,
            productId,
            planData.name,
            planData.id,
            customer_name,
            trialData.customer_email || customer_email,
            customer_name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            'inactive',
            licExpiryISO,
            planDurationDays,
            planData.max_devices,
            true,
            'Converted from trial',
            `Converted from trial (hardware: ${hardware_id})`
          ]
        );

        // Update trial
        await client.query(
          `UPDATE trials 
           SET status = 'converted',
               converted_at = $1,
               converted_to_license_key = $2
           WHERE hardware_id = $3 AND product_id = $4`,
          [nowISO, licenseKey, hardware_id, productId]
        );

        // Audit log entry for trial conversion
        await client.query(
          `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            'trial_converted',
            `Trial for hardware ${hardware_id} converted to license ${licenseKey} (plan: ${planData.name})`,
            nowISO,
            ipAddress,
            licenseKey,
            hardware_id
          ]
        );

        client.release();
        client = null;

        await logRequest({
          apiKeyId,
          endpoint: '/api/v1/trial',
          method: 'POST',
          statusCode: 200,
          ipAddress,
          userAgent,
          latencyMs: Date.now() - startTime,
          requestRedacted: { action, hardware_id: '[REDACTED]' }
        });

        return NextResponse.json({
          success: true,
          data: {
            message: 'Trial successfully converted to license',
            license_key: licenseKey,
            plan: planData.name,
            expiry_date: licExpiryISO.split('T')[0],
            max_devices: planData.max_devices
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
            message: `Invalid action: ${action}. Supported: start, status, convert`
          }
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Trial API error:', error);
    
    if (client) {
      client.release();
    }
    
    await logRequest({
      apiKeyId: apiKeyId || 'unknown',
      endpoint: '/api/v1/trial',
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
// GET /api/v1/trial
// ============================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Public Trial API v1',
    actions: ['start', 'status', 'convert'],
    documentation: '/internal/api/docs/public-api'
  });
}
/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/api/internal/publisher/publish-product/route.ts
 * Purpose: Internal API route for publishing a product package
 * Author: Websmith
 * 
 * RESPONSIBILITY:
 * - Authenticate API key
 * - Validate rate limits
 * - Check product permissions
 * - Queue SDK generation job (async)
 * - Return job_id immediately
 * 
 * WHY QUEUE:
 * - Vercel Hobby has 10s timeout limit
 * - SDK generation takes >10s
 * - Queue allows async processing via the workflow endpoint
 * 
 * ERROR CODES:
 * - PRODUCT_ID_REQUIRED: Missing product ID
 * - API_KEY_REQUIRED: Missing API key
 * - INVALID_API_KEY: Invalid or expired API key
 * - RATE_LIMIT_EXCEEDED: Rate limit hit
 * - PRODUCT_NOT_AUTHORIZED: Key doesn't belong to product
 * - UNSUPPORTED_RUNTIME: Runtime not supported
 * ---------------------------------------------------------
 */

import { NextRequest, NextResponse } from 'next/server';
import { Publisher } from '@/app/internal/publisher';
import { validateApiKey } from '@/lib/public-api/auth';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest } from '@/lib/public-api/audit';
import { enqueueSDKJob } from '@/lib/public-api/queue';  // ✅ Only once

// ✅ Increase timeout for Vercel serverless (60 seconds)
// Note: This only works on Pro plan. On Hobby, we use queue.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let apiKey: string | undefined;
  let productId: string | undefined;
  let runtime: string | undefined;
  let productName: string | undefined;

  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    // ============================================================
    // 1. PARSE REQUEST BODY
    // ============================================================
    
    const body = await req.json();
    productId = body.productId;
    runtime = body.runtime || 'node';

    if (!productId) {
      await logRequest({
        apiKeyId: 'unknown',
        endpoint: '/internal/publisher/publish-product',
        method: 'POST',
        statusCode: 400,
        latencyMs: Date.now() - startTime,
        ipAddress,
        userAgent,
        requestRedacted: { action: 'missing_product_id' }
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Product ID is required',
          error_code: 'PRODUCT_ID_REQUIRED'
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 2. GET API KEY (CHECK HEADERS AND BODY)
    // ============================================================
    
    apiKey = req.headers.get('x-api-key') || 
             req.headers.get('authorization')?.replace('Bearer ', '') ||
             body.apiKey ||
             body.api_key;

    if (!apiKey) {
      await logRequest({
        apiKeyId: 'unknown',
        endpoint: '/internal/publisher/publish-product',
        method: 'POST',
        statusCode: 401,
        latencyMs: Date.now() - startTime,
        ipAddress,
        userAgent,
        requestRedacted: { product_id: productId, action: 'missing_api_key' }
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'API key required. Please provide a valid API key.',
          error_code: 'API_KEY_REQUIRED'
        },
        { status: 401 }
      );
    }

    // ============================================================
    // 3. VALIDATE API KEY
    // ============================================================
    
    let authResult;
    try {
      authResult = await validateApiKey(apiKey);
      
      if (authResult?.productName) {
        productName = authResult.productName;
      }
    } catch (error) {
      await logRequest({
        apiKeyId: apiKey,
        endpoint: '/internal/publisher/publish-product',
        method: 'POST',
        statusCode: 401,
        latencyMs: Date.now() - startTime,
        ipAddress,
        userAgent,
        requestRedacted: { 
          product_id: productId, 
          action: 'invalid_api_key',
          error: error instanceof Error ? error.message : 'Unknown'
        }
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired API key. Please use a valid active API key.',
          error_code: 'INVALID_API_KEY'
        },
        { status: 401 }
      );
    }

    // ============================================================
    // 4. CHECK RATE LIMIT
    // ============================================================
    
    const rateResult = await checkRateLimit(
      authResult.apiKeyId || apiKey,
      ipAddress,
      'publish_product'
    );

    if (!rateResult.allowed) {
      await logRequest({
        apiKeyId: authResult.apiKeyId || apiKey,
        endpoint: '/internal/publisher/publish-product',
        method: 'POST',
        statusCode: 429,
        latencyMs: Date.now() - startTime,
        ipAddress,
        userAgent,
        requestRedacted: { 
          product_id: productId, 
          product_name: productName,
          action: 'rate_limit_exceeded'
        }
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait before trying again.',
          error_code: 'RATE_LIMIT_EXCEEDED',
          limit: rateResult.limit,
          remaining: rateResult.remaining,
          reset: rateResult.reset
        },
        { status: 429 }
      );
    }

    // ============================================================
    // 5. CHECK PRODUCT PERMISSIONS
    // ============================================================
    
    let hasPermission = false;
    let keyProductName: string | undefined;

    if (authResult.productId === productId) {
      hasPermission = true;
      keyProductName = authResult.productName;
    }

    if (!hasPermission && authResult.permissions && authResult.permissions.length > 0) {
      hasPermission = authResult.permissions.some(
        (p: string) => p === `product:${productId}` || p === 'product:*'
      );
    }

    if (!hasPermission) {
      const errorMessage = keyProductName
        ? `API key belongs to "${keyProductName}". Please use a key for the selected product.`
        : 'API key not authorized for this product.';

      await logRequest({
        apiKeyId: authResult.apiKeyId || apiKey,
        endpoint: '/internal/publisher/publish-product',
        method: 'POST',
        statusCode: 403,
        latencyMs: Date.now() - startTime,
        ipAddress,
        userAgent,
        requestRedacted: { 
          product_id: productId, 
          product_name: productName,
          key_product_name: keyProductName,
          action: 'permission_denied'
        }
      });
      
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          error_code: 'PRODUCT_NOT_AUTHORIZED',
          key_product_name: keyProductName
        },
        { status: 403 }
      );
    }

    // ============================================================
    // 6. CHECK RUNTIME SUPPORT
    // ============================================================
    
    const supportedRuntimes = Publisher.getSupportedRuntimes();

    if (runtime && !supportedRuntimes.includes(runtime)) {
      const productContext = productName ? `for "${productName}"` : '';
      
      await logRequest({
        apiKeyId: authResult.apiKeyId || apiKey,
        endpoint: '/internal/publisher/publish-product',
        method: 'POST',
        statusCode: 400,
        latencyMs: Date.now() - startTime,
        ipAddress,
        userAgent,
        requestRedacted: { 
          product_id: productId, 
          product_name: productName,
          runtime: runtime,
          action: 'unsupported_runtime'
        }
      });
      
      return NextResponse.json(
        {
          success: false,
          error: `Runtime "${runtime}" is not supported ${productContext}. Supported: ${supportedRuntimes.join(', ')}`,
          error_code: 'UNSUPPORTED_RUNTIME',
          supported: supportedRuntimes
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 7. READ SDK RUNTIME SETTINGS FROM DB FOR DEFAULTS
    // ============================================================
    
    productName = productName || productId;

    let dbSettings: Record<string, any> = {};
    try {
      const db = await import('@/lib/backend-db').then(m => m.getDb());
      const res = await db.query('SELECT * FROM sdk_runtime_settings WHERE product_id = $1', [productId]);
      if (res.rows.length > 0) {
        dbSettings = res.rows[0];
      }
    } catch (err) {
      console.warn('[publish-product] Could not read sdk_runtime_settings:', err);
    }

    // ============================================================
    // 8. QUEUE SDK GENERATION (ASYNC)
    // ============================================================
    
    // Defaults from DB, then body, then hardcoded fallback (last resort)
    const trialDuration = body.trial_duration ?? dbSettings.trial_duration_days ?? 7;
    const deviceLimit = body.device_limit ?? dbSettings.device_limit ?? 1;
    const offlineGraceDays = body.offline_grace_days ?? dbSettings.offline_grace_days ?? 0;
    const cacheDays = body.cache_days ?? dbSettings.cache_days ?? 0;
    const trialMessage = body.trial_message ?? dbSettings.trial_message ?? '';
    const supportEmail = body.support_email || dbSettings.support_email || 'support@websmithdigital.com';
    const trialEnabled = body.trial_enabled !== false;
    const emailVerification = body.email_verification !== false;
    const allowConversion = body.allow_conversion !== false;

    // ✅ Enqueue the job instead of generating directly
    const jobId = await enqueueSDKJob({
      productId,
      apiKey,
      runtime,
      template_id: body.template_id || null,
      trial_enabled: trialEnabled,
      trial_duration: trialDuration,
      email_verification: emailVerification,
      device_limit: deviceLimit,
      offline_grace_days: offlineGraceDays,
      cache_days: cacheDays,
      trial_message: trialMessage,
      support_email: supportEmail,
      allow_conversion: allowConversion,
    });

    // Persist SDK runtime settings to database
    try {
      const db = await import('@/lib/backend-db').then(m => m.getDb());
      await db.query(
        `INSERT INTO sdk_runtime_settings (product_id, trial_enabled, allow_conversion, email_verification,
          trial_duration_days, device_limit, offline_grace_days, cache_days, trial_message, support_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (product_id)
         DO UPDATE SET
           trial_enabled = EXCLUDED.trial_enabled,
           allow_conversion = EXCLUDED.allow_conversion,
           email_verification = EXCLUDED.email_verification,
           trial_duration_days = EXCLUDED.trial_duration_days,
           device_limit = EXCLUDED.device_limit,
           offline_grace_days = EXCLUDED.offline_grace_days,
           cache_days = EXCLUDED.cache_days,
           trial_message = EXCLUDED.trial_message,
           support_email = EXCLUDED.support_email,
           updated_at = CURRENT_TIMESTAMP`,
        [
          productId,
          trialEnabled,
          allowConversion,
          emailVerification,
          trialDuration,
          deviceLimit,
          offlineGraceDays,
          cacheDays,
          trialMessage,
          supportEmail,
        ]
      );
    } catch (err) {
      console.warn('[publish-product] Could not persist sdk_runtime_settings:', err);
    }

    console.log(`📦 SDK generation queued for: ${productName} (${runtime}) - Job: ${jobId}`);

    // ============================================================
    // 8. AUDIT LOG (QUEUED)
    // ============================================================
    
    await logRequest({
      apiKeyId: authResult.apiKeyId || apiKey,
      endpoint: '/internal/publisher/publish-product',
      method: 'POST',
      statusCode: 202,
      latencyMs: Date.now() - startTime,
      ipAddress,
      userAgent,
      requestRedacted: {
        product_id: productId,
        product_name: productName,
        runtime: runtime,
        job_id: jobId,
        action: 'queued'
      }
    });

    // ============================================================
    // 9. RETURN RESPONSE (202 Accepted)
    // ============================================================
    
    return NextResponse.json({
      success: true,
      product_name: productName,
      job_id: jobId,
      status: 'pending',
      message: 'SDK generation queued. Poll /api/internal/publisher/status/[jobId] for completion.'
    }, { status: 202 });

  } catch (error) {
    // ============================================================
    // ERROR HANDLING
    // ============================================================
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    let errorProductName = productName;
    if (error instanceof Error && error.message.includes('[')) {
      const match = error.message.match(/\[([^\]]+)\]/);
      if (match) {
        errorProductName = match[1];
      }
    }

    await logRequest({
      apiKeyId: apiKey || 'unknown',
      endpoint: '/internal/publisher/publish-product',
      method: 'POST',
      statusCode: 500,
      latencyMs: Date.now() - startTime,
      ipAddress,
      userAgent,
      requestRedacted: {
        product_id: productId,
        product_name: errorProductName,
        runtime: runtime,
        error: errorMessage,
        action: 'publish_failure'
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: `Failed to queue SDK generation: ${errorMessage}`,
        error_code: 'QUEUE_FAILED',
        product_name: errorProductName,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
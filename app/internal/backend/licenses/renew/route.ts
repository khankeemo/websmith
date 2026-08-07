// FILE: app/internal/backend/licenses/renew/route.ts
// Handles: POST /internal/backend/licenses/renew
// Supports: Renew with plan change, auto-fetch plan details
//
// IMPORTANT: Status is derived by the shared resolveGlobalLicenseStatus()
// service (single source of truth). This route only performs the renewal
// write once the shared verdict allows it (ACTIVE / EXPIRED). It does NOT
// run its own status derivation or independent license-state business logic.

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import { triggerNotification } from '@/lib/notification/notification-service';
import { resolveGlobalLicenseStatus } from '@/lib/license/serializer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      license_key, 
      extra_days, 
      new_plan,          // Optional: plan name to change to
      notes              // Optional: admin notes
    } = body;

    // Validate required fields
    if (!license_key || license_key.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'License key is required' },
        { status: 400 }
      );
    }

    // 1. Global License Status — single source of truth for eligibility.
    const pool = await getDb();
    const { verdict, ctx } = await resolveGlobalLicenseStatus(pool, {
      licenseKey: license_key.trim(),
    });

    const license = ctx?.license || null;

    const renewable = verdict.status === 'ACTIVE' || verdict.status === 'EXPIRED';
    if (!renewable) {
      return NextResponse.json({
        success: false,
        status: verdict.status,
        code: verdict.code,
        reason: verdict.reason,
        message: verdict.message,
        actions: verdict.actions,
      }, { status: verdict.httpStatus });
    }

    const client = await pool.connect();

    try {
      // Re-read latest license within this transaction for the write path.
      const licenseResult = await client.query(
        `SELECT 
          l.license_key,
          l.product_id,
          l.customer_name,
          l.customer_email,
          l.plan AS current_plan_name,
          l.plan_id AS current_plan_id,
          l.status,
          l.expiry_date,
          l.max_devices,
          l.duration_days,
          l.notes AS license_notes,
          p.name AS product_name
        FROM licenses l
        LEFT JOIN products p ON l.product_id = p.product_id
        WHERE l.license_key = $1`,
        [license_key]
      );

      if (licenseResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'License not found' },
          { status: 404 }
        );
      }

      // Validate extra_days
      if (extra_days !== undefined && extra_days !== null) {
        const days = Number(extra_days);
        if (isNaN(days) || days < 1 || days > 36500) {
          return NextResponse.json(
            { success: false, error: 'Extra days must be between 1 and 36500' },
            { status: 400 }
          );
        }
      }

      // 2. Determine plan details
      let targetPlanId = license.current_plan_id;
      let targetPlanName = license.current_plan_name;
      let planMaxDevices = license.max_devices;
      let planDefaultDays = license.duration_days || 0;
      let planPrice = 0;

      // If new_plan is provided, fetch the plan details
      if (new_plan && new_plan !== license.plan) {
        const planResult = await client.query(
          `SELECT 
            id,
            name,
            max_devices,
            default_expiry_days,
            price,
            is_active
          FROM plans
          WHERE name = $1 
            AND product_id = $2
            AND is_active = true`,
          [new_plan, license.product_id]
        );

        if (planResult.rows.length === 0) {
          return NextResponse.json(
            { 
              success: false, 
              error: `Plan "${new_plan}" not found or inactive for this product` 
            },
            { status: 400 }
          );
        }

        const plan = planResult.rows[0];
        targetPlanId = plan.id;
        targetPlanName = plan.name;
        planMaxDevices = plan.max_devices;
        planDefaultDays = plan.default_expiry_days;
        planPrice = plan.price;
      }

      // 3. Calculate new expiry date
      // Use extra_days if provided, otherwise use plan's default_expiry_days
      const daysToAdd = extra_days || planDefaultDays;

      let currentExpiry;
      try {
        currentExpiry = new Date(license.expiry_date);
        if (isNaN(currentExpiry.getTime())) {
          currentExpiry = new Date();
        }
      } catch (e) {
        currentExpiry = new Date();
      }

      const now = new Date();
      const startDate = license.status === 'expired' || currentExpiry < now ? now : currentExpiry;
      const newExpiry = new Date(startDate);
      newExpiry.setDate(newExpiry.getDate() + daysToAdd);

      // 4. Update license
      await client.query(
        `UPDATE licenses 
         SET expiry_date = $1,
             status = 'active',
             inactive_reason = NULL,
             plan_id = $2,
             plan = $3,
             max_devices = $4,
             duration_days = $5,
             last_renewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP,
             notes = CASE 
               WHEN notes IS NULL THEN $6
               ELSE notes || E'\n' || $6
             END
         WHERE license_key = $7`,
        [
          newExpiry.toISOString(),
          targetPlanId,
          targetPlanName,
          planMaxDevices,
          daysToAdd,
          `[${new Date().toISOString()}] Renewed for ${daysToAdd} days${new_plan ? `, plan changed to "${new_plan}"` : ''}. New expiry: ${newExpiry.toISOString()}`,
          license_key
        ]
      );

      // 5. Insert into renewal_history
      await client.query(
        `INSERT INTO renewal_history 
         (license_key, old_plan, new_plan, old_plan_id, new_plan_id, 
          old_expiry_date, new_expiry_date, extra_days, renewed_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          license_key,
          license.plan,
          targetPlanName,
          license.plan_id,
          targetPlanId,
          license.expiry_date,
          newExpiry.toISOString(),
          daysToAdd,
          request.headers.get('x-user-email') || 'admin',
          notes || ''
        ]
      );

      // 6. Log to audit_logs
      await client.query(
        `INSERT INTO audit_logs 
         (event_type, message, timestamp, license_key, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'license_renewed',
          `License ${license_key} renewed${new_plan ? ` with plan change to "${new_plan}"` : ''}. Old expiry: ${license.expiry_date}, New expiry: ${newExpiry.toISOString()}`,
          new Date().toISOString(),
          license_key,
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        ]
      );

      triggerNotification(pool, 'license_renewed', {
        license_key,
        customer_name: license.customer_name,
        customer_email: license.customer_email,
        product_id: license.product_id,
        plan_name: targetPlanName,
        expiry_date: newExpiry.toISOString().split('T')[0],
      }).catch(e => console.error('Renew notification error:', e));

      // 7. Return success response
      return NextResponse.json({
        success: true,
        message: `License ${license_key} renewed successfully${new_plan ? ` with plan changed to "${targetPlanName}"` : ''}`,
        data: {
          license_key: license_key,
          customer_name: license.customer_name,
          customer_email: license.customer_email,
          product_name: license.product_name,
          old_plan: license.plan,
          new_plan: targetPlanName,
          old_expiry: license.expiry_date,
          new_expiry: newExpiry.toISOString(),
          extra_days: daysToAdd,
          max_devices: planMaxDevices,
          status: 'active',
          renewed_at: new Date().toISOString()
        }
      });

    } catch (dbError) {
      console.error('[Renew] Database error:', dbError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database error occurred while renewing license',
          details: dbError.message 
        },
        { status: 500 }
      );
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[Renew] License renewal error:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to renew license. Please try again.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}
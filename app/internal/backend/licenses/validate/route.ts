// FILE: app/internal/backend/licenses/validate/route.ts
// PURPOSE: Validate a license key.
// DATABASE: Neon PostgreSQL only
// ENDPOINT: POST /internal/backend/licenses/validate
// BODY: { license_key: string, hardware_id?: string }
//
// NOTE: This endpoint ONLY validates. All DB reads and status
// derivation are delegated to the shared resolveGlobalLicenseStatus()
// service so Activation / Renewal / Validate share one source of truth.
// No independent database queries or business decisions here.
// ============================================================
// UPDATED: All status logic centralized in lib/license/serializer.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { resolveGlobalLicenseStatus } from '@/lib/license/serializer';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { license_key, hardware_id } = body;

    if (!license_key) {
      return NextResponse.json(
        { valid: false, error: 'License key is required' },
        { status: 400 },
      );
    }

    const { verdict, ctx, daysLeft } = await resolveGlobalLicenseStatus(pool, {
      licenseKey: license_key,
      hardwareId: hardware_id,
    });

    const license = ctx?.license || null;
    const httpStatus = verdict.httpStatus;
    const isAllowed = httpStatus >= 200 && httpStatus < 300;

    const responseBody: Record<string, any> = {
      valid: isAllowed,
      status: verdict.status,
      code: verdict.code,
      reason: verdict.reason,
      message: verdict.message,
      actions: verdict.actions,
      days_left: daysLeft,
    };

    // Attach product / serialized context only when allowed, mirroring the
    // previous successful shape (license details + product fields).
    if (isAllowed && license) {
      const expiryDate = license.expiry_date ? new Date(license.expiry_date) : null;
      const daysLeftLic = expiryDate
        ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;
      responseBody.license = {
        license_key: license.license_key,
        plan: license.plan,
        expiry_date: expiryDate ? expiryDate.toISOString().split('T')[0] : '',
        max_devices: license.max_devices,
        device_count: license.device_count,
        is_trial: !!license.is_trial,
        duration_days: license.duration_days,
        created_at: license.created_at,
        activated_at: license.activated_at,
        last_validated: new Date().toISOString(),
        product_id: license.product_id,
        product_name: license.product_name || '',
      };
      responseBody.customer = {
        name: license.customer_name || '',
        email: license.customer_email || '',
      };
      responseBody.plan = { name: license.plan || '' };
      responseBody.validated_at = new Date().toISOString();
    }

    return NextResponse.json(responseBody, { status: httpStatus });
  } catch (error) {
    console.error('License validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
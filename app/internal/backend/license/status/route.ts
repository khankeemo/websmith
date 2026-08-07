import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { resolveGlobalLicenseStatus } from '@/lib/license/serializer';

// ============================================================
// GET /internal/backend/license/status
// PURPOSE: Global License Status API — the single source of truth.
// Delegates all DB reads + status derivation to the shared
// resolveGlobalLicenseStatus() service. No business logic here.
// ============================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hardwareId = searchParams.get('hardware_id');

    if (!hardwareId) {
      return NextResponse.json(
        { success: false, error: 'hardware_id is required' },
        { status: 400 },
      );
    }

    const { verdict, ctx, daysLeft } = await resolveGlobalLicenseStatus(pool, {
      hardwareId,
    });

    const licenseKey = ctx?.license?.license_key || '';
    const code = verdict.code;
    const httpStatus = verdict.httpStatus;

    const body = {
      success: httpStatus >= 400 && httpStatus < 600 ? false : true,
      status: verdict.status,
      code,
      reason: verdict.reason,
      message: verdict.message,
      actions: verdict.actions,
      hardware_id: hardwareId,
      days_left: daysLeft,
    };

    const response = NextResponse.json(body, { status: httpStatus });

    // Enrich successful lookups with the same entitlement details as before
    // for dashboard/frontend compatibility, without adding business rules.
    if (ctx) {
      const det = await enrichLicense(ctx, hardwareId, licenseKey);
      if (det) {
        const finalBody = { ...body, ...det };
        return NextResponse.json(finalBody, { status: httpStatus });
      }
    }

    return response;
  } catch (error) {
    console.error('License status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// Legacy enrichment — returns the dashboard-facing shape only.
// It reads entity details, never re-derives status.
async function enrichLicense(ctx: any, hardwareId: string, licenseKey: string) {
  const row = ctx.license || ctx.trial || null;
  if (!row) {
    return {
      customer: { name: '', email: '', mobile: '' },
      license: {
        license_key: '',
        status: 'No License',
        expiry_date: '',
        days_remaining: 0,
      },
      plan: { name: '', device_limit: 1 },
      product: { name: '', product_id: '' },
      devices: { current: 0, maximum: 1 },
      hardware: { hardware_id: hardwareId, device_name: '', is_activated: false },
    };
  }

  const expiryDate = row.expiry_date ? new Date(row.expiry_date) : null;
  const daysRemaining = expiryDate && expiryDate > new Date()
    ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  const isTrial = !!ctx.trial;
  const maximum = row.plan_max_devices || row.max_devices || 1;

  return {
    customer: {
      name: row.customer_name || row.customer_name_from_customer || '',
      email: row.customer_email || row.customer_email_from_customer || '',
      mobile: row.customer_mobile || row.customer_phone || row.customer_phone_c || '',
    },
    license: {
      license_key: licenseKey || row.license_key || '',
      status: isTrial
        ? (daysRemaining > 0 ? 'Trial Active' : 'Trial Expired')
        : row.status,
      expiry_date: expiryDate ? expiryDate.toISOString().split('T')[0] : '',
      days_remaining: daysRemaining,
    },
    plan: { name: row.plan_name || row.plan || 'Trial', device_limit: maximum },
    product: { name: row.product_name || '', product_id: row.product_id || '' },
    devices: { current: row.device_count || 1, maximum },
    hardware: {
      hardware_id: hardwareId,
      device_name: row.device_name || '',
      is_activated: isTrial ? daysRemaining > 0 : true,
    },
  };
}
// FILE: app/api/portal/license/info/route.ts
// PURPOSE: Renew Portal - "Validate Existing License" + "Load Current
//          Product / Plan". Uses resolveGlobalLicenseStatus() (single source
//          of truth per Rule 1) — the route makes NO status decision itself.
//          Returns only safe, customer-owned fields (never internal IDs or
//          admin data).

import { NextRequest, NextResponse } from 'next/server';
import { getPortalDb } from '@/lib/portal/db';
import { resolveGlobalLicenseStatus } from '@/lib/license/serializer';

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const licenseKey = (body?.license_key || '').trim().toUpperCase();
  if (!licenseKey) {
    return NextResponse.json({ success: false, error: 'License key is required' }, { status: 400 });
  }

  const pool = getPortalDb();
  const { verdict, ctx } = await resolveGlobalLicenseStatus(pool, { licenseKey });

  if (!ctx?.license) {
    return NextResponse.json(
      {
        success: false,
        status: verdict.status,
        code: verdict.code,
        reason: verdict.reason,
        message: verdict.message,
        actions: verdict.actions,
      },
      { status: verdict.httpStatus }
    );
  }

  const renewable = verdict.status === 'ACTIVE' || verdict.status === 'EXPIRED';

  let daysLeft = 0;
  try {
    const exp = new Date(ctx.license.expiry_date);
    const now = new Date();
    daysLeft = Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / 86400000));
  } catch { daysLeft = 0; }

  let productPlans: any[] = [];
  try {
    const client = await pool.connect();
    try {
      const r = await client.query(
        `SELECT id, name, description, max_devices,
                default_expiry_days AS duration_days, price, is_active, is_trial_plan
         FROM plans WHERE product_id = $1
           AND COALESCE(is_active::text, 'true') IN ('true', '1')
           AND NOT COALESCE(is_trial_plan, false)
         ORDER BY display_order NULLS LAST, price ASC, id ASC`,
        [ctx.license.product_id]
      );
      productPlans = r.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('portal license/info plans error:', error);
  }

  return NextResponse.json({
    success: true,
    renewable,
    status: verdict.status,
    expiration_behavior: renewable
      ? { can_renew: true, expires_in_days: daysLeft }
      : { can_renew: false },
    license: {
      license_key: ctx.license.license_key,
      product_name: ctx.product?.name || '',
      product_id: ctx.license.product_id,
      product_logo: ctx.product?.logo_url || '',
      current_plan: { name: ctx.license.plan, price: ctx.plan?.price ?? 0 },
      expiry_date: ctx.license.expiry_date,
      days_left: daysLeft,
      customer_email: ctx.license.customer_email,
      customer_name: ctx.license.customer_name,
      max_devices: ctx.license.max_devices,
    },
    plans: productPlans,
  });
}
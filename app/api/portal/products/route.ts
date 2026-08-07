// FILE: app/api/portal/products/route.ts
// PURPOSE: Catalog for the Universal Buy & Renew Portal. Server-authoritative
//          read of active products + plans (same data as the public store,
//          filtered to safe public fields only). The portal pages NEVER hit
//          the admin products API — this is the only product source they use.

import { NextRequest, NextResponse } from 'next/server';
import { getPortalDb } from '@/lib/portal/db';

async function loadProducts(productId?: string) {
  const pool = getPortalDb();
  let client = null;

  try {
    client = await pool.connect();

    const productsResult = await client.query(
      `SELECT
         product_id AS id,
         name,
         version,
         description,
         short_description,
         logo_url,
         platform,
         featured,
         display_order,
         product_type,
         company_name,
         latest_version,
         website,
         price,
         is_active,
         EXISTS(SELECT 1 FROM plans WHERE product_id = p.product_id AND is_trial_plan = true AND is_active = true) AS has_trial
       FROM products p
       WHERE (is_deleted = false OR is_deleted IS NULL)
         AND COALESCE(is_active::text, 'true') IN ('true', '1')
         AND ($1::text IS NULL OR product_id = $1)
       ORDER BY display_order NULLS LAST, created_at DESC`,
      [productId || null]
    );

    const plansResult = await client.query(
      `SELECT
         id,
         product_id,
         name,
         description,
         max_devices,
         default_expiry_days AS duration_days,
         price,
         is_active,
         is_trial_plan,
         trial_days_limit,
         features,
         display_order
       FROM plans
       WHERE COALESCE(is_active::text, 'true') IN ('true', '1')
       ORDER BY display_order NULLS LAST, id ASC`
    );

    const plansByProduct: Record<string, any[]> = {};
    plansResult.rows.forEach((plan: any) => {
      if (!plansByProduct[plan.product_id]) plansByProduct[plan.product_id] = [];
      plansByProduct[plan.product_id].push(plan);
    });

    return productsResult.rows
      .map((product: any) => ({
        ...product,
        is_active: product.is_active === true || product.is_active === 1,
        has_trial: product.has_trial === true || product.has_trial === 1,
        plans: plansByProduct[product.id] || [],
      }))
      .filter((product: any) => product.plans.length > 0);
  } catch (error) {
    console.error('loadPortalProducts error:', error);
    return null;
  } finally {
    if (client) client.release();
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('id');
  const products = await loadProducts(productId || undefined);
  if (!products) {
    return NextResponse.json({ success: false, error: 'Failed to load products' }, { status: 500 });
  }
  return NextResponse.json({ success: true, products });
}

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch { /* ignore invalid JSON */ }
  const productId = body?.product_id || body?.id;
  const products = await loadProducts(productId || undefined);
  if (!products) {
    return NextResponse.json({ success: false, error: 'Failed to load products' }, { status: 500 });
  }
  return NextResponse.json({ success: true, products });
}

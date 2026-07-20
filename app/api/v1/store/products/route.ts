import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fetchProducts(productId?: string) {
  let client = null;
  try {
    client = await pool.connect();

    let productsQuery: string;
    let productsParams: any[] = [];

    if (productId) {
      productsQuery = `
        SELECT
          product_id as id,
          name,
          version,
          description,
          short_description,
          logo_url,
          platform,
          docs_url,
          support_url,
          featured,
          display_order,
          product_type,
          company_name,
          latest_version,
          website,
          price,
          is_active,
          created_at,
          updated_at,
          EXISTS(SELECT 1 FROM plans WHERE product_id = p.product_id AND is_trial_plan = true AND is_active = true) as has_trial
        FROM products p
        WHERE (is_deleted = false OR is_deleted IS NULL)
          AND COALESCE(is_active::text, 'true') IN ('true', '1')
          AND product_id = $1
        ORDER BY display_order NULLS LAST, created_at DESC
      `;
      productsParams = [productId];
    } else {
      productsQuery = `
        SELECT
          product_id as id,
          name,
          version,
          description,
          short_description,
          logo_url,
          platform,
          docs_url,
          support_url,
          featured,
          display_order,
          product_type,
          company_name,
          latest_version,
          website,
          price,
          is_active,
          created_at,
          updated_at,
          EXISTS(SELECT 1 FROM plans WHERE product_id = p.product_id AND is_trial_plan = true AND is_active = true) as has_trial
        FROM products p
        WHERE (is_deleted = false OR is_deleted IS NULL)
          AND COALESCE(is_active::text, 'true') IN ('true', '1')
        ORDER BY display_order NULLS LAST, created_at DESC
      `;
    }

    const productsResult = await client.query(productsQuery, productsParams);

    const plansResult = await client.query(`
      SELECT
        id,
        product_id,
        name,
        description,
        max_devices,
        default_expiry_days as duration_days,
        price,
        is_active,
        is_trial_plan,
        trial_days_limit,
        features,
        display_order
      FROM plans
      WHERE COALESCE(is_active::text, 'true') IN ('true', '1')
      ORDER BY display_order NULLS LAST, id ASC
    `);

    client.release();
    client = null;

    const plansByProduct: Record<string, any[]> = {};
    plansResult.rows.forEach((plan) => {
      if (!plansByProduct[plan.product_id]) plansByProduct[plan.product_id] = [];
      plansByProduct[plan.product_id].push(plan);
    });

    const products = productsResult.rows
      .map((product) => ({
        ...product,
        is_active: product.is_active === true || product.is_active === 1,
        has_trial: product.has_trial === true || product.has_trial === 1,
        plans: plansByProduct[product.id] || [],
      }))
      .filter((product) => product.plans.length > 0);

    return { success: true, products };
  } catch (error) {
    console.error("fetchProducts error:", error);
    if (client) client.release();
    return { success: false, products: [] };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("id");
  const result = await fetchProducts(productId || undefined);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // ignore invalid JSON
  }
  const action = body?.action;
  if (action && action !== "list") {
    return NextResponse.json(
      { success: false, message: `Invalid action: ${action}. Supported actions: list` },
      { status: 400 }
    );
  }
  const productId = body?.product_id || undefined;
  const result = await fetchProducts(productId);
  return NextResponse.json(result);
}

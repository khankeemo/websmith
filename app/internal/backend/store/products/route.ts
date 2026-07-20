import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  let client = null;

  try {
    client = await pool.connect();

    const productsResult = await client.query(`
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
        EXISTS(SELECT 1 FROM plans WHERE product_id = p.product_id AND is_trial_plan = true AND is_active = true) as has_trial
      FROM products p
      WHERE (is_deleted = false OR is_deleted IS NULL)
        AND COALESCE(is_active::text, 'true') IN ('true', '1')
      ORDER BY display_order NULLS LAST, created_at DESC
    `);

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

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error("GET /internal/backend/store/products error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Failed to fetch store products" },
      { status: 500 }
    );
  }
}

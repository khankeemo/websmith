import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const isActive = searchParams.get("is_active");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = `SELECT * FROM coupons WHERE 1=1`;
    const params: any[] = [];

    if (code) { params.push(code); query += ` AND code = $${params.length}`; }
    if (isActive) { params.push(isActive === "true"); query += ` AND is_active = $${params.length}`; }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const countResult = await db.query(`SELECT COUNT(*) FROM coupons WHERE 1=1`);

    return NextResponse.json({
      success: true,
      coupons: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /store/coupons error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch coupons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();

    const result = await db.query(
      `INSERT INTO coupons (code, description, discount_type, discount_value, min_purchase_amount, max_uses, max_uses_per_customer, applies_to_product_id, applies_to_plan_id, starts_at, expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        body.code,
        body.description || null,
        body.discount_type || "percentage",
        body.discount_value,
        body.min_purchase_amount || 0,
        body.max_uses || 0,
        body.max_uses_per_customer || 1,
        body.applies_to_product_id || null,
        body.applies_to_plan_id || null,
        body.starts_at || null,
        body.expires_at || null,
        body.is_active !== false,
      ]
    );

    return NextResponse.json({ success: true, coupon: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (error.code === "23505") {
      return NextResponse.json({ success: false, error: "Coupon code already exists" }, { status: 409 });
    }
    console.error("POST /store/coupons error:", error);
    return NextResponse.json({ success: false, error: "Failed to create coupon" }, { status: 500 });
  }
}

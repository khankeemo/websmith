import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = `SELECT * FROM subscriptions WHERE 1=1`;
    const params: any[] = [];

    if (email) { params.push(email); query += ` AND customer_email = $${params.length}`; }
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const countResult = await db.query(`SELECT COUNT(*) FROM subscriptions WHERE 1=1`);

    return NextResponse.json({
      success: true,
      subscriptions: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /store/subscriptions error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch subscriptions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();

    const result = await db.query(
      `INSERT INTO subscriptions (customer_email, product_id, plan_id, status, current_period_start, current_period_end, trial_end, payment_gateway, gateway_subscription_id, next_billing_date, amount, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        body.customer_email,
        body.product_id,
        body.plan_id,
        body.status || "active",
        body.current_period_start || null,
        body.current_period_end || null,
        body.trial_end || null,
        body.payment_gateway || null,
        body.gateway_subscription_id || null,
        body.next_billing_date || null,
        body.amount || 0,
        body.currency || "USD",
      ]
    );

    return NextResponse.json({ success: true, subscription: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /store/subscriptions error:", error);
    return NextResponse.json({ success: false, error: "Failed to create subscription" }, { status: 500 });
  }
}

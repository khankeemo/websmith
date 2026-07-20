import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { generateOrderNumber } from "@/lib/store";

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = `SELECT * FROM orders WHERE 1=1`;
    const params: any[] = [];

    if (email) { params.push(email); query += ` AND customer_email = $${params.length}`; }
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const countResult = await db.query(`SELECT COUNT(*) FROM orders WHERE 1=1`);

    return NextResponse.json({
      success: true,
      orders: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /store/orders error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const orderNumber = generateOrderNumber();

    const result = await db.query(
      `INSERT INTO orders (order_number, customer_email, customer_name, status, subtotal, discount, tax, total, currency, coupon_code, payment_gateway, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        orderNumber,
        body.customer_email,
        body.customer_name || null,
        body.status || "pending",
        body.subtotal || 0,
        body.discount || 0,
        body.tax || 0,
        body.total || 0,
        body.currency || "USD",
        body.coupon_code || null,
        body.payment_gateway || null,
        body.notes || null,
      ]
    );

    return NextResponse.json({ success: true, order: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /store/orders error:", error);
    return NextResponse.json({ success: false, error: "Failed to create order" }, { status: 500 });
  }
}

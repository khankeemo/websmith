// FILE: app/api/v1/checkout/orders/route.ts
// PURPOSE: Public purchase history lookup — returns every order placed with a
//          given billing email, including order items, payments and the
//          generated licenses. Used by the Software Store "Purchase History"
//          panel (email-based lookup — no auth, same as public checkout).
// ACCESS: Public (Software Store)

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";

export async function GET(request: NextRequest) {
  const email = (request.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "A valid email is required" }, { status: 400 });
  }

  let client = null;
  try {
    client = await (await getDb()).connect();

    const ordersResult = await client.query(
      `SELECT id, order_number, customer_email, customer_name, status, subtotal, discount, tax,
              total, currency, coupon_code, payment_gateway, payment_intent_id, paid_at, notes, created_at
       FROM orders
       WHERE LOWER(customer_email) = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [email]
    );
    const orders = ordersResult.rows;

    if (orders.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({ success: true, orders: [] });
    }

    const orderIds = orders.map((o: any) => o.id);

    const itemsResult = await client.query(
      `SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id ASC`,
      [orderIds]
    );
    const itemsByOrder: Record<number, any[]> = {};
    for (const it of itemsResult.rows) {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(it);
    }

    const paymentsResult = await client.query(
      `SELECT id, payment_number, order_id, order_number, gateway, transaction_id, method,
              amount, currency, status, paid_at, created_at
       FROM payments WHERE order_id = ANY($1) ORDER BY created_at ASC`,
      [orderIds]
    );
    const paymentsByOrder: Record<number, any[]> = {};
    for (const p of paymentsResult.rows) {
      if (!paymentsByOrder[p.order_id]) paymentsByOrder[p.order_id] = [];
      paymentsByOrder[p.order_id].push(p);
    }

    const licensesResult = await client.query(
      `SELECT license_key, product_id, product_name, plan_name, status, expiry_date, created_at
       FROM licenses
       WHERE customer_email = $1
       ORDER BY created_at DESC`,
      [email]
    );

    client.release();
    client = null;

    const enriched = orders.map((o: any) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
      payments: paymentsByOrder[o.id] || [],
      licenses: licensesResult.rows.filter((l: any) =>
        (itemsByOrder[o.id] || []).some((it: any) => it.product_id === l.product_id)
      ),
    }));

    return NextResponse.json({ success: true, orders: enriched });
  } catch (error) {
    console.error("GET /api/v1/checkout/orders error:", error);
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to load purchase history" }, { status: 500 });
  }
}

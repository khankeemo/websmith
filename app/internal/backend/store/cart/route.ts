import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "session_id is required" }, { status: 400 });
    }

    const cartResult = await db.query(
      `SELECT * FROM carts WHERE session_id = $1`,
      [sessionId]
    );

    if (cartResult.rows.length === 0) {
      return NextResponse.json({ success: true, cart: null, items: [] });
    }

    const cart = cartResult.rows[0];
    const itemsResult = await db.query(
      `SELECT ci.*, p.name as product_name, pl.name as plan_name, pl.price
       FROM cart_items ci
       LEFT JOIN products p ON ci.product_id = p.product_id
       LEFT JOIN plans pl ON ci.plan_id = pl.id
       WHERE ci.cart_id = $1`,
      [cart.id]
    );

    return NextResponse.json({ success: true, cart, items: itemsResult.rows });
  } catch (error) {
    console.error("GET /store/cart error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch cart" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();

    let cart = await db.query(
      `SELECT * FROM carts WHERE session_id = $1`,
      [body.session_id]
    );

    let cartId: number;
    if (cart.rows.length === 0) {
      const newCart = await db.query(
        `INSERT INTO carts (session_id, customer_email, coupon_code) VALUES ($1, $2, $3) RETURNING *`,
        [body.session_id, body.customer_email || null, body.coupon_code || null]
      );
      cartId = newCart.rows[0].id;
    } else {
      cartId = cart.rows[0].id;
      if (body.coupon_code !== undefined) {
        await db.query(`UPDATE carts SET coupon_code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [body.coupon_code, cartId]);
      }
    }

    if (body.product_id && body.plan_id) {
      await db.query(
        `INSERT INTO cart_items (cart_id, product_id, plan_id, quantity) VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [cartId, body.product_id, body.plan_id, body.quantity || 1]
      );
    }

    const itemsResult = await db.query(
      `SELECT ci.*, p.name as product_name, pl.name as plan_name, pl.price
       FROM cart_items ci
       LEFT JOIN products p ON ci.product_id = p.product_id
       LEFT JOIN plans pl ON ci.plan_id = pl.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    return NextResponse.json({ success: true, cart_id: cartId, items: itemsResult.rows }, { status: 201 });
  } catch (error) {
    console.error("POST /store/cart error:", error);
    return NextResponse.json({ success: false, error: "Failed to manage cart" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const itemId = searchParams.get("item_id");

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "session_id is required" }, { status: 400 });
    }

    const cartResult = await db.query(`SELECT id FROM carts WHERE session_id = $1`, [sessionId]);
    if (cartResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Cart not found" }, { status: 404 });
    }

    if (itemId) {
      await db.query(`DELETE FROM cart_items WHERE id = $1 AND cart_id = $2`, [itemId, cartResult.rows[0].id]);
    } else {
      await db.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartResult.rows[0].id]);
      await db.query(`DELETE FROM carts WHERE id = $1`, [cartResult.rows[0].id]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /store/cart error:", error);
    return NextResponse.json({ success: false, error: "Failed to clear cart" }, { status: 500 });
  }
}

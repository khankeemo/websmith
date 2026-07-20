// FILE: app/internal/backend/admin/cleanup/route.ts
// PURPOSE: Database cleanup - remove all customers and associated records
// SCOPE: Full cascade delete of all associated records

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const cleanupKey = request.headers.get("x-cleanup-key") || "";
    const validKey = process.env.CLEANUP_SECRET_KEY || "";
    if (!cleanupKey || cleanupKey !== validKey) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - provide valid x-cleanup-key" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const wipeAll = body.wipe_all === true || request.nextUrl.searchParams.get("wipe_all") === "true";
    if (!wipeAll) {
      return NextResponse.json(
        { success: false, error: "Must pass { wipe_all: true } in body or ?wipe_all=true in query" },
        { status: 400 }
      );
    }

    client = await pool.connect();
    await client.query("BEGIN");

    // 1. Wishlist
    await client.query(`DELETE FROM wishlist`);

    // 2. Cart items (via cart FK)
    await client.query(`DELETE FROM cart_items`);

    // 3. Carts
    await client.query(`DELETE FROM carts`);

    // 4. Invoices
    await client.query(`DELETE FROM invoices`);

    // 5. Subscriptions
    await client.query(`DELETE FROM subscriptions`);

    // 6. Order items (via orders FK)
    await client.query(`DELETE FROM order_items`);

    // 7. Orders
    await client.query(`DELETE FROM orders`);

    // 8. Customer licenses junction
    await client.query(`DELETE FROM customer_licenses`);

    // 9. Trials
    await client.query(`DELETE FROM trials`);

    // 10. Renewal history
    await client.query(`DELETE FROM renewal_history`);

    // 11. License hardware
    await client.query(`DELETE FROM license_hardware`);

    // 12. License bindings
    await client.query(`DELETE FROM license_bindings`);

    // 13. Activations
    await client.query(`DELETE FROM activations`);

    // 14. Licenses
    await client.query(`DELETE FROM licenses`);

    // 15. Customers
    const deleteCustomers = await client.query(`DELETE FROM customers RETURNING email`);
    const deletedEmails = deleteCustomers.rows.map(r => r.email);

    // 16. Keep only first 2 products by name
    const keepProducts = (await client.query(
      `SELECT product_id FROM products ORDER BY name ASC LIMIT 2`
    )).rows.map(r => r.product_id);

    if (keepProducts.length > 0) {
      const placeholders = keepProducts.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(
        `DELETE FROM plans WHERE product_id NOT IN (${placeholders})`,
        keepProducts
      );
      await client.query(
        `DELETE FROM wishlist WHERE product_id NOT IN (${placeholders})`,
        keepProducts
      );
      await client.query(
        `DELETE FROM products WHERE product_id NOT IN (${placeholders})`,
        keepProducts
      );
    }

    await client.query("COMMIT");
    client.release();

    return NextResponse.json({
      success: true,
      message: `Wipe complete. Deleted ${deletedEmails.length} customers. Kept ${keepProducts.length} products.`,
      total_customers_deleted: deletedEmails.length,
      products_kept: keepProducts,
    });
  } catch (error) {
    if (client) {
      try { await client.query("ROLLBACK"); client.release(); } catch {}
    }
    console.error("Wipe error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Wipe failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  let client = null;
  try {
    const cleanupKey = request.headers.get("x-cleanup-key") || "";
    const validKey = process.env.CLEANUP_SECRET_KEY || "";
    if (!cleanupKey || cleanupKey !== validKey) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    client = await pool.connect();

    const customersCount = await client.query(`SELECT COUNT(*) as count FROM customers`);
    const licensesCount = await client.query(`SELECT COUNT(*) as count FROM licenses`);
    const trialsCount = await client.query(`SELECT COUNT(*) as count FROM trials`);
    const totalProducts = await client.query(`SELECT COUNT(*) as count FROM products`);

    client.release();

    return NextResponse.json({
      success: true,
      customers: parseInt(customersCount.rows[0].count),
      licenses: parseInt(licensesCount.rows[0].count),
      trials: parseInt(trialsCount.rows[0].count),
      products: parseInt(totalProducts.rows[0].count),
    });
  } catch (error) {
    if (client) try { client.release(); } catch {}
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}

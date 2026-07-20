import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { generateInvoiceNumber } from "@/lib/store";

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = `SELECT * FROM invoices WHERE 1=1`;
    const params: any[] = [];

    if (email) { params.push(email); query += ` AND customer_email = $${params.length}`; }
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const countResult = await db.query(`SELECT COUNT(*) FROM invoices WHERE 1=1`);

    return NextResponse.json({
      success: true,
      invoices: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /store/invoices error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch invoices" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const invoiceNumber = generateInvoiceNumber();

    const result = await db.query(
      `INSERT INTO invoices (invoice_number, order_id, subscription_id, customer_email, status, amount, tax, total, currency, gateway_invoice_id, pdf_url, paid_at, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        invoiceNumber,
        body.order_id || null,
        body.subscription_id || null,
        body.customer_email,
        body.status || "draft",
        body.amount || 0,
        body.tax || 0,
        body.total || 0,
        body.currency || "USD",
        body.gateway_invoice_id || null,
        body.pdf_url || null,
        body.paid_at || null,
        body.due_date || null,
      ]
    );

    return NextResponse.json({ success: true, invoice: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /store/invoices error:", error);
    return NextResponse.json({ success: false, error: "Failed to create invoice" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { name, email, company, phone, country, state, city, address, notes, items, total } = body;

    if (!name || !email) {
      return NextResponse.json({ success: false, error: "Name and email are required" }, { status: 400 });
    }

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO sales_enquiries (product_name, selected_plan, full_name, email, company, phone, message, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        items?.[0]?.product?.name || "Software Store Order",
        items?.[0]?.plan?.name || null,
        name,
        email,
        company || null,
        phone || null,
        notes || `Order from ${name} (${email})`,
        JSON.stringify({ country, state, city, address, items, total }),
      ]
    );

    client.release();
    return NextResponse.json({ success: true, enquiryId: result.rows[0].id });
  } catch (error) {
    console.error("POST /api/v1/store/enquiries error:", error);
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to submit enquiry" }, { status: 500 });
  }
}

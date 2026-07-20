import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.query(
      `SELECT * FROM payment_gateways ORDER BY name ASC`
    );
    return NextResponse.json({ success: true, gateways: result.rows });
  } catch (error) {
    console.error("GET /store/gateways error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch gateways" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();

    const existing = await db.query(
      `SELECT * FROM payment_gateways WHERE name = $1`,
      [body.name]
    );

    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE payment_gateways SET display_name = $1, is_active = $2, config = $3, supported_currencies = $4, updated_at = CURRENT_TIMESTAMP WHERE name = $5 RETURNING *`,
        [body.display_name, body.is_active, JSON.stringify(body.config || {}), body.supported_currencies || ["USD"], body.name]
      );
      return NextResponse.json({ success: true, gateway: result.rows[0] });
    } else {
      const result = await db.query(
        `INSERT INTO payment_gateways (name, display_name, is_active, config, supported_currencies) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [body.name, body.display_name, body.is_active || false, JSON.stringify(body.config || {}), body.supported_currencies || ["USD"]]
      );
      return NextResponse.json({ success: true, gateway: result.rows[0] }, { status: 201 });
    }
  } catch (error) {
    console.error("PUT /store/gateways error:", error);
    return NextResponse.json({ success: false, error: "Failed to update gateway" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { SUPPORTED_GATEWAYS } from "@/lib/store";

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.query(`SELECT * FROM payment_gateways ORDER BY name ASC`);
    return NextResponse.json({ success: true, gateways: result.rows });
  } catch (error) {
    console.error("GET /admin/store/gateways error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch gateways" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const db = await getDb();
    for (const gw of SUPPORTED_GATEWAYS) {
      await db.query(
        `INSERT INTO payment_gateways (name, display_name, is_active, config, supported_currencies)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO NOTHING`,
        [gw.name, gw.displayName, gw.isActive, "{}", gw.supportedCurrencies]
      );
    }
    const result = await db.query(`SELECT * FROM payment_gateways ORDER BY name ASC`);
    return NextResponse.json({ success: true, message: "Gateways initialized", gateways: result.rows });
  } catch (error) {
    console.error("POST /admin/store/gateways error:", error);
    return NextResponse.json({ success: false, error: "Failed to initialize gateways" }, { status: 500 });
  }
}

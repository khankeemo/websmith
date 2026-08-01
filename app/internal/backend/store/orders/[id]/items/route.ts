import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: "Invalid order ID" }, { status: 400 });
    }

    const result = await db.query(
      `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`,
      [orderId]
    );

    return NextResponse.json({
      success: true,
      items: result.rows,
    });
  } catch (error) {
    console.error("GET /store/orders/[id]/items error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch order items" }, { status: 500 });
  }
}
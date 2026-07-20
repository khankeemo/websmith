import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { triggerNotification } from "@/lib/notification/notification-service";
import { validateEmail } from "@/core/utils/validation-system";

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();

    const { product_name, selected_plan, product_version, full_name, email, mobile, company, country, requirements } = body;

    if (!product_name || !full_name || !email || !mobile) {
      return NextResponse.json({ success: false, error: "Missing required fields: product_name, full_name, email, mobile" }, { status: 400 });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ success: false, error: emailValidation.errors[0]?.message || "Invalid email address" }, { status: 400 });
    }

    const client = await db.connect();
    try {
      const result = await client.query(
        `INSERT INTO sales_enquiries (product_name, selected_plan, product_version, full_name, email, mobile, company, country, requirements)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [product_name, selected_plan || null, product_version || null, full_name, email.toLowerCase().trim(), mobile, company || null, country || null, requirements || null]
      );

      const enquiry = result.rows[0];

      try {
        await triggerNotification(db, 'admin_notification', {
          customer_name: full_name,
          customer_email: email,
          customer_phone: mobile,
          product_name,
          plan_name: selected_plan || '',
          product_version: product_version || '',
          company: company || '',
          admin_message: `New sales enquiry from ${full_name} (${email}) for ${product_name}${selected_plan ? ` - ${selected_plan}` : ''}`,
        });
      } catch (notifError) {
        console.error('Failed to send admin notification for enquiry:', notifError);
      }

      try {
        await triggerNotification(db, 'welcome_customer', {
          customer_name: full_name,
          customer_email: email,
          customer_phone: mobile,
          product_name,
          plan_name: selected_plan || '',
          product_version: product_version || '',
          company: company || '',
          order_number: `ENQ-${enquiry.id}`,
        });
      } catch (notifError) {
        console.error('Failed to send customer confirmation for enquiry:', notifError);
      }

      return NextResponse.json({ success: true, data: enquiry }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /store/enquiries error:", error);
    return NextResponse.json({ success: false, error: "Failed to create enquiry" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let query = `SELECT * FROM sales_enquiries`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return NextResponse.json({ success: true, enquiries: result.rows });
  } catch (error) {
    console.error("GET /store/enquiries error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch enquiries" }, { status: 500 });
  }
}

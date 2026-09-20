import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { triggerNotification } from "@/lib/notification/notification-service";
import { sendEmail } from "@/lib/email/mailer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const result = await db.query(`SELECT * FROM invoices WHERE id = $1 OR invoice_number = $1`, [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, invoice: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const body = await req.json();

    const fields = [
      'customer_email', 'customer_name', 'status', 'amount', 'tax', 'total',
      'currency', 'due_date', 'template_name', 'is_gst', 'company_gstin',
      'customer_gstin', 'hsn_sac', 'cgst', 'sgst', 'igst',
      'company_name', 'company_address', 'company_contact', 'company_website',
      'company_email', 'customer_mobile', 'customer_address',
      'product_name', 'plan_name', 'license_key', 'quantity', 'unit_price',
      'discount_amount', 'discount_type', 'payment_method', 'transaction_id',
      'notes', 'terms', 'order_number', 'paper_format', 'paid_at', 'gateway_invoice_id'
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const field of fields) {
      if (body[field] !== undefined) {
        setClauses.push(`${field} = $${idx}`);
        values.push(body[field]);
        idx++;
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(
      `UPDATE invoices SET ${setClauses.join(', ')} WHERE id = $${idx} OR invoice_number = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, invoice: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const result = await db.query(`DELETE FROM invoices WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, invoice: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Actions: send-email, mark-paid, generate-license, archive
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const body = await req.json();
    const { action } = body;

    const invoiceResult = await db.query(`SELECT * FROM invoices WHERE id = $1`, [id]);
    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }
    const invoice = invoiceResult.rows[0];

    switch (action) {
      case 'send-email': {
        const emailTo = body.email || invoice.customer_email;
        if (!emailTo) {
          return NextResponse.json({ success: false, error: "No customer email" }, { status: 400 });
        }
        try {
          await triggerNotification(db, 'payment_success', {
            customer_name: invoice.customer_name || '',
            customer_email: emailTo,
            product_name: invoice.product_name || '',
            plan_name: invoice.plan_name || '',
            license_key: invoice.license_key || '',
            amount: invoice.total?.toString() || '0',
            order_number: invoice.invoice_number || '',
            customer_phone: invoice.customer_mobile || '',
          });
          await db.query(`UPDATE invoices SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        } catch (notifErr) {
          return NextResponse.json({ success: false, error: String(notifErr) }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "Invoice email sent" });
      }

      case 'mark-paid': {
        await db.query(
          `UPDATE invoices SET status = 'paid', paid_at = $1, payment_method = $2, transaction_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
          [body.paid_at || new Date().toISOString(), body.payment_method || invoice.payment_method, body.transaction_id || invoice.transaction_id, id]
        );
        return NextResponse.json({ success: true, message: "Invoice marked as paid" });
      }

      case 'generate-license': {
        if (!invoice.license_key) {
          return NextResponse.json({ success: false, error: "No license key on this invoice" }, { status: 400 });
        }
        return NextResponse.json({ success: true, license_key: invoice.license_key });
      }

      case 'cancel': {
        await db.query(`UPDATE invoices SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        return NextResponse.json({ success: true, message: "Invoice cancelled" });
      }

      case 'archive': {
        await db.query(`UPDATE invoices SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        return NextResponse.json({ success: true, message: "Invoice archived" });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

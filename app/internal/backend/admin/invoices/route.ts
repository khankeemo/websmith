import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { triggerNotification } from "@/lib/notification/notification-service";

const INVOICE_NUMBER_PREFIX = 'INV-';

function generateInvoiceNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${INVOICE_NUMBER_PREFIX}${ts}-${rand}`;
}

async function ensureInvoiceColumns(db: any) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      order_id INTEGER,
      subscription_id INTEGER,
      customer_email TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      amount DECIMAL(12,2) DEFAULT 0,
      tax DECIMAL(12,2) DEFAULT 0,
      total DECIMAL(12,2) DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      gateway_invoice_id TEXT,
      pdf_url TEXT,
      paid_at TIMESTAMP,
      due_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const newColumns: [string, string][] = [
    ['template_name', "TEXT DEFAULT 'modern-corporate'"],
    ['is_gst', 'BOOLEAN DEFAULT FALSE'],
    ['company_gstin', "TEXT DEFAULT ''"],
    ['customer_gstin', "TEXT DEFAULT ''"],
    ['hsn_sac', "TEXT DEFAULT ''"],
    ['cgst', 'DECIMAL(12,2) DEFAULT 0'],
    ['sgst', 'DECIMAL(12,2) DEFAULT 0'],
    ['igst', 'DECIMAL(12,2) DEFAULT 0'],
    ['company_name', "TEXT DEFAULT ''"],
    ['company_address', "TEXT DEFAULT ''"],
    ['company_contact', "TEXT DEFAULT ''"],
    ['company_website', "TEXT DEFAULT ''"],
    ['company_email', "TEXT DEFAULT ''"],
    ['customer_name', "TEXT DEFAULT ''"],
    ['customer_mobile', "TEXT DEFAULT ''"],
    ['customer_address', "TEXT DEFAULT ''"],
    ['product_name', "TEXT DEFAULT ''"],
    ['plan_name', "TEXT DEFAULT ''"],
    ['license_key', "TEXT DEFAULT ''"],
    ['quantity', 'INTEGER DEFAULT 1'],
    ['unit_price', 'DECIMAL(12,2) DEFAULT 0'],
    ['discount_amount', 'DECIMAL(12,2) DEFAULT 0'],
    ['discount_type', "TEXT DEFAULT 'percentage'"],
    ['payment_method', "TEXT DEFAULT ''"],
    ['transaction_id', "TEXT DEFAULT ''"],
    ['notes', "TEXT DEFAULT ''"],
    ['terms', "TEXT DEFAULT ''"],
    ['order_number', "TEXT DEFAULT ''"],
    ['paper_format', "TEXT DEFAULT 'a4'"],
  ];
  for (const [col, def] of newColumns) {
    try {
      await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ${col} ${def}`);
    } catch {}
  }
}

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    await ensureInvoiceColumns(db);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `SELECT * FROM invoices WHERE 1=1`;
    const params: any[] = [];

    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (customer_name ILIKE $${params.length} OR customer_email ILIKE $${params.length} OR invoice_number ILIKE $${params.length} OR order_number ILIKE $${params.length})`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const countResult = await db.query(`SELECT COUNT(*) FROM invoices WHERE 1=1`);

    return NextResponse.json({
      success: true,
      invoices: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit, offset,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    await ensureInvoiceColumns(db);
    const body = await req.json();
    const invoiceNumber = generateInvoiceNumber();

    const result = await db.query(
      `INSERT INTO invoices (
        invoice_number, customer_email, customer_name, status,
        amount, tax, total, currency, due_date,
        template_name, is_gst, company_gstin, customer_gstin,
        hsn_sac, cgst, sgst, igst,
        company_name, company_address, company_contact, company_website, company_email,
        customer_mobile, customer_address,
        product_name, plan_name, license_key, quantity, unit_price,
        discount_amount, discount_type, payment_method, transaction_id,
        notes, terms, order_number, paper_format
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
      RETURNING *`,
      [
        invoiceNumber,
        body.customer_email, body.customer_name || '', body.status || 'draft',
        body.amount || 0, body.tax || 0, body.total || 0, body.currency || 'USD', body.due_date || null,
        body.template_name || 'modern-corporate', body.is_gst || false,
        body.company_gstin || '', body.customer_gstin || '',
        body.hsn_sac || '', body.cgst || 0, body.sgst || 0, body.igst || 0,
        body.company_name || '', body.company_address || '', body.company_contact || '',
        body.company_website || '', body.company_email || '',
        body.customer_mobile || '', body.customer_address || '',
        body.product_name || '', body.plan_name || '', body.license_key || '',
        body.quantity || 1, body.unit_price || 0,
        body.discount_amount || 0, body.discount_type || 'percentage',
        body.payment_method || '', body.transaction_id || '',
        body.notes || '', body.terms || '', body.order_number || '', body.paper_format || 'a4',
      ]
    );

    return NextResponse.json({ success: true, invoice: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

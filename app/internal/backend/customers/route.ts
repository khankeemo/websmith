import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateCustomerInput, validateCustomerName, validateEmail, validateMobile, validateCompany, validateCountry, validateNotes, validatePaginationParams } from '@/core/utils/validation-system';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: NextRequest) {
  let client = null;
  try {
    client = await pool.connect();
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const status = searchParams.get('status') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    let conditions: string[] = [];
    let params: any[] = [];
    let pc = 1;

    if (q) {
      conditions.push(`(c.name ILIKE $${pc} OR c.email ILIKE $${pc} OR c.phone ILIKE $${pc} OR c.company ILIKE $${pc} OR EXISTS (SELECT 1 FROM licenses l WHERE l.customer_email = c.email AND l.license_key ILIKE $${pc}))`);
      params.push(`%${q}%`);
      pc++;
    }
    if (status) {
      conditions.push(`c.status = $${pc}`);
      params.push(status);
      pc++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await client.query(`SELECT COUNT(*) FROM customers c ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const result = await client.query(
      `SELECT c.*, COALESCE(lc.license_count, 0) as license_count, COALESCE(lk.license_keys, ARRAY[]::TEXT[]) as license_keys
       FROM customers c
       LEFT JOIN (SELECT customer_email, COUNT(*) as license_count FROM licenses GROUP BY customer_email) lc ON lc.customer_email = c.email
       LEFT JOIN (SELECT customer_email, ARRAY_AGG(license_key) as license_keys FROM licenses GROUP BY customer_email) lk ON lk.customer_email = c.email
       ${where}
       ORDER BY c.created_at DESC LIMIT $${pc} OFFSET $${pc + 1}`,
      [...params, limit, offset]
    );

    client.release();

    return NextResponse.json({
      success: true,
      data: result.rows,
      total,
      limit,
      offset,
      has_more: offset + limit < total
    });

  } catch (error) {
    console.error("Customers error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Failed to fetch customers", data: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { email, name, phone, company, country, notes } = body;

    const validation = await validateCustomerInput(pool, body, true);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0].message, errors: validation.errors },
        { status: 400 }
      );
    }

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO customers (email, name, phone, company, country, mobile, alternative_mobile, address_line1, address_line2, city, state, postal_code, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (email) DO UPDATE SET
         name = COALESCE($2, customers.name),
         phone = COALESCE($3, customers.phone),
         company = COALESCE($4, customers.company),
         country = COALESCE($5, customers.country),
         mobile = COALESCE($6, customers.mobile),
         alternative_mobile = COALESCE($7, customers.alternative_mobile),
         address_line1 = COALESCE($8, customers.address_line1),
         address_line2 = COALESCE($9, customers.address_line2),
         city = COALESCE($10, customers.city),
         state = COALESCE($11, customers.state),
         postal_code = COALESCE($12, customers.postal_code),
         notes = COALESCE($13, customers.notes),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [validation.data.email, validation.data.name, validation.data.mobile, validation.data.company, validation.data.country, validation.data.mobile, validation.data.alternative_mobile, validation.data.address_line1, validation.data.address_line2, validation.data.city, validation.data.state, validation.data.postal_code, validation.data.notes]
    );
    client.release();

    return NextResponse.json({ success: true, customer: result.rows[0] });

  } catch (error) {
    console.error("POST customer error:", error);
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to create customer" }, { status: 500 });
  }
}
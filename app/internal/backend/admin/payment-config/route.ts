import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  let client = null;
  try {
    client = await pool.connect();

    await client.query(`CREATE TABLE IF NOT EXISTS payment_config (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      provider TEXT DEFAULT 'stripe',
      api_key TEXT DEFAULT '',
      webhook_secret TEXT DEFAULT '',
      environment TEXT DEFAULT 'test',
      currency TEXT DEFAULT 'USD',
      tax_rate DECIMAL(5,2) DEFAULT 0,
      tax_name TEXT DEFAULT 'VAT',
      invoice_prefix TEXT DEFAULT 'INV-',
      payment_status TEXT DEFAULT 'pending',
      test_mode BOOLEAN DEFAULT TRUE,
      razorpay_key TEXT DEFAULT '',
      razorpay_secret TEXT DEFAULT '',
      stripe_publishable_key TEXT DEFAULT '',
      paypal_client_id TEXT DEFAULT '',
      paypal_secret TEXT DEFAULT '',
      phonepe_merchant_id TEXT DEFAULT '',
      phonepe_salt_key TEXT DEFAULT '',
      cashfree_app_id TEXT DEFAULT '',
      cashfree_secret_key TEXT DEFAULT '',
      enabled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const r = await client.query(`SELECT * FROM payment_config WHERE id = 1`);
    if (r.rows.length === 0) {
      await client.query(
        `INSERT INTO payment_config (id, provider, enabled) VALUES (1, 'stripe', false)`
      );
      const r2 = await client.query(`SELECT * FROM payment_config WHERE id = 1`);
      client.release();
      return NextResponse.json({ success: true, config: r2.rows[0] });
    }

    client.release();
    return NextResponse.json({ success: true, config: r.rows[0] });
  } catch (error: any) {
    if (client) client.release();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const {
      provider, api_key, webhook_secret, environment, currency,
      tax_rate, tax_name, invoice_prefix, payment_status, test_mode,
      razorpay_key, razorpay_secret, stripe_publishable_key,
      paypal_client_id, paypal_secret,
      phonepe_merchant_id, phonepe_salt_key,
      cashfree_app_id, cashfree_secret_key,
      enabled
    } = body;

    client = await pool.connect();

    const r = await client.query(
      `INSERT INTO payment_config (
        id, provider, api_key, webhook_secret, environment, currency,
        tax_rate, tax_name, invoice_prefix, payment_status, test_mode,
        razorpay_key, razorpay_secret, stripe_publishable_key,
        paypal_client_id, paypal_secret,
        phonepe_merchant_id, phonepe_salt_key,
        cashfree_app_id, cashfree_secret_key,
        enabled, updated_at
      ) VALUES (
        1, $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15,
        $16, $17,
        $18, $19,
        $20, CURRENT_TIMESTAMP
      ) ON CONFLICT (id) DO UPDATE SET
        provider = COALESCE($1, payment_config.provider),
        api_key = COALESCE($2, payment_config.api_key),
        webhook_secret = COALESCE($3, payment_config.webhook_secret),
        environment = COALESCE($4, payment_config.environment),
        currency = COALESCE($5, payment_config.currency),
        tax_rate = COALESCE($6, payment_config.tax_rate),
        tax_name = COALESCE($7, payment_config.tax_name),
        invoice_prefix = COALESCE($8, payment_config.invoice_prefix),
        payment_status = COALESCE($9, payment_config.payment_status),
        test_mode = COALESCE($10, payment_config.test_mode),
        razorpay_key = COALESCE($11, payment_config.razorpay_key),
        razorpay_secret = COALESCE($12, payment_config.razorpay_secret),
        stripe_publishable_key = COALESCE($13, payment_config.stripe_publishable_key),
        paypal_client_id = COALESCE($14, payment_config.paypal_client_id),
        paypal_secret = COALESCE($15, payment_config.paypal_secret),
        phonepe_merchant_id = COALESCE($16, payment_config.phonepe_merchant_id),
        phonepe_salt_key = COALESCE($17, payment_config.phonepe_salt_key),
        cashfree_app_id = COALESCE($18, payment_config.cashfree_app_id),
        cashfree_secret_key = COALESCE($19, payment_config.cashfree_secret_key),
        enabled = COALESCE($20, payment_config.enabled),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        provider ?? null, api_key ?? null, webhook_secret ?? null,
        environment ?? null, currency ?? null,
        tax_rate !== undefined ? tax_rate : null,
        tax_name ?? null, invoice_prefix ?? null,
        payment_status ?? null,
        test_mode !== undefined ? test_mode : null,
        razorpay_key ?? null, razorpay_secret ?? null,
        stripe_publishable_key ?? null,
        paypal_client_id ?? null, paypal_secret ?? null,
        phonepe_merchant_id ?? null, phonepe_salt_key ?? null,
        cashfree_app_id ?? null, cashfree_secret_key ?? null,
        enabled !== undefined ? enabled : null
      ]
    );

    client.release();
    return NextResponse.json({ success: true, config: r.rows[0] });
  } catch (error: any) {
    if (client) client.release();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

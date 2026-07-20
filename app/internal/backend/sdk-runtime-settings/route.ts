import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  if (!productId) {
    return NextResponse.json({ success: false, error: 'productId query parameter is required' }, { status: 400 });
  }

  let client = null;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT id, product_id, trial_enabled, allow_conversion, email_verification,
              trial_duration_days, device_limit, offline_grace_days, support_email,
              created_at, updated_at
       FROM sdk_runtime_settings
       WHERE product_id = $1`,
      [productId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, data: null, message: 'No settings found for this product' });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[sdk-runtime-settings] GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { product_id, trial_enabled, allow_conversion, email_verification,
            trial_duration_days, device_limit, offline_grace_days, support_email } = body;

    if (!product_id) {
      return NextResponse.json({ success: false, error: 'product_id is required' }, { status: 400 });
    }

    client = await pool.connect();

    const result = await client.query(
      `INSERT INTO sdk_runtime_settings (product_id, trial_enabled, allow_conversion, email_verification,
        trial_duration_days, device_limit, offline_grace_days, support_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (product_id)
       DO UPDATE SET
         trial_enabled = EXCLUDED.trial_enabled,
         allow_conversion = EXCLUDED.allow_conversion,
         email_verification = EXCLUDED.email_verification,
         trial_duration_days = EXCLUDED.trial_duration_days,
         device_limit = EXCLUDED.device_limit,
         offline_grace_days = EXCLUDED.offline_grace_days,
         support_email = EXCLUDED.support_email,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        product_id,
        trial_enabled !== false,
        allow_conversion !== false,
        email_verification !== false,
        trial_duration_days || 7,
        device_limit != null ? device_limit : 1,
        offline_grace_days || 0,
        support_email || 'support@websmithdigital.com',
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[sdk-runtime-settings] POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function PUT(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { product_id, trial_enabled, allow_conversion, email_verification,
            trial_duration_days, device_limit, offline_grace_days, support_email } = body;

    if (!product_id) {
      return NextResponse.json({ success: false, error: 'product_id is required' }, { status: 400 });
    }

    client = await pool.connect();

    const result = await client.query(
      `UPDATE sdk_runtime_settings SET
        trial_enabled = $2,
        allow_conversion = $3,
        email_verification = $4,
        trial_duration_days = $5,
        device_limit = $6,
        offline_grace_days = $7,
        support_email = $8,
        updated_at = CURRENT_TIMESTAMP
       WHERE product_id = $1
       RETURNING *`,
      [
        product_id,
        trial_enabled !== false,
        allow_conversion !== false,
        email_verification !== false,
        trial_duration_days || 7,
        device_limit != null ? device_limit : 1,
        offline_grace_days || 0,
        support_email || 'support@websmithdigital.com',
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No settings found for this product_id' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[sdk-runtime-settings] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

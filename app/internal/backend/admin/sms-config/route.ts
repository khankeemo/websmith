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

    await client.query(`CREATE TABLE IF NOT EXISTS sms_config (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      provider TEXT DEFAULT 'fast2sms',
      api_key TEXT DEFAULT '',
      sender_id TEXT DEFAULT 'WEBSMS',
      route TEXT DEFAULT 'dlt',
      environment TEXT DEFAULT 'production',
      enabled BOOLEAN DEFAULT FALSE,
      default_country_code TEXT DEFAULT '+91',
      retry_count INTEGER DEFAULT 2,
      timeout INTEGER DEFAULT 5000,
      delivery_report BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const r = await client.query(`SELECT * FROM sms_config WHERE id = 1`);
    if (r.rows.length === 0) {
      await client.query(
        `INSERT INTO sms_config (id, provider, enabled) VALUES (1, 'fast2sms', false)`
      );
      const r2 = await client.query(`SELECT * FROM sms_config WHERE id = 1`);
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
      provider, api_key, sender_id, route, environment, enabled,
      default_country_code, retry_count, timeout, delivery_report
    } = body;

    client = await pool.connect();

    const r = await client.query(
      `INSERT INTO sms_config (id, provider, api_key, sender_id, route, environment, enabled, default_country_code, retry_count, timeout, delivery_report, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         provider = COALESCE($1, sms_config.provider),
         api_key = COALESCE($2, sms_config.api_key),
         sender_id = COALESCE($3, sms_config.sender_id),
         route = COALESCE($4, sms_config.route),
         environment = COALESCE($5, sms_config.environment),
         enabled = COALESCE($6, sms_config.enabled),
         default_country_code = COALESCE($7, sms_config.default_country_code),
         retry_count = COALESCE($8, sms_config.retry_count),
         timeout = COALESCE($9, sms_config.timeout),
         delivery_report = COALESCE($10, sms_config.delivery_report),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        provider ?? null, api_key ?? null, sender_id ?? null,
        route ?? null, environment ?? null,
        enabled !== undefined ? enabled : null,
        default_country_code ?? null,
        retry_count !== undefined ? retry_count : null,
        timeout !== undefined ? timeout : null,
        delivery_report !== undefined ? delivery_report : null
      ]
    );

    client.release();
    return NextResponse.json({ success: true, config: r.rows[0] });
  } catch (error: any) {
    if (client) client.release();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// FILE: app/api/v1/checkout/config/route.ts
// PURPOSE: Public checkout configuration — countries, states, cities, active
//          payment gateways and tax settings, all database-driven.
// ACCESS: Public (software store)

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 5000,
});

function codeToFlag(code: string): string {
  try {
    return String.fromCodePoint(...code.split('').map(c => 0x1F1E6 + c.codePointAt(0)! - 65));
  } catch {
    return '';
  }
}

export async function GET(request: NextRequest) {
  let client = null;
  try {
    client = await pool.connect();

    const countriesRes = await client.query(
      `SELECT code, name, dial, min_digits, max_digits FROM countries WHERE is_active = TRUE ORDER BY display_order ASC, name ASC`
    );
    const countries = countriesRes.rows.map(r => ({
      code: r.code,
      name: r.name,
      dial: r.dial,
      flag: codeToFlag(r.code),
      minDigits: r.min_digits,
      maxDigits: r.max_digits,
    }));

    const statesRes = await client.query(
      `SELECT id, country_code, name, code FROM states ORDER BY country_code, display_order, name`
    );
    const states = statesRes.rows;

    const citiesRes = await client.query(
      `SELECT c.id, c.state_id, c.country_code, c.name FROM cities c ORDER BY c.country_code, c.name`
    );
    const cities = citiesRes.rows;

    const gatewaysRes = await client.query(
      `SELECT name, display_name, supported_currencies FROM payment_gateways WHERE is_active = TRUE ORDER BY name`
    );
    const gateways = gatewaysRes.rows;

    let tax = { rate: 0, name: 'VAT', currency: 'USD' };
    try {
      const taxRes = await client.query(`SELECT tax_rate, tax_name, currency FROM payment_config WHERE id = 1`);
      if (taxRes.rows.length > 0) {
        tax = {
          rate: Number(taxRes.rows[0].tax_rate) || 0,
          name: taxRes.rows[0].tax_name || 'VAT',
          currency: taxRes.rows[0].currency || 'USD',
        };
      }
    } catch { /* payment_config not created yet — defaults apply */ }

    return NextResponse.json({
      success: true,
      data: { countries, states, cities, gateways, tax },
    });
  } catch (error) {
    console.error('checkout config error:', error);
    return NextResponse.json({ success: false, data: null }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

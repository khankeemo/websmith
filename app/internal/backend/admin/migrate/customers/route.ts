import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST() {
  let client = null;
  try {
    client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        phone TEXT,
        company TEXT,
        country TEXT,
        notes TEXT,
        status TEXT DEFAULT 'active',
        last_login TIMESTAMP,
        total_licenses INTEGER DEFAULT 0,
        active_licenses INTEGER DEFAULT 0,
        total_revenue DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_licenses (
        id SERIAL PRIMARY KEY,
        customer_email TEXT NOT NULL,
        license_key TEXT NOT NULL,
        product_id TEXT,
        plan_name TEXT,
        status TEXT,
        expiry_date TEXT,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_email, license_key)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        email_type TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        plain_text TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(email_type)
      )
    `);

    const existing = await client.query(
      `SELECT DISTINCT ON (LOWER(customer_email)) customer_email, customer_name, customer_phone
       FROM licenses WHERE customer_email IS NOT NULL AND customer_email != ''`
    );

    let inserted = 0;
    for (const row of existing.rows) {
      try {
        await client.query(
          `INSERT INTO customers (email, name, phone)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO NOTHING`,
          [row.customer_email.toLowerCase().trim(), row.customer_name || null, row.customer_phone || null]
        );
        inserted++;
      } catch (e) {
        console.error("Failed to insert customer:", row.customer_email, e);
      }
    }

    client.release();

    return NextResponse.json({
      success: true,
      message: `Migrated ${inserted} customers from licenses table`,
      total_found: existing.rows.length
    });

  } catch (error) {
    console.error("Migration error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Migration failed" },
      { status: 500 }
    );
  }
}

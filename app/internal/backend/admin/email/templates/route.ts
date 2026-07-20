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

    await client.query(`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS plain_text TEXT DEFAULT ''`);

    const r = await client.query(`SELECT * FROM email_templates ORDER BY email_type`);

    if (r.rows.length === 0) {
      const seedRoute = await import('./seed/route');
      const seedRes = await seedRoute.POST();
      const seedData = await seedRes.json();
      if (seedData.success) {
        const r2 = await client.query(`SELECT * FROM email_templates ORDER BY email_type`);
        client.release();
        return NextResponse.json({ success: true, templates: r2.rows, seeded: true });
      }
    }

    client.release();
    return NextResponse.json({ success: true, templates: r.rows });
  } catch (error) {
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { email_type, subject, body: htmlBody, plain_text, is_active } = body;
    if (!email_type || !subject) {
      return NextResponse.json({ success: false, error: "email_type and subject required" }, { status: 400 });
    }
    client = await pool.connect();
    const r = await client.query(
      `INSERT INTO email_templates (email_type, subject, body, plain_text, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (email_type) DO UPDATE SET subject = $2, body = $3, plain_text = $4, is_active = COALESCE($5, email_templates.is_active), updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [email_type, subject, htmlBody || '', plain_text || '', is_active !== undefined ? is_active : true]
    );
    client.release();
    return NextResponse.json({ success: true, template: r.rows[0] });
  } catch (error) {
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to update template" }, { status: 500 });
  }
}

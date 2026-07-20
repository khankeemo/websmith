import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const DEFAULT_VISIBILITY = {
  projects: true,
  clients: true,
  developers: true,
  testimonials: true,
  softwareStore: true,
};

async function getOrCreateSettings() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await client.query(
      `SELECT settings FROM system_settings ORDER BY id DESC LIMIT 1`
    );

    if (result.rows.length === 0) {
      await client.query(
        `INSERT INTO system_settings (settings) VALUES ($1)`,
        [JSON.stringify({ navbar: DEFAULT_VISIBILITY })]
      );
      return DEFAULT_VISIBILITY;
    }

    const settings = result.rows[0].settings || {};
    return { ...DEFAULT_VISIBILITY, ...(settings.navbar || {}) };
  } finally {
    client.release();
  }
}

export async function GET() {
  try {
    const visibility = await getOrCreateSettings();
    return NextResponse.json({ success: true, data: visibility });
  } catch (error) {
    console.error("GET /api/settings/public/navbar_visibility error:", error);
    return NextResponse.json(
      { success: true, data: DEFAULT_VISIBILITY },
      { status: 200 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const value = body.value || body;

    const validated = {
      projects: typeof value.projects === "boolean" ? value.projects : true,
      clients: typeof value.clients === "boolean" ? value.clients : true,
      developers: typeof value.developers === "boolean" ? value.developers : true,
      testimonials: typeof value.testimonials === "boolean" ? value.testimonials : true,
      softwareStore: typeof value.softwareStore === "boolean" ? value.softwareStore : true,
    };

    const client = await pool.connect();
    try {
      const existing = await client.query(
        `SELECT id, settings FROM system_settings ORDER BY id DESC LIMIT 1`
      );

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO system_settings (settings) VALUES ($1)`,
          [JSON.stringify({ navbar: validated })]
        );
      } else {
        const currentSettings = existing.rows[0].settings || {};
        currentSettings.navbar = validated;
        await client.query(
          `UPDATE system_settings SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [JSON.stringify(currentSettings), existing.rows[0].id]
        );
      }

      return NextResponse.json({ success: true, data: validated });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("PUT /api/settings/public/navbar_visibility error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update navbar visibility" },
      { status: 500 }
    );
  }
}

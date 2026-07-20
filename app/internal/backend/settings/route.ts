// FILE: D:\websmith\app\internal\backend\settings\route.ts
// PURPOSE: Settings API - GET and POST system settings
// DATABASE: Neon PostgreSQL only
// ENDPOINTS: GET /internal/backend/settings
//            POST /internal/backend/settings
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// DEFAULT SETTINGS
// ============================================================

const DEFAULT_SETTINGS = {
  general: {
    siteName: "Websmith API Center",
    siteUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
  },
  api: {
    apiKey: "",
    webhookUrl: "",
    validationEndpoint: "",
    rateLimit: 100,
  },
  security: {
    maxLoginAttempts: 5,
    sessionTimeout: 60,
    require2FA: false,
    passwordPolicy: "strong",
    allowedIPs: [],
  },
  notifications: {
    emailNotifications: true,
    licenseExpiryWarning: 7,
    deviceActivityAlerts: true,
    systemAlerts: true,
    weeklyReports: false,
  },
  appearance: {
    theme: "dark",
    sidebarCollapsed: false,
    compactView: false,
    accentColor: "blue",
  },
};

// ============================================================
// GET /internal/backend/settings
// Description: Get system settings
// ============================================================

export async function GET() {
  let client = null;
  
  try {
    client = await pool.connect();
    
    // Check if settings table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'system_settings'
      ) as exists
    `);
    
    if (!tableCheck.rows[0]?.exists) {
      // Table doesn't exist, create it
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id SERIAL PRIMARY KEY,
          settings JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Insert default settings
      await client.query(
        `INSERT INTO system_settings (settings, updated_at)
         VALUES ($1, CURRENT_TIMESTAMP)`,
        [JSON.stringify(DEFAULT_SETTINGS)]
      );
      
      client.release();
      
      return NextResponse.json({
        success: true,
        settings: DEFAULT_SETTINGS,
        message: "Default settings loaded",
      });
    }
    
    // Get settings from database
    const result = await client.query(
      `SELECT settings, updated_at FROM system_settings ORDER BY id DESC LIMIT 1`
    );
    
    client.release();
    
    if (result.rows.length === 0) {
      // No settings found, insert defaults
      const insertClient = await pool.connect();
      await insertClient.query(
        `INSERT INTO system_settings (settings, updated_at)
         VALUES ($1, CURRENT_TIMESTAMP)`,
        [JSON.stringify(DEFAULT_SETTINGS)]
      );
      insertClient.release();
      
      return NextResponse.json({
        success: true,
        settings: DEFAULT_SETTINGS,
        message: "Default settings created",
      });
    }
    
    const settings = result.rows[0].settings;
    const updatedAt = result.rows[0].updated_at;
    
    // Merge with defaults to ensure all fields exist
    const mergedSettings = mergeSettings(DEFAULT_SETTINGS, settings);
    
    return NextResponse.json({
      success: true,
      settings: mergedSettings,
      updated_at: updatedAt,
    });
    
  } catch (error) {
    console.error("GET /settings error:", error);
    
    if (client) {
      client.release();
    }
    
    // Return default settings on error
    return NextResponse.json({
      success: true,
      settings: DEFAULT_SETTINGS,
      message: "Using default settings (database unavailable)",
    });
  }
}

// ============================================================
// POST /internal/backend/settings
// Description: Save system settings
// ============================================================

export async function POST(request: Request) {
  let client = null;
  
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.general || !body.api || !body.security || !body.notifications || !body.appearance) {
      return NextResponse.json(
        { success: false, error: "Invalid settings structure" },
        { status: 400 }
      );
    }
    
    // Validate specific fields
    if (!body.general.siteName || body.general.siteName.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Site name is required" },
        { status: 400 }
      );
    }
    
    if (!body.general.siteUrl || !isValidUrl(body.general.siteUrl)) {
      return NextResponse.json(
        { success: false, error: "Valid site URL is required" },
        { status: 400 }
      );
    }
    
    if (body.api.rateLimit < 1 || body.api.rateLimit > 10000) {
      return NextResponse.json(
        { success: false, error: "Rate limit must be between 1 and 10000" },
        { status: 400 }
      );
    }
    
    if (body.security.maxLoginAttempts < 1 || body.security.maxLoginAttempts > 20) {
      return NextResponse.json(
        { success: false, error: "Max login attempts must be between 1 and 20" },
        { status: 400 }
      );
    }
    
    if (body.security.sessionTimeout < 5 || body.security.sessionTimeout > 1440) {
      return NextResponse.json(
        { success: false, error: "Session timeout must be between 5 and 1440 minutes" },
        { status: 400 }
      );
    }
    
    if (body.notifications.licenseExpiryWarning < 1 || body.notifications.licenseExpiryWarning > 90) {
      return NextResponse.json(
        { success: false, error: "License expiry warning must be between 1 and 90 days" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    // Check if settings table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'system_settings'
      ) as exists
    `);
    
    if (!tableCheck.rows[0]?.exists) {
      // Create table
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id SERIAL PRIMARY KEY,
          settings JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    // Check if there's an existing record
    const existing = await client.query(
      `SELECT id FROM system_settings ORDER BY id DESC LIMIT 1`
    );
    
    if (existing.rows.length === 0) {
      // Insert new settings
      await client.query(
        `INSERT INTO system_settings (settings, updated_at)
         VALUES ($1, CURRENT_TIMESTAMP)`,
        [JSON.stringify(body)]
      );
    } else {
      // Update existing settings
      await client.query(
        `UPDATE system_settings 
         SET settings = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(body), existing.rows[0].id]
      );
    }
    
    client.release();
    
    // Log the change
    try {
      const logClient = await pool.connect();
      await logClient.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "settings_updated",
          "System settings were updated",
          new Date().toISOString(),
          request.headers.get("x-forwarded-for") || "unknown",
          ""
        ]
      );
      logClient.release();
    } catch (logError) {
      console.error("Failed to log settings update:", logError);
    }
    
    return NextResponse.json({
      success: true,
      message: "Settings saved successfully",
      settings: body,
    });
    
  } catch (error) {
    console.error("POST /settings error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to save settings" },
      { status: 500 }
    );
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function mergeSettings(defaults: any, userSettings: any): any {
  const merged = { ...defaults };
  
  for (const key in userSettings) {
    if (userSettings[key] && typeof userSettings[key] === "object" && !Array.isArray(userSettings[key])) {
      merged[key] = { ...defaults[key], ...userSettings[key] };
    } else {
      merged[key] = userSettings[key];
    }
  }
  
  return merged;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
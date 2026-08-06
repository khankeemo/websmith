// FILE: app/internal/backend/admin/dashboard/route.ts
// PURPOSE: GET dashboard statistics with full analytics
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/admin/dashboard

import { NextResponse } from "next/server";
import { Pool } from "pg";

// Force dynamic so the dashboard always reflects fresh license/trial/activation
// stats after activations/renewals — never serve a cached response snapshot.
export const dynamic = "force-dynamic";

// ============================================================
// DATABASE CONNECTION - WITH BETTER SSL CONFIG
// ============================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,  // Required for Neon
    // For Neon, also try:
    // sslmode: 'require'
  },
  connectionTimeoutMillis: 15000,  // Increased timeout
  idleTimeoutMillis: 30000,
  max: 10,
});

// ============================================================
// HELPER: Format date for PostgreSQL text columns
// ============================================================

function formatDateForPostgres(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

// ============================================================
// HELPER: Safe integer parsing
// ============================================================

function safeParseInt(value: any): number {
  return parseInt(value?.count || "0");
}

// ============================================================
// GET /internal/backend/admin/dashboard
// ============================================================

export async function GET() {
  let client = null;

  try {
    console.log("📊 Dashboard API: Attempting to connect...");
    
    // Try to connect with timeout
    client = await pool.connect();
    console.log("✅ Dashboard API: Connected to database");

    const now = formatDateForPostgres(new Date());
    const oneDayAgo = formatDateForPostgres(new Date(Date.now() - 24 * 60 * 60 * 1000));

    // ============================================================
    // 1. LICENSE METRICS
    // ============================================================

    const activeProductCondition = `p.is_active = true AND (p.is_deleted = false OR p.is_deleted IS NULL)`;

    // Test query first - check if tables exist
    try {
      const testResult = await client.query(`SELECT COUNT(*) as count FROM licenses LIMIT 1`);
      console.log("✅ Licenses table exists");
    } catch (testErr) {
      console.error("❌ Licenses table error:", testErr.message);
      // Continue anyway - queries will return 0
    }

    // Total licenses
    const totalResult = await client.query(
      `SELECT COUNT(l.license_key) as count 
       FROM licenses l
       INNER JOIN products p ON l.product_id = p.product_id
       WHERE ${activeProductCondition}`
    );
    const totalLicenses = safeParseInt(totalResult.rows[0]);

    // Active licenses (not expired)
    const activeResult = await client.query(
      `SELECT COUNT(l.license_key) as count 
       FROM licenses l
       INNER JOIN products p ON l.product_id = p.product_id
       WHERE ${activeProductCondition}
         AND l.status = 'active' 
         AND l.expiry_date > $1`,
      [now]
    );
    const activeLicenses = safeParseInt(activeResult.rows[0]);

    // Inactive licenses
    const inactiveResult = await client.query(
      `SELECT COUNT(l.license_key) as count 
       FROM licenses l
       INNER JOIN products p ON l.product_id = p.product_id
       WHERE ${activeProductCondition}
         AND l.status = 'inactive'`
    );
    const inactiveLicenses = safeParseInt(inactiveResult.rows[0]);

    // Expired licenses
    const expiredResult = await client.query(
      `SELECT COUNT(l.license_key) as count 
       FROM licenses l
       INNER JOIN products p ON l.product_id = p.product_id
       WHERE ${activeProductCondition}
         AND l.expiry_date <= $1 
         AND l.status != 'revoked'`,
      [now]
    );
    const expiredLicenses = safeParseInt(expiredResult.rows[0]);

    // Revoked licenses
    const revokedResult = await client.query(
      `SELECT COUNT(l.license_key) as count 
       FROM licenses l
       INNER JOIN products p ON l.product_id = p.product_id
       WHERE ${activeProductCondition}
         AND l.status = 'revoked'`
    );
    const revokedLicenses = safeParseInt(revokedResult.rows[0]);

    const licenseHealth = {
      total: totalLicenses,
      active: activeLicenses,
      inactive: inactiveLicenses,
      expired: expiredLicenses,
      revoked: revokedLicenses,
    };

    // ============================================================
    // 2. TRIAL METRICS
    // ============================================================

    // Active trials
    const activeTrialsResult = await client.query(
      `SELECT COUNT(*) as count FROM trials 
       WHERE status = 'active' AND expiry_date > $1`,
      [now]
    );
    const activeTrials = safeParseInt(activeTrialsResult.rows[0]);

    // Expired trials
    const expiredTrialsResult = await client.query(
      `SELECT COUNT(*) as count FROM trials 
       WHERE status = 'expired' OR expiry_date <= $1`,
      [now]
    );
    const expiredTrials = safeParseInt(expiredTrialsResult.rows[0]);

    // Converted trials
    const convertedTrialsResult = await client.query(
      `SELECT COUNT(*) as count FROM trials 
       WHERE status = 'converted' AND converted_to_license_key IS NOT NULL`
    );
    const convertedTrials = safeParseInt(convertedTrialsResult.rows[0]);

    // Total trials
    const totalTrialsResult = await client.query(
      `SELECT COUNT(*) as count FROM trials`
    );
    const totalTrials = safeParseInt(totalTrialsResult.rows[0]);

    const trialConversionRate = totalTrials > 0
      ? Math.round((convertedTrials / totalTrials) * 100)
      : 0;

    const trialsByStatus = {
      active: activeTrials,
      expired: expiredTrials,
      converted: convertedTrials,
    };

    // ============================================================
    // 3. RECENT TRIAL CONVERSIONS
    // ============================================================

    const recentConversionsResult = await client.query(
      `SELECT 
        t.hardware_id,
        t.converted_to_license_key as license_key,
        t.customer_name,
        t.customer_email,
        t.converted_at,
        t.product_id,
        p.name as product_name
      FROM trials t
      LEFT JOIN products p ON t.product_id = p.product_id
      WHERE t.status = 'converted' 
        AND t.converted_to_license_key IS NOT NULL
        AND t.converted_at IS NOT NULL
      ORDER BY t.converted_at DESC
      LIMIT 5`
    );

    const recentConversions = recentConversionsResult.rows.map((row) => ({
      hardware_id: row.hardware_id || "",
      license_key: row.license_key || "",
      customer_name: row.customer_name || "Unknown",
      customer_email: row.customer_email || "",
      product_name: row.product_name || "Unknown",
      converted_at: row.converted_at,
    }));

    // ============================================================
    // 4. TRIAL TEMPLATES
    // ============================================================

    const templatesResult = await client.query(
      `SELECT COUNT(*) as count FROM trial_templates WHERE is_active = true`
    );
    const totalTemplates = safeParseInt(templatesResult.rows[0]);

    // ============================================================
    // 5. HARDWARE METRICS
    // ============================================================

    // Total activations
    const activationsResult = await client.query(
      `SELECT COUNT(*) as count FROM activations a
       INNER JOIN licenses l ON a.license_key = l.license_key
       INNER JOIN products p ON l.product_id = p.product_id
       WHERE ${activeProductCondition}`
    );
    const totalActivations = safeParseInt(activationsResult.rows[0]);

    // Online devices (last 24 hours)
    const onlineDevicesResult = await client.query(
      `SELECT COUNT(a.id) as count 
       FROM activations a
       INNER JOIN licenses l ON a.license_key = l.license_key
       INNER JOIN products p ON l.product_id = p.product_id
       WHERE ${activeProductCondition}
         AND a.last_seen > $1`,
      [oneDayAgo]
    );
    const onlineDevices24h = safeParseInt(onlineDevicesResult.rows[0]);

    // Offline devices
    const offlineDevicesResult = await client.query(
      `SELECT COUNT(a.id) as count 
       FROM activations a
       INNER JOIN licenses l ON a.license_key = l.license_key
       INNER JOIN products p ON l.product_id = p.product_id
       WHERE ${activeProductCondition}
         AND (a.last_seen <= $1 OR a.last_seen IS NULL)`,
      [oneDayAgo]
    );
    const offlineDevices = safeParseInt(offlineDevicesResult.rows[0]);

    const hardwareByStatus = {
      online: onlineDevices24h,
      offline: offlineDevices,
    };

    // Release connection
    client.release();
    console.log("✅ Dashboard API: Successfully fetched all data");

    // ============================================================
    // 6. RESPONSE
    // ============================================================

    return NextResponse.json({
      success: true,
      database: "connected",

      // License metrics
      total_licenses: totalLicenses,
      active_licenses: activeLicenses,
      expired_licenses: expiredLicenses,
      revoked_licenses: revokedLicenses,

      // License health breakdown
      license_health: licenseHealth,

      // Trial metrics
      active_trials: activeTrials,
      converted_trials: convertedTrials,
      trial_conversion_rate: trialConversionRate,
      trials_by_status: trialsByStatus,

      // Recent conversions
      recent_conversions: recentConversions,

      // Templates
      total_templates: totalTemplates,

      // Hardware metrics
      total_activations: totalActivations,
      online_devices_24h: onlineDevices24h,
      hardware_by_status: hardwareByStatus,

      // Timestamp
      fetched_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error("❌ Dashboard API Error:", error);
    console.error("❌ Error details:", error.message);
    console.error("❌ Error stack:", error.stack);

    if (client) {
      client.release();
    }

    // Return fallback data with error details
    return NextResponse.json({
      success: true,
      database: "disconnected",
      message: `Database error: ${error.message}`,
      error_details: process.env.NODE_ENV === 'development' ? error.stack : undefined,

      total_licenses: 0,
      active_licenses: 0,
      expired_licenses: 0,
      revoked_licenses: 0,

      license_health: {
        total: 0,
        active: 0,
        inactive: 0,
        expired: 0,
        revoked: 0,
      },

      active_trials: 0,
      converted_trials: 0,
      trial_conversion_rate: 0,
      trials_by_status: {
        active: 0,
        expired: 0,
        converted: 0,
      },

      recent_conversions: [],
      total_templates: 0,
      total_activations: 0,
      online_devices_24h: 0,
      hardware_by_status: {
        online: 0,
        offline: 0,
      },

      fetched_at: new Date().toISOString(),
    });
  }
}
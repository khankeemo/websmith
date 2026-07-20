// FILE: app/internal/backend/licenses/cleanup/route.ts
// PURPOSE: Auto-delete expired licenses based on configured days
// DATABASE: Neon PostgreSQL only
// ENDPOINTS:
//   - GET /internal/backend/licenses/cleanup - Get cleanup settings and stats
//   - POST /internal/backend/licenses/cleanup - Run cleanup manually
//   - PUT /internal/backend/licenses/cleanup - Update cleanup settings
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// GET: Get cleanup settings and statistics
// ============================================================
export async function GET(request: NextRequest) {
  let client = null;
  
  try {
    client = await pool.connect();

    // Get cleanup settings from system_settings
    const settingsResult = await client.query(
      `SELECT settings FROM system_settings WHERE id = 1`
    );

    let settings: any = {
      enabled: false,
      days_after_expiry: 30,
      last_run_at: null,
      delete_notes: true
    };

    if (settingsResult.rows.length > 0) {
      const allSettings = settingsResult.rows[0].settings;
      if (allSettings && allSettings.license_cleanup) {
        settings = {
          ...settings,
          ...allSettings.license_cleanup
        };
      }
    }

    // Get statistics
    const now = new Date();
    
    // Count expired licenses (not deleted)
    const expiredResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM licenses 
       WHERE expiry_date < $1 
         AND status != 'revoked'
         AND deleted_at IS NULL`,
      [now.toISOString()]
    );

    // Count licenses that would be deleted (expired + days_after_expiry)
    const deleteDate = new Date(now);
    deleteDate.setDate(deleteDate.getDate() - settings.days_after_expiry);
    
    const toDeleteResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM licenses 
       WHERE expiry_date < $1 
         AND status != 'revoked'
         AND deleted_at IS NULL`,
      [deleteDate.toISOString()]
    );

    client.release();

    return NextResponse.json({
      success: true,
      data: {
        settings: {
          enabled: settings.enabled,
          days_after_expiry: settings.days_after_expiry,
          last_run_at: settings.last_run_at,
          delete_notes: settings.delete_notes
        },
        stats: {
          total_expired: parseInt(expiredResult.rows[0].count),
          pending_deletion: parseInt(toDeleteResult.rows[0].count)
        }
      }
    });

  } catch (error) {
    console.error("Get cleanup settings error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to get cleanup settings" },
      { status: 500 }
    );
  }
}

// ============================================================
// POST: Run cleanup manually
// ============================================================
export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    const body = await request.json();
    const { dry_run } = body; // If true, only return count without deleting

    const now = new Date();
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const userEmail = request.headers.get("x-user-email") || "system";

    client = await pool.connect();

    // Get cleanup settings
    const settingsResult = await client.query(
      `SELECT settings FROM system_settings WHERE id = 1`
    );

    let settings: any = {
      enabled: false,
      days_after_expiry: 30,
      delete_notes: true,
      last_run_at: null
    };

    if (settingsResult.rows.length > 0) {
      const allSettings = settingsResult.rows[0].settings;
      if (allSettings && allSettings.license_cleanup) {
        settings = {
          ...settings,
          ...allSettings.license_cleanup
        };
      }
    }

    // Check if cleanup is enabled (unless forced via request)
    if (!settings.enabled && !body.force) {
      client.release();
      return NextResponse.json(
        { 
          success: false, 
          error: "Cleanup is disabled. Enable it in settings or use force=true" 
        },
        { status: 400 }
      );
    }

    // Calculate cutoff date
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - settings.days_after_expiry);

    // Find licenses to delete
    const toDeleteResult = await client.query(
      `SELECT 
        license_key,
        customer_name,
        customer_email,
        plan,
        status,
        expiry_date,
        created_at,
        notes
      FROM licenses 
      WHERE expiry_date < $1 
        AND status != 'revoked'
        AND deleted_at IS NULL`,
      [cutoffDate.toISOString()]
    );

    const licensesToDelete = toDeleteResult.rows;

    if (dry_run) {
      client.release();
      return NextResponse.json({
        success: true,
        message: `Dry run: ${licensesToDelete.length} licenses would be deleted`,
        data: {
          count: licensesToDelete.length,
          licenses: licensesToDelete.map(l => ({
            license_key: l.license_key,
            customer_name: l.customer_name,
            customer_email: l.customer_email,
            expiry_date: l.expiry_date,
            days_expired: Math.floor((new Date().getTime() - new Date(l.expiry_date).getTime()) / (1000 * 60 * 60 * 24))
          })),
          dry_run: true
        }
      });
    }

    // Perform soft delete
    let deletedCount = 0;
    const deletedLicenses: string[] = [];

    for (const license of licensesToDelete) {
      await client.query(
        `UPDATE licenses 
         SET deleted_at = $1,
             deleted_by = $2,
             status = 'expired',
             inactive_reason = 'Subscription Expired',
             updated_at = CURRENT_TIMESTAMP,
             notes = CASE 
               WHEN notes IS NULL OR notes = '' THEN $3
               ELSE notes || '\n' || $3
             END
         WHERE license_key = $4`,
        [
          now.toISOString(),
          'system_cleanup',
          `[${now.toISOString()}] Auto-deleted by system cleanup (expired ${Math.floor((new Date().getTime() - new Date(license.expiry_date).getTime()) / (1000 * 60 * 60 * 24))} days ago)`,
          license.license_key
        ]
      );

      deletedCount++;
      deletedLicenses.push(license.license_key);
    }

    // Log cleanup to audit_logs
    if (deletedCount > 0) {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "system_cleanup",
          `System cleanup: ${deletedCount} licenses deleted after ${settings.days_after_expiry} days of expiry`,
          now.toISOString(),
          clientIp,
          "system",
          ""
        ]
      );
    }

    // Update last_run_at
    await client.query(
      `UPDATE system_settings 
       SET settings = jsonb_set(
         COALESCE(settings, '{}'::jsonb),
         '{license_cleanup,last_run_at}',
         $1::jsonb
       )
       WHERE id = 1`,
      [`"${now.toISOString()}"`]
    );

    client.release();

    return NextResponse.json({
      success: true,
      message: `Cleanup completed: ${deletedCount} licenses deleted`,
      data: {
        deleted_count: deletedCount,
        deleted_licenses: deletedLicenses,
        cutoff_date: cutoffDate.toISOString(),
        days_after_expiry: settings.days_after_expiry,
        deleted_at: now.toISOString()
      }
    });

  } catch (error) {
    console.error("Cleanup error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to run cleanup" },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT: Update cleanup settings
// ============================================================
export async function PUT(request: NextRequest) {
  let client = null;
  
  try {
    const body = await request.json();
    const { enabled, days_after_expiry, delete_notes } = body;

    // Validate
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: "Enabled must be a boolean" },
        { status: 400 }
      );
    }

    if (days_after_expiry !== undefined) {
      if (typeof days_after_expiry !== 'number' || days_after_expiry < 1 || days_after_expiry > 365) {
        return NextResponse.json(
          { success: false, error: "Days after expiry must be between 1 and 365" },
          { status: 400 }
        );
      }
    }

    if (delete_notes !== undefined && typeof delete_notes !== 'boolean') {
      return NextResponse.json(
        { success: false, error: "Delete notes must be a boolean" },
        { status: 400 }
      );
    }

    client = await pool.connect();

    // Get current settings
    const currentResult = await client.query(
      `SELECT settings FROM system_settings WHERE id = 1`
    );

    let currentSettings: any = {};
    if (currentResult.rows.length > 0) {
      const allSettings = currentResult.rows[0].settings;
      if (allSettings && allSettings.license_cleanup) {
        currentSettings = allSettings.license_cleanup;
      }
    }

    // Update settings
    const newSettings = {
      ...currentSettings,
      enabled: enabled !== undefined ? enabled : currentSettings.enabled ?? false,
      days_after_expiry: days_after_expiry !== undefined ? days_after_expiry : currentSettings.days_after_expiry ?? 30,
      delete_notes: delete_notes !== undefined ? delete_notes : currentSettings.delete_notes ?? true,
      last_run_at: currentSettings.last_run_at ?? null
    };

    await client.query(
      `UPDATE system_settings 
       SET settings = jsonb_set(
         COALESCE(settings, '{}'::jsonb),
         '{license_cleanup}',
         $1::jsonb
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [JSON.stringify(newSettings)]
    );

    client.release();

    return NextResponse.json({
      success: true,
      message: "Cleanup settings updated successfully",
      data: {
        settings: newSettings
      }
    });

  } catch (error) {
    console.error("Update cleanup settings error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to update cleanup settings" },
      { status: 500 }
    );
  }
}
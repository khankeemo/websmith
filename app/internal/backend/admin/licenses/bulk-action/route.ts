import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const VALID_ACTIONS = ['revoke', 'delete', 'restore', 'activate', 'change_email'];

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { action, license_keys, ...params } = body;

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(license_keys) || license_keys.length === 0) {
      return NextResponse.json(
        { success: false, error: 'license_keys must be a non-empty array' },
        { status: 400 }
      );
    }

    if (license_keys.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 licenses per bulk action' },
        { status: 400 }
      );
    }

    client = await pool.connect();
    await client.query('BEGIN');

    let updated = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (const licenseKey of license_keys) {
      try {
        switch (action) {
          case 'revoke': {
            const r = await client.query(
              `UPDATE licenses SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE license_key = $1 AND (deleted_at IS NULL)`,
              [licenseKey]
            );
            if (r.rowCount && r.rowCount > 0) {
              await client.query(
                `INSERT INTO audit_logs (event_type, message, timestamp, license_key) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
                ['revoked', `License revoked via bulk action: ${licenseKey}`, licenseKey]
              );
              updated++;
            } else {
              skipped++;
            }
            break;
          }
          case 'delete': {
            // Cascade cleanup: remove all related records
            await client.query(`DELETE FROM activations WHERE license_key = $1`, [licenseKey]);
            await client.query(`DELETE FROM renewal_history WHERE license_key = $1`, [licenseKey]);
            await client.query(`DELETE FROM renewal_requests WHERE license_key = $1`, [licenseKey]);
            await client.query(`DELETE FROM reactivation_requests WHERE license_key = $1`, [licenseKey]);
            await client.query(`UPDATE communication_conversations SET license_key = NULL WHERE license_key = $1`, [licenseKey]);
            await client.query(`UPDATE notification_logs SET license_key = NULL WHERE license_key = $1`, [licenseKey]);
            await client.query(`UPDATE requests SET license_key = NULL WHERE license_key = $1`, [licenseKey]);

            // Soft-delete the license row (retain for audit trail)
            const r = await client.query(
              `UPDATE licenses SET deleted_at = CURRENT_TIMESTAMP, status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE license_key = $1 AND deleted_at IS NULL`,
              [licenseKey]
            );
            if (r.rowCount && r.rowCount > 0) {
              await client.query(
                `INSERT INTO audit_logs (event_type, message, timestamp, license_key) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
                ['deleted', `License deleted via bulk action: ${licenseKey}`, licenseKey]
              );
              updated++;
            } else {
              skipped++;
            }
            break;
          }
          case 'restore': {
            const r = await client.query(
              `UPDATE licenses SET deleted_at = NULL, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE license_key = $1 AND deleted_at IS NOT NULL`,
              [licenseKey]
            );
            if (r.rowCount && r.rowCount > 0) {
              await client.query(
                `INSERT INTO audit_logs (event_type, message, timestamp, license_key) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
                ['restored', `License restored via bulk action: ${licenseKey}`, licenseKey]
              );
              updated++;
            } else {
              skipped++;
            }
            break;
          }
          case 'activate': {
            const r = await client.query(
              `UPDATE licenses SET status = 'active', is_activated = true, activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE license_key = $1 AND deleted_at IS NULL`,
              [licenseKey]
            );
            if (r.rowCount && r.rowCount > 0) {
              await client.query(
                `INSERT INTO audit_logs (event_type, message, timestamp, license_key) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
                ['activated', `License activated via bulk action: ${licenseKey}`, licenseKey]
              );
              updated++;
            } else {
              skipped++;
            }
            break;
          }
          case 'change_email': {
            const newEmail = params.email;
            if (!newEmail || typeof newEmail !== 'string' || !newEmail.includes('@')) {
              errors.push(`Invalid email for ${licenseKey}`);
              continue;
            }
            const r = await client.query(
              `UPDATE licenses SET customer_email = $1, updated_at = CURRENT_TIMESTAMP WHERE license_key = $2 AND deleted_at IS NULL`,
              [newEmail, licenseKey]
            );
            if (r.rowCount && r.rowCount > 0) {
              await client.query(
                `INSERT INTO audit_logs (event_type, message, timestamp, license_key) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
                ['email_changed', `Email changed via bulk action: ${licenseKey} -> ${newEmail}`, licenseKey]
              );
              updated++;
            } else {
              skipped++;
            }
            break;
          }
        }
      } catch (e) {
        errors.push(`Error processing ${licenseKey}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await client.query('COMMIT');
    client.release();

    return NextResponse.json({
      success: true,
      action,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      total_requested: license_keys.length
    });

  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
      client.release();
    }
    console.error("Bulk action error:", error);
    return NextResponse.json(
      { success: false, error: 'Failed to process bulk action' },
      { status: 500 }
    );
  }
}

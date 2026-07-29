import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: NextRequest) {
  let client = null;

  try {
    const { searchParams } = new URL(request.url);
    const hardwareId = searchParams.get('hardware_id');

    if (!hardwareId) {
      return NextResponse.json(
        { success: false, error: "hardware_id is required" },
        { status: 400 }
      );
    }

    client = await pool.connect();
    const now = new Date();

    // Step 1: Search Activation by Hardware ID
    const activationRes = await client.query(
      `SELECT a.license_key, a.hardware_id, a.device_name, a.is_active as activation_active,
              l.license_key as lic_key, l.customer_name, l.customer_email, l.customer_phone, l.customer_mobile,
              l.plan, l.status as license_status, l.expiry_date, l.max_devices, l.device_count,
              l.is_trial, l.inactive_reason, l.deleted_at,
              p.name as product_name, p.product_id,
              pl.name as plan_name, pl.max_devices as plan_max_devices,
              c.name as cust_name, c.email as cust_email, c.mobile as cust_mobile, c.phone as cust_phone
       FROM activations a
       JOIN licenses l ON a.license_key = l.license_key
       LEFT JOIN products p ON l.product_id = p.product_id
       LEFT JOIN plans pl ON (l.plan = pl.name AND l.product_id = pl.product_id) OR (l.plan_id = pl.id)
       LEFT JOIN customers c ON LOWER(l.customer_email) = LOWER(c.email)
       WHERE a.hardware_id = $1
       ORDER BY a.last_seen DESC
       LIMIT 1`,
      [hardwareId]
    );

    if (activationRes.rows.length > 0) {
      const row = activationRes.rows[0];

      const expiryDate = row.expiry_date ? new Date(row.expiry_date) : null;
      let daysRemaining = 0;
      if (expiryDate && expiryDate > now) {
        daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const isDeleted = !!row.deleted_at;
      const dbStatus = row.license_status || '';

      let normalizedStatus: string;
      let isExpiredStatus = false;
      if (isDeleted || dbStatus === 'deleted') {
        normalizedStatus = 'deleted';
      } else if (dbStatus === 'revoked') {
        normalizedStatus = 'revoked';
      } else if (dbStatus === 'suspended') {
        normalizedStatus = 'suspended';
      } else if (dbStatus === 'disabled') {
        normalizedStatus = 'disabled';
      } else if (dbStatus === 'inactive') {
        normalizedStatus = 'inactive';
      } else if (expiryDate && expiryDate < now) {
        normalizedStatus = 'expired';
        isExpiredStatus = true;
      } else if (dbStatus === 'active' || dbStatus === '') {
        normalizedStatus = 'licensed';
      } else {
        normalizedStatus = 'no_license';
      }

      const deviceCountRes = await client.query(
        `SELECT COUNT(*) as count FROM activations WHERE license_key = $1 AND (is_active = TRUE OR is_active IS NULL)`,
        [row.lic_key]
      );
      const currentDevices = parseInt(deviceCountRes.rows[0]?.count || '0');

      const otherActivationRes = await client.query(
        `SELECT COUNT(*) as count FROM activations WHERE license_key = $1 AND hardware_id != $2 AND (is_active = TRUE OR is_active IS NULL)`,
        [row.lic_key, hardwareId]
      );
      const otherDeviceCount = parseInt(otherActivationRes.rows[0]?.count || '0');

      client.release();

      // Determine is_hardware_activated: this hardware has an activation record
      const isHardwareActivated = true;
      // Has active license on other device: other activations exist for same license
      const hasActiveLicenseOnOtherDevice = otherDeviceCount > 0;

      return NextResponse.json({
        success: true,
        status: normalizedStatus,
        customer: {
          name: row.customer_name || row.cust_name || '',
          email: row.customer_email || row.cust_email || '',
          mobile: row.customer_mobile || row.cust_mobile || row.customer_phone || row.cust_phone || ''
        },
        license: {
          license_key: row.lic_key || '',
          status: normalizedStatus,
          expiry_date: expiryDate ? expiryDate.toISOString().split('T')[0] : '',
          days_remaining: daysRemaining
        },
        plan: {
          name: row.plan_name || row.plan || '',
          device_limit: row.plan_max_devices || row.max_devices || 1
        },
        product: {
          name: row.product_name || '',
          product_id: row.product_id || ''
        },
        devices: {
          current: currentDevices,
          maximum: row.plan_max_devices || row.max_devices || 1
        },
        hardware: {
          hardware_id: hardwareId,
          device_name: row.device_name || '',
          is_activated: row.activation_active !== false
        }
      });
    }

    // Step 2: If no activation, search Trial by Hardware ID
    const trialRes = await client.query(
      `SELECT t.*, p.name as product_name, p.product_id, pl.name as plan_name, pl.max_devices as plan_max_devices
       FROM trials t
       LEFT JOIN products p ON t.product_id = p.product_id
       LEFT JOIN plans pl ON t.plan_id = pl.id
       WHERE t.hardware_id = $1
       ORDER BY t.started_at DESC
       LIMIT 1`,
      [hardwareId]
    );

    if (trialRes.rows.length > 0) {
      const row = trialRes.rows[0];

      const expiryDate = row.expiry_date ? new Date(row.expiry_date) : null;
      let daysRemaining = 0;
      if (expiryDate && expiryDate > now) {
        daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const isExpired = row.status === 'expired' || (expiryDate && expiryDate <= now);
      const trialStatus = isExpired ? 'Trial Expired' : 'Trial Active';
      const normalizedTrialStatus = isExpired ? 'no_license' : 'trial';

      client.release();

      return NextResponse.json({
        success: true,
        status: normalizedTrialStatus,
        customer: {
          name: row.customer_name || '',
          email: row.customer_email || '',
          mobile: row.mobile_number || ''
        },
        license: {
          license_key: '',
          status: trialStatus,
          expiry_date: expiryDate ? expiryDate.toISOString().split('T')[0] : '',
          days_remaining: daysRemaining
        },
        plan: {
          name: row.plan_name || 'Trial',
          device_limit: row.plan_max_devices || 1
        },
        product: {
          name: row.product_name || '',
          product_id: row.product_id || ''
        },
        devices: {
          current: 1,
          maximum: row.plan_max_devices || 1
        },
        hardware: {
          hardware_id: hardwareId,
          device_name: '',
          is_activated: isExpired ? false : true
        }
      });
    }

    // Step 3: No license or trial found
    client.release();

    return NextResponse.json({
      success: true,
      status: 'no_license',
      customer: {
        name: '',
        email: '',
        mobile: ''
      },
      license: {
        license_key: '',
        status: 'No License',
        expiry_date: '',
        days_remaining: 0
      },
      plan: {
        name: '',
        device_limit: 1
      },
      product: {
        name: '',
        product_id: ''
      },
      devices: {
        current: 0,
        maximum: 1
      },
      hardware: {
        hardware_id: hardwareId,
        device_name: '',
        is_activated: false
      }
    });

  } catch (error) {
    console.error("License status error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

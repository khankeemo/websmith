import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { licenseKey } = body;

    if (!licenseKey || typeof licenseKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'License key is required' },
        { status: 400 }
      );
    }

    const normalizedKey = licenseKey.toUpperCase().trim();
    const pool = await getDb();
    const client = await pool.connect();

    try {
      const licenseResult = await client.query(
        `SELECT
          l.license_key,
          l.product_id,
          l.customer_name,
          l.customer_email,
          l.customer_phone,
          l.customer_mobile,
          l.plan,
          l.status,
          l.expiry_date,
          l.max_devices,
          l.device_count,
          l.hardware_id,
          l.is_trial,
          l.activated_at,
          p.name AS product_name
        FROM licenses l
        LEFT JOIN products p ON l.product_id = p.product_id
        WHERE l.license_key = $1`,
        [normalizedKey]
      );

      if (licenseResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'License key not found' },
          { status: 404 }
        );
      }

      const lic = licenseResult.rows[0];

      if (!lic.customer_name && !lic.customer_email) {
        return NextResponse.json(
          { success: false, error: 'No customer data found for this license. Please contact support.' },
          { status: 400 }
        );
      }

      const hasPaidLicense = lic.status !== 'inactive' || lic.activated_at !== null;

      let activationData = null;
      if (lic.hardware_id) {
        const actResult = await client.query(
          `SELECT hardware_id, device_name, ip_address, os_version, activated_at, last_seen
           FROM activations
           WHERE license_key = $1 AND status = 'active'
           ORDER BY activated_at DESC LIMIT 1`,
          [normalizedKey]
        );
        if (actResult.rows.length > 0) {
          activationData = actResult.rows[0];
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          license_key: lic.license_key,
          product_id: lic.product_id,
          product_name: lic.product_name || '',
          plan: lic.plan || '',
          status: lic.status,
          expiry_date: lic.expiry_date || '',
          max_devices: lic.max_devices,
          device_count: lic.device_count,
          is_trial: lic.is_trial,
          has_paid_history: hasPaidLicense,
          customer: {
            name: lic.customer_name || '',
            email: lic.customer_email || '',
            phone: lic.customer_phone || lic.customer_mobile || '',
          },
          hardware: activationData ? {
            hardware_id: activationData.hardware_id || '',
            device_name: activationData.device_name || '',
            os_version: activationData.os_version || '',
            last_seen: activationData.last_seen || '',
          } : lic.hardware_id ? {
            hardware_id: lic.hardware_id,
            device_name: '',
            os_version: '',
            last_seen: '',
          } : null,
        },
      });
    } catch (dbError) {
      console.error('[License Reactivation] DB error:', dbError);
      const msg = dbError?.message || '';
      if (msg.includes('42P01') || msg.includes('relation "')) {
        return NextResponse.json(
          { success: false, error: 'Database migration is missing. Please run the latest Neon migration.' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[License Reactivation] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch license data' },
      { status: 500 }
    );
  }
}

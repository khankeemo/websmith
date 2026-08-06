// FILE: D:\websmith\app\internal\backend\hardware\route.ts
// PURPOSE: GET hardware devices (activations) - filter by license_key
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/hardware?license_key=XXXX-XXXX
// UPDATED: Full relational view (customer, plan, product, license status/expiry,
//          device counts) — no "Unknown" placeholders.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: NextRequest) {
  let client = null;
  
  try {
    client = await pool.connect();
    const searchParams = request.nextUrl.searchParams;
    const license_key = searchParams.get('license_key');
    
    let query = `
      SELECT 
        a.id,
        a.hardware_id,
        a.device_name,
        a.ip_address,
        a.activated_at,
        a.last_seen,
        a.os_version,
        a.product_version,
        a.company_name,
        a.status as hardware_status,
        a.is_active as activation_active,
        l.license_key,
        l.customer_name,
        l.customer_email,
        l.customer_phone,
        l.customer_mobile,
        l.plan,
        l.status as license_status,
        l.expiry_date,
        l.max_devices,
        l.device_count,
        l.is_trial,
        l.inactive_reason,
        p.name as product_name,
        p.product_id,
        pl.name as plan_name,
        pl.max_devices as plan_max_devices,
        c.name as cust_name,
        c.email as cust_email,
        c.mobile as cust_mobile,
        c.phone as cust_phone,
        (SELECT COUNT(*) FROM activations a2
          WHERE a2.license_key = a.license_key
            AND (a2.is_active = TRUE OR a2.is_active IS NULL)) as total_device_count
      FROM activations a
      LEFT JOIN licenses l ON a.license_key = l.license_key
      LEFT JOIN products p ON l.product_id = p.product_id
      LEFT JOIN plans pl ON (l.plan = pl.name AND l.product_id = pl.product_id) OR (l.plan_id = pl.id)
      LEFT JOIN customers c ON LOWER(l.customer_email) = LOWER(c.email)
    `;
    const params: any[] = [];
    
    if (license_key) {
      query += ` WHERE a.license_key = $1`;
      params.push(license_key.toUpperCase());
    }
    
    query += ` ORDER BY a.last_seen DESC`;
    
    const result = await client.query(query, params);
    client.release();
    
    // Calculate device online status based on last_seen (30 days = online)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const now = Date.now();
    
    const devices = result.rows.map((device: any) => {
      const expiryDate = device.expiry_date ? new Date(device.expiry_date) : null;
      let daysRemaining = 0;
      if (expiryDate && expiryDate.getTime() > now) {
        daysRemaining = Math.ceil((expiryDate.getTime() - now) / (1000 * 60 * 60 * 24));
      }
      const isExpired = !!(expiryDate && expiryDate.getTime() < now);
      const dbStatus = device.license_status || '';
      let normalizedStatus = 'no_license';
      if (dbStatus === 'revoked') normalizedStatus = 'revoked';
      else if (dbStatus === 'suspended') normalizedStatus = 'suspended';
      else if (dbStatus === 'disabled') normalizedStatus = 'disabled';
      else if (dbStatus === 'inactive') normalizedStatus = 'inactive';
      else if (isExpired) normalizedStatus = 'expired';
      else if (dbStatus === 'active' || dbStatus === '') normalizedStatus = 'licensed';

      return {
        id: device.id,
        hardware_id: device.hardware_id,
        device_name: device.device_name || 'Unnamed Device',
        ip_address: device.ip_address,
        activated_at: device.activated_at,
        last_seen: device.last_seen,
        os_version: device.os_version || '',
        product_version: device.product_version || '',
        company_name: device.company_name || device.customer_name || device.cust_name || '',
        hardware_status: device.hardware_status || 'pending',
        license_key: device.license_key || '',
        customer: {
          name: device.customer_name || device.cust_name || '',
          email: device.customer_email || device.cust_email || '',
          mobile: device.customer_mobile || device.cust_mobile || device.customer_phone || device.cust_phone || ''
        },
        plan: {
          name: device.plan_name || device.plan || '',
          max_devices: device.plan_max_devices ?? device.max_devices ?? 0
        },
        product: {
          name: device.product_name || '',
          product_id: device.product_id || ''
        },
        license: {
          status: normalizedStatus,
          expiry_date: device.expiry_date || null,
          days_remaining: expiryDate ? Math.max(0, daysRemaining) : null,
          is_trial: !!device.is_trial,
          device_count: device.total_device_count ?? device.device_count ?? 0
        },
        online_status: device.last_seen && new Date(device.last_seen) > thirtyDaysAgo ? 'online' : 'offline'
      };
    });
    
    return NextResponse.json({ success: true, data: devices });
    
  } catch (error) {
    console.error("Hardware devices error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch hardware devices", data: [] },
      { status: 500 }
    );
  }
}
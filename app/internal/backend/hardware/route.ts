// FILE: D:\websmith\app\internal\backend\hardware\route.ts
// PURPOSE: GET hardware devices (activations) - filter by license_key
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/hardware?license_key=XXXX-XXXX
// UPDATED: Added os_version, product_version, company_name, status columns

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
        l.license_key
      FROM activations a
      LEFT JOIN licenses l ON a.license_key = l.license_key
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
    
    const devices = result.rows.map((device: any) => ({
      id: device.id,
      hardware_id: device.hardware_id,
      device_name: device.device_name || 'Unknown Device',
      ip_address: device.ip_address,
      activated_at: device.activated_at,
      last_seen: device.last_seen,
      os_version: device.os_version || 'Unknown',
      product_version: device.product_version || 'Unknown',
      company_name: device.company_name || 'Unknown',
      hardware_status: device.hardware_status || 'pending',
      license_key: device.license_key || '',
      // Calculate device online status
      online_status: device.last_seen && new Date(device.last_seen) > thirtyDaysAgo ? 'online' : 'offline'
    }));
    
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
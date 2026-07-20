// FILE: D:\websmith\app\internal\backend\admin\search\email\route.ts
// PURPOSE: GET search for customer by email (with product isolation)
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/admin/search/email?email=customer@example.com
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only
// UPDATED: API Center V1 compliance - returns ALL licenses (no filtering by product status)

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  let client = null;
  
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    // API Center V1 compliant query:
    // - Returns ALL licenses for the customer
    // - NO filtering by product is_active or is_deleted
    // - NO filtering by license status
    // - Includes archived and inactive products for historical visibility
    const result = await client.query(
      `SELECT 
        l.license_key, 
        l.customer_name, 
        l.customer_email, 
        l.customer_mobile,
        l.customer_phone,
        l.plan, 
        l.status, 
        l.expiry_date, 
        l.max_devices, 
        l.notes, 
        l.created_at,
        p.name as product_name,
        p.is_active as product_is_active,
        p.is_deleted as product_is_deleted
      FROM licenses l
      LEFT JOIN products p ON l.product_id = p.product_id
      WHERE l.customer_email = $1
      ORDER BY l.created_at DESC`,
      [email.toLowerCase()]
    );
    
    client.release();
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Customer not found',
      });
    }
    
    // Transform all licenses into the response format
    const licenses = result.rows.map((license: any) => {
      // Calculate days left for each license
      let daysLeft = 0;
      if (license.expiry_date) {
        const expiry = new Date(license.expiry_date);
        const today = new Date();
        daysLeft = Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      }
      
      // Build each license object with complete historical information
      const customerMobile = license.customer_mobile || license.customer_phone || '';
      const licenseObject: any = {
        license_key: license.license_key,
        customer_name: license.customer_name,
        customer_email: license.customer_email,
        customer_mobile: customerMobile,
        product_name: license.product_name || null,
        product_is_active: license.product_is_active !== null ? (license.product_is_active === true || license.product_is_active === 1) : null,
        product_is_deleted: license.product_is_deleted !== null ? license.product_is_deleted === true : null,
        plan: license.plan,
        status: license.status,
        max_devices: license.max_devices,
        expiry_date: license.expiry_date ? license.expiry_date.split('T')[0] : null,
        days_left: daysLeft,
        notes: license.notes,
        created_at: license.created_at,
      };
      
      return licenseObject;
    });
    
    // Return all licenses with count
    const responseData = {
      success: true,
      customer_email: email.toLowerCase(),
      license_count: licenses.length,
      licenses: licenses,
    };
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Search by email error:', error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to search customer' },
      { status: 500 }
    );
  }
}
// FILE: D:\websmith\app\internal\backend\admin\search\email\route.ts
// PURPOSE: GET search for customer by email
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/admin/search/email?email=customer@example.com
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Database connection pool (EXACT same as health route)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  let client = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email parameter is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    const result = await client.query(
      `SELECT 
        license_key, 
        customer_name, 
        customer_email, 
        plan, 
        status, 
        expiry_date, 
        max_devices, 
        notes, 
        created_at
      FROM licenses 
      WHERE customer_email = $1`,
      [email.toLowerCase()]
    );
    
    client.release();
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Customer not found",
      });
    }
    
    const license = result.rows[0];
    
    let daysLeft = 0;
    if (license.expiry_date) {
      const expiry = new Date(license.expiry_date);
      const today = new Date();
      daysLeft = Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    return NextResponse.json({
      success: true,
      license_key: license.license_key,
      customer_name: license.customer_name,
      customer_email: license.customer_email,
      plan: license.plan,
      status: license.status,
      max_devices: license.max_devices,
      expiry_date: license.expiry_date ? license.expiry_date.split('T')[0] : null,
      days_left: daysLeft,
      notes: license.notes,
      created_at: license.created_at,
      activations_detail: [],
    });
    
  } catch (error) {
    console.error("Search by email error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to search customer" },
      { status: 500 }
    );
  }
}
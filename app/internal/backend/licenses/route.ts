// FILE: app/internal/backend/licenses/route.ts
// PURPOSE: GET licenses with advanced search and filters
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/licenses
// QUERY PARAMS:
//   - search: string (search across license_key, customer_name, customer_email, 
//             customer_username, customer_phone, customer_mobile)
//   - status: string (active, expired, revoked, inactive)
//   - email: string (exact match on customer_email)
//   - phone: string (exact match on customer_phone or customer_mobile)
//   - product_id: string (exact match on product_id)
//   - product: string (partial match on product name)
//   - plan: string (exact match on plan name)
//   - include_deleted: boolean (show deleted licenses, default: false)
//   - date_from: string (ISO date, filter by expiry date from)
//   - date_to: string (ISO date, filter by expiry date to)
//   - limit: number (default: 100, max: 500)
//   - offset: number (default: 0)
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// GET /internal/backend/licenses
// Description: Get licenses with advanced search and filters
// ============================================================
export async function GET(request: NextRequest) {
  let client = null;
  
  try {
    client = await pool.connect();
    const searchParams = request.nextUrl.searchParams;
    
    // Get all query parameters
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const email = searchParams.get('email') || '';
    const phone = searchParams.get('phone') || '';
    const productId = searchParams.get('product_id') || '';
    const product = searchParams.get('product') || '';
    const plan = searchParams.get('plan') || '';
    const includeDeleted = searchParams.get('include_deleted') === 'true';
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    const allowedSortColumns = ['created_at', 'expiry_date', 'license_key', 'customer_name', 'customer_email', 'status', 'plan', 'updated_at', 'last_validated'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    
    const now = new Date().toISOString();
    
    // Build the query with LEFT JOIN to get product name
    let query = `
      SELECT 
        l.license_key,
        l.product_id,
        p.name as product_name,
        l.customer_name,
        l.customer_email,
        l.customer_phone,
        l.customer_mobile,
        COALESCE(l.customer_mobile, l.customer_phone, '') as customer_mobile_display,
        l.customer_username,
        l.plan,
        l.status,
        l.expiry_date,
        l.max_devices,
        l.duration_days,
        l.notes,
        l.created_at,
        l.updated_at,
        l.deleted_at,
        l.deleted_by,
        l.is_activated,
        l.activated_at,
        CASE 
          WHEN l.expiry_date < $1 THEN 0
          ELSE CEIL(EXTRACT(EPOCH FROM (l.expiry_date::timestamp - $1::timestamp)) / 86400)
        END as days_left
      FROM licenses l
      LEFT JOIN products p ON l.product_id = p.product_id
    `;
    
    const params: any[] = [now];
    let paramCounter = 2;
    let conditions: string[] = [];
    
    // Filter: Include deleted licenses (default: exclude)
    if (!includeDeleted) {
      conditions.push(`l.deleted_at IS NULL`);
    }
    
    // Filter: Search across multiple fields (CASE INSENSITIVE)
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(`(
        l.license_key ILIKE $${paramCounter} OR 
        l.customer_name ILIKE $${paramCounter} OR 
        l.customer_email ILIKE $${paramCounter} OR 
        l.customer_username ILIKE $${paramCounter} OR
        l.customer_phone ILIKE $${paramCounter} OR
        l.customer_mobile ILIKE $${paramCounter}
      )`);
      params.push(searchTerm);
      paramCounter++;
    }
    
    // Filter: Status
    if (status && status.trim() !== '') {
      conditions.push(`l.status = $${paramCounter}`);
      params.push(status.trim());
      paramCounter++;
    }
    
    // Filter: Email (exact match, case insensitive)
    if (email && email.trim() !== '') {
      conditions.push(`LOWER(l.customer_email) = LOWER($${paramCounter})`);
      params.push(email.trim());
      paramCounter++;
    }
    
    // Filter: Phone (exact match on customer_phone or customer_mobile)
    if (phone && phone.trim() !== '') {
      const phoneClean = phone.trim().replace(/[^0-9+]/g, '');
      conditions.push(`(
        l.customer_phone = $${paramCounter} OR 
        l.customer_mobile = $${paramCounter}
      )`);
      params.push(phoneClean);
      paramCounter++;
    }
    
    // Filter: Product ID (exact match)
    if (productId && productId.trim() !== '') {
      conditions.push(`l.product_id = $${paramCounter}`);
      params.push(productId.trim());
      paramCounter++;
    }
    
    // Filter: Product name (partial match, case insensitive)
    if (product && product.trim() !== '') {
      conditions.push(`p.name ILIKE $${paramCounter}`);
      params.push(`%${product.trim()}%`);
      paramCounter++;
    }
    
    // Filter: Plan name (exact match, case insensitive)
    if (plan && plan.trim() !== '') {
      conditions.push(`LOWER(l.plan) = LOWER($${paramCounter})`);
      params.push(plan.trim());
      paramCounter++;
    }
    
    // Filter: Date from
    if (dateFrom && dateFrom.trim() !== '') {
      try {
        const fromDate = new Date(dateFrom);
        if (!isNaN(fromDate.getTime())) {
          conditions.push(`l.expiry_date >= $${paramCounter}`);
          params.push(fromDate.toISOString());
          paramCounter++;
        }
      } catch (e) {
        // Invalid date, skip
      }
    }
    
    // Filter: Date to
    if (dateTo && dateTo.trim() !== '') {
      try {
        const toDate = new Date(dateTo);
        if (!isNaN(toDate.getTime())) {
          conditions.push(`l.expiry_date <= $${paramCounter}`);
          params.push(toDate.toISOString());
          paramCounter++;
        }
      } catch (e) {
        // Invalid date, skip
      }
    }
    
    // Apply conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Get total count (for pagination)
    const countQuery = query.replace(
      /SELECT .*? FROM/,
      'SELECT COUNT(*) as total FROM'
    );
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    // Add ordering and pagination
    query += ` ORDER BY l.${safeSortBy} ${sortOrder} LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);
    
    const result = await client.query(query, params);
    
    // Get available products for filter dropdown (only active)
    const productsResult = await client.query(`
      SELECT DISTINCT product_id, name 
      FROM products 
      WHERE (is_deleted = false OR is_deleted IS NULL)
        AND is_active = TRUE
      ORDER BY name
    `);
    
    // Get available plans for filter dropdown (only active)
    const plansResult = await client.query(`
      SELECT DISTINCT name 
      FROM plans 
      WHERE is_active = true
      ORDER BY name
    `);
    
    client.release();
    
    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      },
      filters: {
        available_products: productsResult.rows,
        available_plans: plansResult.rows.map((p: any) => p.name)
      }
    });
    
  } catch (error) {
    console.error("GET licenses error:", error);
    
    if (client) client.release();
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch licenses", data: [] },
      { status: 500 }
    );
  }
}
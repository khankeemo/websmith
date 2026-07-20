// FILE: app/internal/backend/admin/products/route.ts
// PURPOSE: Products API - GET all products, POST create product
// DATABASE: Neon PostgreSQL only
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only
// UPDATED: Product ID is generated from product name
// FORMAT: prod_{lowercase_name_without_special_chars}
// SCOPE: ONLY collection-level operations (GET all, POST create)

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateProductInput, validateProductName, validateProductVersion, validateProductUrl, validateProductPrice, validateProductType, generateApiKey } from '@/core/utils/validation-system';

// ============================================================
// DATABASE CONNECTION
// ============================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// HELPERS
// ============================================================

/**
 * Generate Product ID from product name
 * Format: prod_{lowercase_name_without_special_chars}

 * Example: "MyProduct" → "prod_myproduct"
 */
function generateProductId(name: string): string {
  return 'prod_' + name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// ============================================================
// GET /internal/backend/admin/products
// Description: Get all products (active or archived)
// Query params: archived=true returns archived products
// ============================================================
export async function GET(request: NextRequest) {
  let client = null;
  
  try {
    const url = new URL(request.url);
    const archivedParam = url.searchParams.get("archived");
    const searchParam = url.searchParams.get("search");
    
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (archivedParam === "true") {
      conditions.push("is_deleted = true");
    } else {
      conditions.push("(is_deleted = false OR is_deleted IS NULL)");
    }
    
    if (searchParam && searchParam.trim()) {
      conditions.push(`(name ILIKE $${paramIndex} OR product_id ILIKE $${paramIndex} OR company_name ILIKE $${paramIndex})`);
      params.push(`%${searchParam.trim()}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    client = await pool.connect();
    
    const query = `
      SELECT 
        product_id as id,
        name,
        version,
        description,
        price,
        is_active,
        is_deleted,
        created_at,
        updated_at,
        company_name,
        product_type,
        latest_version,
        website,
        api_key,
        0 as total_licenses
      FROM products
      ${whereClause}
      ORDER BY created_at DESC
    `;
    
    const result = await client.query(query, params);
    client.release();
    
    const products = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      version: row.version || "1.0.0",
      description: row.description || "",
      price: parseFloat(row.price) || 0,
      is_active: row.is_active === true || row.is_active === 1,
      is_deleted: row.is_deleted === true,
      total_licenses: 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
      company_name: row.company_name || "",
      product_type: row.product_type || "",
      latest_version: row.latest_version || row.version,
      website: row.website || "",
      api_key: row.api_key || ""
    }));
    
    return NextResponse.json({
      success: true,
      products,
      count: products.length,
      filter: archivedParam === "true" ? "archived" : "active",
      search: searchParam || null
    });
    
  } catch (error) {
    console.error("❌ GET /products error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch products",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /internal/backend/admin/products
// Description: Create a new product
// Body: { name, description, version, price, is_active, company_name, product_type, website }
// ============================================================
export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    const body = await request.json();
    
    const {
      name,
      description,
      version,
      price,
      is_active,
      company_name,
      product_type,
      website
    } = body;
    
    const validation = await validateProductInput(pool, body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0].message, errors: validation.errors },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    // Generate Product ID from product name
    const productId = generateProductId(name);
    const apiKey = generateApiKey();
    
    const query = `
      INSERT INTO products (
        product_id, name, description, version, price, is_active, 
        company_name, product_type, website, api_key,
        created_at, updated_at, is_deleted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false)
      RETURNING 
        product_id, name, version, description, price, is_active,
        created_at, updated_at, company_name, product_type, website, api_key
    `;
    
    const values = [
      productId,
      name.trim(),
      description || "",
      version || "1.0.0",
      price || 0,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      company_name || "",
      product_type || "",
      website || "",
      apiKey
    ];
    
    const result = await client.query(query, values);
    client.release();
    
    const product = result.rows[0];
    
    // Log product creation
    try {
      const logClient = await pool.connect();
      await logClient.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "product_created",
          `Product created: ${product.name} (${product.product_id})`,
          new Date().toISOString(),
          request.headers.get("x-forwarded-for") || "unknown",
          ""
        ]
      );
      logClient.release();
    } catch (logError) {
      console.error("Failed to log product creation:", logError);
    }
    
    return NextResponse.json({
      success: true,
      product: {
        id: product.product_id,
        name: product.name,
        version: product.version || "1.0.0",
        description: product.description || "",
        price: parseFloat(product.price) || 0,
        is_active: product.is_active === true || product.is_active === 1,
        created_at: product.created_at,
        updated_at: product.updated_at,
        company_name: product.company_name || "",
        product_type: product.product_type || "",
        website: product.website || "",
        api_key: product.api_key || ""
      },
      message: "Product created successfully"
    });
    
  } catch (error) {
    console.error("❌ POST /products error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to create product",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
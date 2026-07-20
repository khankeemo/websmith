// FILE: app/internal/backend/admin/products/[id]/route.ts
// PURPOSE: Product-level operations - GET, PUT, DELETE (soft delete), PATCH (restore)
// DATABASE: Neon PostgreSQL only
// NOTE: Products support SOFT DELETE (is_deleted column exists)
// SCOPE: ONLY product-level operations - NOT plan operations

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { validateProductName, validateProductVersion, validateProductUrl, validateProductPrice, validateProductType } from '@/core/utils/validation-system';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// GET /products/[id]
// Description: Get a single product by ID
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    const { id: productId } = await params;
    
    console.log(`🔍 GET /products/${productId}`);
    
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    const result = await client.query(
      `SELECT 
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
        api_key
      FROM products
      WHERE product_id = $1`,
      [productId]
    );
    
    client.release();
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      product: result.rows[0]
    });
    
  } catch (error) {
    console.error("❌ GET /product error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT /products/[id]
// Description: Update a product
// ============================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    const { id: productId } = await params;
    const body = await request.json();
    
    console.log(`🔄 PUT /products/${productId}`);
    console.log("📦 Body:", body);
    
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    // Check if product exists
    const productCheck = await client.query(
      `SELECT product_id FROM products WHERE product_id = $1`,
      [productId]
    );
    
    if (productCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }
    
    // Validate fields before building query
    const errors: { field: string; message: string }[] = [];
    
    if (body.name !== undefined) {
      const result = validateProductName(body.name);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.version !== undefined) {
      const result = validateProductVersion(body.version);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.latest_version !== undefined) {
      const result = validateProductVersion(body.latest_version);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.price !== undefined) {
      const result = validateProductPrice(body.price);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.product_type !== undefined) {
      const result = validateProductType(body.product_type);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.website !== undefined) {
      const result = validateProductUrl(body.website, 'website');
      if (!result.valid) errors.push(...result.errors);
    }
    
    if (errors.length > 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: errors[0].message, errors },
        { status: 400 }
      );
    }
    
    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;
    
    if (body.name !== undefined) {
      updates.push(`name = $${paramCounter++}`);
      values.push(body.name.trim());
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramCounter++}`);
      values.push(body.description || "");
    }
    if (body.version !== undefined) {
      updates.push(`version = $${paramCounter++}`);
      values.push(body.version);
    }
    if (body.latest_version !== undefined) {
      updates.push(`latest_version = $${paramCounter++}`);
      values.push(body.latest_version);
    }
    if (body.price !== undefined) {
      updates.push(`price = $${paramCounter++}`);
      values.push(body.price);
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramCounter++}`);
      values.push(body.is_active ? 1 : 0);
    }
    if (body.company_name !== undefined) {
      updates.push(`company_name = $${paramCounter++}`);
      values.push(body.company_name || "");
    }
    if (body.product_type !== undefined) {
      updates.push(`product_type = $${paramCounter++}`);
      values.push(body.product_type || "");
    }
    if (body.website !== undefined) {
      updates.push(`website = $${paramCounter++}`);
      values.push(body.website || "");
    }
    
    if (updates.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(productId);
    
    await client.query(
      `UPDATE products SET ${updates.join(", ")} WHERE product_id = $${paramCounter}`,
      values
    );
    
    // Get updated product
    const result = await client.query(
      `SELECT 
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
        api_key
      FROM products
      WHERE product_id = $1`,
      [productId]
    );
    
    client.release();
    
    // Log update
    try {
      const logClient = await pool.connect();
      await logClient.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "product_updated",
          `Product updated: ${result.rows[0].name} (${productId})`,
          new Date().toISOString(),
          request.headers.get("x-forwarded-for") || "unknown",
          ""
        ]
      );
      logClient.release();
    } catch (logError) {
      console.error("Failed to log product update:", logError);
    }
    
    return NextResponse.json({
      success: true,
      product: result.rows[0],
      message: "Product updated successfully"
    });
    
  } catch (error) {
    console.error("❌ PUT /product error:", error);
    if (client) client.release();
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to update product",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /products/[id]
// Description: Soft delete a product (sets is_deleted = true)
// Products retain their data, just marked as deleted
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    const { id: productId } = await params;
    
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';
    
    console.log(`🗑️ DELETE /products/${productId} (${permanent ? 'permanent' : 'soft'} delete)`);
    
    client = await pool.connect();
    
    const productCheck = await client.query(
      `SELECT product_id, name FROM products WHERE product_id = $1`,
      [productId]
    );
    
    if (productCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }
    
    const productName = productCheck.rows[0].name;
    
    if (permanent) {
      try {
        await client.query('BEGIN');
        
        // 1. Delete developer API keys (CASCADE handles api_key_audit_log, api_request_logs, public_api_nonces)
        await client.query(`DELETE FROM developer_api_keys WHERE product_id = $1`, [productId]);
        
        // 2. Delete plans (CASCADE from product handles this via FK)
        await client.query(`DELETE FROM plans WHERE product_id = $1`, [productId]);
        
        // 3. Delete trials (CASCADE from product handles this via FK)
        await client.query(`DELETE FROM trials WHERE product_id = $1`, [productId]);
        
        // 4. Revoke all licenses first, then clean up dependent records
        await client.query(
          `UPDATE licenses SET status = 'revoked', inactive_reason = 'Product Deleted', is_activated = false, updated_at = CURRENT_TIMESTAMP WHERE product_id = $1`,
          [productId]
        );
        
        const licenseKeys = await client.query(
          `SELECT license_key FROM licenses WHERE product_id = $1`, [productId]
        );
        for (const row of licenseKeys.rows) {
          await client.query(`DELETE FROM notification_logs WHERE license_key = $1`, [row.license_key]);
          await client.query(`DELETE FROM activations WHERE license_key = $1`, [row.license_key]);
          await client.query(`DELETE FROM license_bindings WHERE license_key = $1`, [row.license_key]);
          await client.query(`DELETE FROM license_hardware WHERE license_key = $1`, [row.license_key]);
          await client.query(`DELETE FROM renewal_history WHERE license_key = $1`, [row.license_key]);
        }
        await client.query(`DELETE FROM licenses WHERE product_id = $1`, [productId]);
        
        // 5. Clean up audit logs referencing this product
        await client.query(
          `DELETE FROM audit_logs WHERE message LIKE $1`,
          [`%${productId}%`]
        );
        
        // 6. Clean up store-related tables referencing this product
        await client.query(`DELETE FROM order_items WHERE product_id = $1`, [productId]);
        await client.query(`DELETE FROM subscriptions WHERE product_id = $1`, [productId]);
        await client.query(`DELETE FROM wishlist WHERE product_id = $1`, [productId]);
        await client.query(`DELETE FROM customer_licenses WHERE product_id = $1`, [productId]);
        await client.query(`DELETE FROM cart_items WHERE product_id = $1`, [productId]);
        await client.query(`UPDATE coupons SET applies_to_product_id = NULL WHERE applies_to_product_id = $1`, [productId]);
        
        // 7. Clean up coupons' plan references for this product's plans
        await client.query(
          `UPDATE coupons SET applies_to_plan_id = NULL WHERE applies_to_plan_id IN (SELECT id FROM plans WHERE product_id = $1)`,
          [productId]
        );
        
        // 8. Clean up SDK jobs referencing this product
        await client.query(`DELETE FROM sdk_jobs WHERE payload::text LIKE $1`, [`%"productId":"${productId}"%`]);
        
        // 9. Delete the product itself
        await client.query(`DELETE FROM products WHERE product_id = $1`, [productId]);
        
        await client.query('COMMIT');
        
        console.log(`✅ Permanently deleted product: ${productName} (${productId})`);
      } catch (txError) {
        await client.query('ROLLBACK');
        client.release();
        client = null;
        throw txError;
      }
      
      client.release();
      
      return NextResponse.json({
        success: true,
        message: `Product "${productName}" and all related data permanently deleted`
      });
    }
    
    // Soft delete
    const existingCheck = await client.query(
      `SELECT product_id, name FROM products 
       WHERE product_id = $1 AND (is_deleted = false OR is_deleted IS NULL)`,
      [productId]
    );
    
    if (existingCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Product not found or already archived" },
        { status: 404 }
      );
    }
    
    // Disable all active/trial licenses tied to this product before archiving
    await client.query(
      `UPDATE licenses SET status = 'disabled', inactive_reason = 'Product Archived', updated_at = CURRENT_TIMESTAMP WHERE product_id = $1 AND (status = 'active' OR status = 'trial')`,
      [productId]
    );
    
    await client.query(
      `UPDATE products SET is_deleted = true, is_active = false, updated_at = CURRENT_TIMESTAMP WHERE product_id = $1`,
      [productId]
    );
    
    client.release();
    
    try {
      const logClient = await pool.connect();
      await logClient.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "product_archived",
          `Product archived: ${productName} (${productId})`,
          new Date().toISOString(),
          request.headers.get("x-forwarded-for") || "unknown",
          ""
        ]
      );
      logClient.release();
    } catch (logError) {
      console.error("Failed to log product deletion:", logError);
    }
    
    return NextResponse.json({
      success: true,
      message: `Product "${productName}" archived successfully`
    });
    
  } catch (error) {
    console.error("❌ DELETE /product error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Failed to delete product" },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /products/[id]
// Description: Restore a soft-deleted product (sets is_deleted = false)
// ============================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    const { id: productId } = await params;
    
    console.log(`♻️ PATCH /products/${productId} (restore)`);
    
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    // Check if product exists and is deleted
    const productCheck = await client.query(
      `SELECT product_id, name FROM products 
       WHERE product_id = $1 AND is_deleted = true`,
      [productId]
    );
    
    if (productCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Product not found or not archived" },
        { status: 404 }
      );
    }
    
    // Restore - set is_deleted = false
    await client.query(
      `UPDATE products 
       SET is_deleted = false, updated_at = CURRENT_TIMESTAMP
       WHERE product_id = $1`,
      [productId]
    );
    
    client.release();
    
    // Log restore
    try {
      const logClient = await pool.connect();
      await logClient.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "product_restored",
          `Product restored: ${productCheck.rows[0].name} (${productId})`,
          new Date().toISOString(),
          request.headers.get("x-forwarded-for") || "unknown",
          ""
        ]
      );
      logClient.release();
    } catch (logError) {
      console.error("Failed to log product restore:", logError);
    }
    
    return NextResponse.json({
      success: true,
      message: `Product "${productCheck.rows[0].name}" restored successfully`
    });
    
  } catch (error) {
    console.error("❌ PATCH /product error:", error);
    if (client) client.release();
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to restore product",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
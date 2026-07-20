// FILE: app/internal/backend/admin/products/[id]/plans/[planId]/route.ts
// PURPOSE: SINGLE SOURCE OF TRUTH for individual plan operations
// ONLY: GET, PUT, DELETE, PATCH
// NOTE: Plans use HARD DELETE - no is_deleted column in plans table
// SCOPE: ONLY plan-specific operations - NOT product operations

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { validatePlanName, validatePlanPrice, validatePlanDuration, validatePlanTrialDays, validatePlanMaxDevices, validatePlanDisplayOrder, validatePlanFeatures } from '@/core/utils/validation-system';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// GET /products/[id]/plans/[planId]
// Description: Get a single plan by ID
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  let client = null;
  
  try {
    const { id: productId, planId } = await params;
    
    console.log(`🔍 GET /products/${productId}/plans/${planId}`);
    
    if (!productId || !planId) {
      return NextResponse.json(
        { success: false, error: "Product ID and Plan ID are required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    const result = await client.query(
      `SELECT 
        id,
        product_id,
        name,
        description,
        max_devices,
        default_expiry_days as duration_days,
        price,
        is_active,
        features,
        display_order,
        is_trial_plan,
        trial_days_limit,
        created_at,
        updated_at
      FROM plans
      WHERE id = $1 AND product_id = $2`,
      [planId, productId]
    );
    
    client.release();
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Plan not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      plan: result.rows[0]
    });
    
  } catch (error) {
    console.error("❌ GET /plan error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Failed to fetch plan" },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT /products/[id]/plans/[planId]
// Description: Update an existing plan
// ============================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  let client = null;
  
  try {
    const { id: productId, planId } = await params;
    const body = await request.json();
    
    console.log("🔄 PLAN UPDATE ROUTE HIT");
    console.log({
      productId,
      planId,
      timestamp: new Date().toISOString()
    });
    
    if (!productId || !planId) {
      return NextResponse.json(
        { success: false, error: "Product ID and Plan ID are required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    // Check if plan exists
    const planCheck = await client.query(
      `SELECT id, is_trial_plan FROM plans 
       WHERE id = $1 AND product_id = $2`,
      [planId, productId]
    );
    
    if (planCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Plan not found" },
        { status: 404 }
      );
    }
    
    const isTrialPlan = body.is_trial_plan ?? planCheck.rows[0].is_trial_plan;
    
    // Validate fields
    const errors: { field: string; message: string }[] = [];
    if (body.name !== undefined) {
      const result = validatePlanName(body.name);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.price !== undefined) {
      const result = validatePlanPrice(body.price, isTrialPlan);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.duration_days !== undefined) {
      const result = validatePlanDuration(body.duration_days);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.trial_days_limit !== undefined) {
      const result = validatePlanTrialDays(body.trial_days_limit, isTrialPlan);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.max_devices !== undefined) {
      const result = validatePlanMaxDevices(body.max_devices);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.display_order !== undefined) {
      const result = validatePlanDisplayOrder(body.display_order);
      if (!result.valid) errors.push(...result.errors);
    }
    if (body.features !== undefined) {
      const result = validatePlanFeatures(body.features);
      if (!result.valid) errors.push(...result.errors);
    }
    
    if (errors.length > 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: errors[0].message, errors },
        { status: 400 }
      );
    }
    
    // Apply trial plan price override
    if (isTrialPlan) {
      body.price = 0;
    }
    
    // Check duplicate plan name
    if (body.name) {
      const dupCheck = await client.query(
        `SELECT id FROM plans WHERE product_id = $1 AND name = $2 AND id != $3`,
        [productId, body.name.trim(), planId]
      );
      if (dupCheck.rows.length > 0) {
        client.release();
        return NextResponse.json(
          { success: false, error: `Plan "${body.name.trim()}" already exists for this product.` },
          { status: 409 }
        );
      }
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
      values.push(body.description || null);
    }
    if (body.price !== undefined) {
      updates.push(`price = $${paramCounter++}`);
      values.push(body.price);
    }
    if (body.duration_days !== undefined) {
      updates.push(`default_expiry_days = $${paramCounter++}`);
      values.push(body.duration_days);
    }
    if (body.max_devices !== undefined) {
      updates.push(`max_devices = $${paramCounter++}`);
      values.push(body.max_devices);
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramCounter++}`);
      values.push(body.is_active);
    }
    if (body.features !== undefined) {
      updates.push(`features = $${paramCounter++}::jsonb`);
      values.push(JSON.stringify(body.features || []));
    }
    if (body.is_trial_plan !== undefined) {
      updates.push(`is_trial_plan = $${paramCounter++}`);
      values.push(body.is_trial_plan);
    }
    if (body.trial_days_limit !== undefined) {
      updates.push(`trial_days_limit = $${paramCounter++}`);
      values.push(body.trial_days_limit);
    }
    if (body.display_order !== undefined) {
      updates.push(`display_order = $${paramCounter++}`);
      values.push(body.display_order);
    }
    
    if (updates.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(planId);
    
    await client.query(
      `UPDATE plans SET ${updates.join(", ")} WHERE id = $${paramCounter}`,
      values
    );
    
    // Get updated plan
    const result = await client.query(
      `SELECT 
        id,
        product_id,
        name,
        description,
        max_devices,
        default_expiry_days as duration_days,
        price,
        is_active,
        features,
        display_order,
        is_trial_plan,
        trial_days_limit,
        created_at,
        updated_at
      FROM plans
      WHERE id = $1 AND product_id = $2`,
      [planId, productId]
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      plan: result.rows[0],
      message: "Plan updated successfully"
    });
    
  } catch (error) {
    console.error("❌ PUT /plan error:", error);
    if (client) client.release();
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to update plan",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /products/[id]/plans/[planId]
// Description: HARD DELETE a plan - permanently remove from database
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  let client = null;
  
  try {
    const { id: productId, planId } = await params;
    
    console.log("🗑️ PLAN DELETE ROUTE HIT");
    console.log({
      productId,
      planId,
      timestamp: new Date().toISOString()
    });
    
    if (!productId || !planId) {
      return NextResponse.json(
        { success: false, error: "Product ID and Plan ID are required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    // Check if plan exists
    const planCheck = await client.query(
      `SELECT id, name FROM plans WHERE id = $1 AND product_id = $2`,
      [planId, productId]
    );
    
    if (planCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { 
          success: false, 
          error: `Plan with ID ${planId} not found for product ${productId}`
        },
        { status: 404 }
      );
    }
    
    // Check for active/trial licenses
    const licenseCheck = await client.query(
      `SELECT COUNT(*) as count FROM licenses WHERE plan_id = $1 AND (status = 'active' OR status = 'trial')`,
      [planId]
    );
    
    if (parseInt(licenseCheck.rows[0].count) > 0) {
      client.release();
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot delete plan with ${licenseCheck.rows[0].count} active license(s)`
        },
        { status: 409 }
      );
    }
    
    try {
      await client.query('BEGIN');
      
      // Update existing (non-active) licenses referencing this plan
      await client.query(
        `UPDATE licenses SET inactive_reason = 'Plan Deleted', updated_at = CURRENT_TIMESTAMP WHERE plan_id = $1`,
        [planId]
      );
      
      // Clean up orphan references in other tables
      await client.query(`UPDATE trials SET plan_id = NULL WHERE plan_id = $1`, [planId]);
      await client.query(`UPDATE subscriptions SET plan_id = NULL WHERE plan_id = $1`, [planId]);
      await client.query(`UPDATE coupons SET applies_to_plan_id = NULL WHERE applies_to_plan_id = $1`, [planId]);
      await client.query(`UPDATE order_items SET plan_id = NULL WHERE plan_id = $1`, [planId]);
      await client.query(`UPDATE cart_items SET plan_id = NULL WHERE plan_id = $1`, [planId]);
      
      // HARD DELETE - permanently remove the plan
      const result = await client.query(
        `DELETE FROM plans WHERE id = $1 AND product_id = $2 RETURNING id, name`,
        [planId, productId]
      );
      
      await client.query('COMMIT');
      client.release();
      
      return NextResponse.json({
        success: true,
        message: `Plan "${planCheck.rows[0].name}" deleted successfully`,
        deleted: result.rows[0]
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      client.release();
      throw txError;
    }
    
  } catch (error) {
    console.error("❌ DELETE /plan error:", error);
    if (client) client.release();
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to delete plan",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /products/[id]/plans/[planId]
// Description: Partial update of a plan (reuses PUT logic)
// ============================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  // Reuse PUT logic for partial updates
  return PUT(request, { params });
}
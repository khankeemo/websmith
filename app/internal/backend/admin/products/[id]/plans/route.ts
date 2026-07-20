// FILE: app/internal/backend/admin/products/[id]/plans/route.ts
// PURPOSE: Plans API - List, Create, and Reorder plans
// ONLY: GET (list), POST (create), PATCH (reorder only)
// DELETE and PUT are handled by [planId]/route.ts
// NOTE: Plans use HARD DELETE - no is_deleted column

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { validatePlanInput } from '@/core/utils/validation-system';

// ============================================================
// DATABASE CONNECTION
// ============================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// TYPES
// ============================================================
interface PlanInput {
  name: string;
  description?: string | null;
  price: number;
  duration_days?: number;
  max_devices?: number;
  is_active?: boolean;
  features?: string[];
  display_order?: number;
  is_trial_plan?: boolean;
  trial_days_limit?: number;
}

async function checkProductExists(client: any, productId: string): Promise<boolean> {
  const result = await client.query(
    `SELECT product_id FROM products 
     WHERE product_id = $1 
     AND (is_deleted = false OR is_deleted IS NULL)`,
    [productId]
  );
  return result.rows.length > 0;
}

async function getNextDisplayOrder(client: any, productId: string): Promise<number> {
  const result = await client.query(
    `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
     FROM plans 
     WHERE product_id = $1`,
    [productId]
  );
  return result.rows[0].next_order || 1;
}

// ============================================================
// GET /products/[id]/plans
// Description: List all plans for a product
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    const { id: productId } = await params;
    
    console.log(`🔍 GET /products/${productId}/plans`);
    
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    const productExists = await checkProductExists(client, productId);
    if (!productExists) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }
    
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
      WHERE product_id = $1
      ORDER BY display_order ASC, id ASC`,
      [productId]
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      plans: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error("❌ GET /plans error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /products/[id]/plans
// Description: Create a new plan for a product (Trial or Paid)
// ============================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    const { id: productId } = await params;
    const body: PlanInput = await request.json();
    
    console.log("📥 POST /plans - Product:", productId);
    console.log("📥 Body:", JSON.stringify(body, null, 2));
    
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    const productExists = await checkProductExists(client, productId);
    if (!productExists) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }
    
    // Validate input using comprehensive validation system
    const validation = await validatePlanInput(pool, productId, body);
    if (!validation.valid) {
      client.release();
      return NextResponse.json(
        { success: false, error: validation.errors[0].message, errors: validation.errors },
        { status: 400 }
      );
    }
    
    // Get next display order
    let displayOrder = body.display_order;
    if (displayOrder === undefined || displayOrder === null) {
      displayOrder = await getNextDisplayOrder(client, productId);
    }
    
    // ✅ Prepare values
    const isTrialPlan = body.is_trial_plan ?? false;
    const trialDaysLimit = body.trial_days_limit ?? 0;
    
    const values = [
      productId,
      body.name.trim(),
      body.description || null,
      isTrialPlan ? 0 : (body.price ?? 0),
      body.duration_days ?? 0,
      body.max_devices ?? 0,
      body.is_active ?? true,
      JSON.stringify(body.features ?? []),
      displayOrder,
      isTrialPlan,
      trialDaysLimit
    ];
    
    console.log("📥 Inserting plan with values:", {
      productId,
      name: body.name.trim(),
      price: isTrialPlan ? 0 : body.price,
      is_trial_plan: isTrialPlan,
      trial_days_limit: trialDaysLimit
    });
    
    const result = await client.query(
      `INSERT INTO plans (
        product_id,
        name,
        description,
        price,
        default_expiry_days,
        max_devices,
        is_active,
        features,
        display_order,
        is_trial_plan,
        trial_days_limit,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING 
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
        updated_at`,
      values
    );
    
    client.release();
    
    console.log("✅ Plan created successfully:", result.rows[0].id);
    
    return NextResponse.json({
      success: true,
      plan: result.rows[0],
      message: "Plan created successfully"
    }, { status: 201 });
    
  } catch (error) {
    console.error("❌ POST /plans error:", error);
    
    if (client) {
      try { client.release(); } catch (_) {}
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to create plan",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /products/[id]/plans/reorder
// Description: Reorder plans by updating display_order
// ============================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    const { id: productId } = await params;
    const body = await request.json();
    const { planOrders }: { planOrders: { id: number; display_order: number }[] } = body;
    
    console.log(`🔄 PATCH /products/${productId}/plans/reorder`);
    
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }
    
    if (!planOrders || !Array.isArray(planOrders) || planOrders.length === 0) {
      return NextResponse.json(
        { success: false, error: "Plan orders are required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    const productExists = await checkProductExists(client, productId);
    if (!productExists) {
      client.release();
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }
    
    // Update each plan's display_order
    for (const { id, display_order } of planOrders) {
      await client.query(
        `UPDATE plans SET display_order = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND product_id = $3`,
        [display_order, id, productId]
      );
    }
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: "Plans reordered successfully"
    });
    
  } catch (error) {
    console.error("❌ PATCH /plans/reorder error:", error);
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: "Failed to reorder plans" },
      { status: 500 }
    );
  }
}
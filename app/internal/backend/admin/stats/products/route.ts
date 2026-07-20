// FILE: app/internal/backend/admin/stats/products/route.ts
// PURPOSE: Per-Product Statistics API - Get license counts, trial stats, and analytics by product
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/admin/stats/products
// QUERY PARAMS: product_id? (optional, get stats for specific product)
// RULE: Single source of truth - Neon PostgreSQL
// UPDATED: Added trial stats (trials table now has product_id column)

import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  let client = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id");
    const now = new Date().toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    client = await pool.connect();
    
    // ============================================================
    // Get all products (or specific product if product_id provided)
    // ============================================================
    let productsQuery: string;
    let productsParams: any[] = [];
    
    if (productId) {
      productsQuery = `
        SELECT 
          product_id,
          name,
          version,
          description,
          price,
          is_active,
          created_at
        FROM products
        WHERE product_id = $1
        ORDER BY created_at DESC
      `;
      productsParams = [productId];
    } else {
      productsQuery = `
        SELECT 
          product_id,
          name,
          version,
          description,
          price,
          is_active,
          created_at
        FROM products
        ORDER BY created_at DESC
      `;
      productsParams = [];
    }
    
    const productsResult = await client.query(productsQuery, productsParams);
    
    if (productsResult.rows.length === 0) {
      client.release();
      return NextResponse.json({
        success: true,
        products: [],
        summary: {
          total_products: 0,
          total_licenses_all_products: 0,
          total_active_licenses: 0,
          total_revenue: 0,
        },
        message: "No products found. Please add products first.",
      });
    }
    
    const products = productsResult.rows;
    const productIds = products.map(p => p.product_id);
    
    // ============================================================
    // License counts by product
    // ============================================================
    const licenseStatsResult = await client.query(`
      SELECT 
        l.product_id,
        COUNT(*) as total_licenses,
        COUNT(CASE WHEN l.status = 'active' AND l.expiry_date > $1 THEN 1 END) as active_licenses,
        COUNT(CASE WHEN l.expiry_date <= $1 AND l.status != 'revoked' THEN 1 END) as expired_licenses,
        COUNT(CASE WHEN l.status = 'revoked' THEN 1 END) as revoked_licenses,
        COALESCE(SUM(p.price), 0) as revenue
      FROM licenses l
      LEFT JOIN products p ON l.product_id = p.product_id
      WHERE l.product_id = ANY($2::text[])
      GROUP BY l.product_id
    `, [now, productIds]);
    
    const licenseStatsMap = new Map();
    for (const row of licenseStatsResult.rows) {
      licenseStatsMap.set(row.product_id, {
        total: parseInt(row.total_licenses),
        active: parseInt(row.active_licenses),
        expired: parseInt(row.expired_licenses),
        revoked: parseInt(row.revoked_licenses),
        revenue: parseFloat(row.revenue)
      });
    }
    
    // ============================================================
    // Activation stats by product
    // ============================================================
    const activationStatsResult = await client.query(`
      SELECT 
        l.product_id,
        COUNT(a.id) as total_activations,
        COUNT(CASE WHEN a.last_seen > $1 THEN 1 END) as online_devices
      FROM activations a
      JOIN licenses l ON a.license_key = l.license_key
      WHERE l.product_id = ANY($2::text[])
      GROUP BY l.product_id
    `, [oneDayAgo, productIds]);
    
    const activationStatsMap = new Map();
    for (const row of activationStatsResult.rows) {
      activationStatsMap.set(row.product_id, {
        total: parseInt(row.total_activations),
        online: parseInt(row.online_devices)
      });
    }
    
    // ============================================================
    // ✅ TRIAL STATS BY PRODUCT (Now with product_id)
    // ============================================================
    const trialStatsResult = await client.query(`
      SELECT 
        product_id,
        COUNT(*) as total_trials,
        COUNT(CASE WHEN status = 'active' AND expiry_date > $1 THEN 1 END) as active_trials,
        COUNT(CASE WHEN status = 'expired' OR expiry_date <= $1 THEN 1 END) as expired_trials,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_trials
      FROM trials
      WHERE product_id = ANY($2::text[])
      GROUP BY product_id
    `, [now, productIds]);
    
    const trialStatsMap = new Map();
    for (const row of trialStatsResult.rows) {
      const total = parseInt(row.total_trials);
      const converted = parseInt(row.converted_trials);
      trialStatsMap.set(row.product_id, {
        total: total,
        active: parseInt(row.active_trials),
        expired: parseInt(row.expired_trials),
        converted: converted,
        conversion_rate: total > 0 ? Math.round((converted / total) * 100) : 0
      });
    }
    
    // ============================================================
    // Build response
    // ============================================================
    const productStats = [];
    let totalLicensesAll = 0;
    let totalActiveLicensesAll = 0;
    let totalRevenueAll = 0;
    let totalConvertedTrialsAll = 0;
    
    for (const product of products) {
      if (!product || !product.product_id) continue;
      
      const licenseStats = licenseStatsMap.get(product.product_id) || {
        total: 0,
        active: 0,
        expired: 0,
        revoked: 0,
        revenue: 0
      };
      
      const activationStats = activationStatsMap.get(product.product_id) || {
        total: 0,
        online: 0
      };
      
      const trialStats = trialStatsMap.get(product.product_id) || {
        total: 0,
        active: 0,
        expired: 0,
        converted: 0,
        conversion_rate: 0
      };
      
      const productPrice = product.price || 0;
      const revenue = licenseStats.revenue;
      const utilizationRate = licenseStats.total > 0 ? (activationStats.total / licenseStats.total) * 100 : 0;
      
      totalConvertedTrialsAll += trialStats.converted;
      
      productStats.push({
        product_id: product.product_id,
        name: product.name,
        version: product.version || "1.0.0",
        description: product.description || "",
        price: productPrice,
        is_active: product.is_active === true || product.is_active === 1,
        created_at: product.created_at,
        license_stats: {
          total: licenseStats.total,
          active: licenseStats.active,
          expired: licenseStats.expired,
          revoked: licenseStats.revoked,
        },
        hardware_stats: {
          total_activations: activationStats.total,
          online_devices_24h: activationStats.online,
          utilization_rate_percent: Math.round(utilizationRate * 100) / 100,
        },
        trial_stats: {
          active_trials: trialStats.active,
          converted_trials: trialStats.converted,
          conversion_rate_percent: trialStats.conversion_rate,
          total_trials: trialStats.total,
          expired_trials: trialStats.expired,
        },
        revenue: revenue,
      });
      
      totalLicensesAll += licenseStats.total;
      totalActiveLicensesAll += licenseStats.active;
      totalRevenueAll += revenue;
    }
    
    client.release();
    
    return NextResponse.json({
      success: true,
      products: productStats,
      summary: {
        total_products: productStats.length,
        total_licenses_all_products: totalLicensesAll,
        total_active_licenses: totalActiveLicensesAll,
        total_revenue: totalRevenueAll,
        total_converted_trials: totalConvertedTrialsAll,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error("❌ GET /stats/products error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch product statistics",
        products: [],
        summary: {
          total_products: 0,
          total_licenses_all_products: 0,
          total_active_licenses: 0,
          total_revenue: 0,
          total_converted_trials: 0,
        },
      },
      { status: 500 }
    );
  }
}
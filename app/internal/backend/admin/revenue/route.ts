// FILE: D:\websmith\app\internal\backend\admin\revenue\route.ts
// PURPOSE: Revenue Analytics API - Get revenue statistics (with product isolation)
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/admin/revenue
// QUERY PARAMS: period? (month, quarter, year) - defaults to month
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

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
    const period = searchParams.get("period") || "month";
    
    client = await pool.connect();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    let startDate: string;
    let previousStartDate: string;
    
    switch (period) {
      case "quarter":
        const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;
        startDate = new Date(currentYear, (currentQuarter - 1) * 3, 1).toISOString();
        previousStartDate = new Date(currentYear, (currentQuarter - 2) * 3, 1).toISOString();
        break;
      case "year":
        startDate = new Date(currentYear, 0, 1).toISOString();
        previousStartDate = new Date(currentYear - 1, 0, 1).toISOString();
        break;
      default:
        startDate = new Date(currentYear, currentMonth - 1, 1).toISOString();
        previousStartDate = new Date(currentYear, currentMonth - 2, 1).toISOString();
        break;
    }
    
    const endDate = now.toISOString();
    
    const revenueQuery = await client.query(`
      WITH 
      total_stats AS (
        SELECT 
          COALESCE(SUM(p.price), 0) as total_revenue,
          COUNT(l.license_key) as total_licenses
        FROM licenses l
        LEFT JOIN products p ON l.product_id = p.product_id
        WHERE (l.status = 'active' OR l.status = 'expired')
          AND (p.is_active = true OR p.is_active IS NULL)
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
      ),
      current_stats AS (
        SELECT 
          COALESCE(SUM(p.price), 0) as revenue,
          COUNT(l.license_key) as licenses
        FROM licenses l
        LEFT JOIN products p ON l.product_id = p.product_id
        WHERE (l.status = 'active' OR l.status = 'expired')
          AND (p.is_active = true OR p.is_active IS NULL)
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
          AND l.created_at >= $1
          AND l.created_at <= $2
      ),
      previous_stats AS (
        SELECT COALESCE(SUM(p.price), 0) as revenue
        FROM licenses l
        LEFT JOIN products p ON l.product_id = p.product_id
        WHERE (l.status = 'active' OR l.status = 'expired')
          AND (p.is_active = true OR p.is_active IS NULL)
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
          AND l.created_at >= $3
          AND l.created_at < $1
      ),
      product_stats AS (
        SELECT 
          COALESCE(l.product_id, 'no_product') as product_id,
          COALESCE(p.name, 'Unknown Product') as product_name,
          COUNT(l.license_key) as licenses_sold,
          COALESCE(SUM(p.price), 0) as revenue
        FROM licenses l
        LEFT JOIN products p ON l.product_id = p.product_id
        WHERE (l.status = 'active' OR l.status = 'expired')
          AND (p.is_active = true OR p.is_active IS NULL)
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
        GROUP BY l.product_id, p.name
      ),
      monthly_stats AS (
        SELECT 
          DATE_TRUNC('month', l.created_at::timestamp) as month,
          COALESCE(SUM(p.price), 0) as revenue,
          COUNT(l.license_key) as licenses
        FROM licenses l
        LEFT JOIN products p ON l.product_id = p.product_id
        WHERE (l.status = 'active' OR l.status = 'expired')
          AND (p.is_active = true OR p.is_active IS NULL)
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
          AND l.created_at::timestamp >= $4
        GROUP BY DATE_TRUNC('month', l.created_at::timestamp)
      )
      SELECT 
        (SELECT total_revenue FROM total_stats) as total_revenue,
        (SELECT total_licenses FROM total_stats) as total_licenses,
        (SELECT revenue FROM current_stats) as current_revenue,
        (SELECT licenses FROM current_stats) as current_licenses,
        (SELECT revenue FROM previous_stats) as previous_revenue,
        (SELECT json_agg(row_to_json(product_stats)) FROM product_stats) as by_product,
        (SELECT json_agg(
           json_build_object(
             'month', TO_CHAR(month, 'YYYY-MM'),
             'year', EXTRACT(YEAR FROM month),
             'month_name', TO_CHAR(month, 'Mon'),
             'revenue', revenue,
             'licenses', licenses
           )
         ) FROM monthly_stats) as monthly_trend
    `, [startDate, endDate, previousStartDate, 
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()]);
    
    const data = revenueQuery.rows[0];
    
    const totalRevenue = parseFloat(data?.total_revenue || "0");
    const totalLicensesSold = parseInt(data?.total_licenses || "0");
    const currentPeriodRevenue = parseFloat(data?.current_revenue || "0");
    const currentPeriodLicenses = parseInt(data?.current_licenses || "0");
    const previousPeriodRevenue = parseFloat(data?.previous_revenue || "0");
    
    let revenueGrowth = 0;
    if (previousPeriodRevenue > 0) {
      revenueGrowth = ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100;
    } else if (currentPeriodRevenue > 0) {
      revenueGrowth = 100;
    }
    
    const revenueByProduct = data?.by_product || [];
    const monthlyRevenue = data?.monthly_trend || [];
    
    client.release();
    
    return NextResponse.json({
      success: true,
      period: period,
      date_range: {
        start: startDate,
        end: endDate,
      },
      summary: {
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_licenses_sold: totalLicensesSold,
        current_period_revenue: Math.round(currentPeriodRevenue * 100) / 100,
        current_period_licenses: currentPeriodLicenses,
        previous_period_revenue: Math.round(previousPeriodRevenue * 100) / 100,
        revenue_growth_percent: Math.round(revenueGrowth * 100) / 100,
      },
      by_product: revenueByProduct,
      monthly_trend: monthlyRevenue,
      currency: "USD",
    });
    
  } catch (error) {
    console.error("GET /revenue error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch revenue data",
        summary: {
          total_revenue: 0,
          total_licenses_sold: 0,
          current_period_revenue: 0,
          current_period_licenses: 0,
          previous_period_revenue: 0,
          revenue_growth_percent: 0,
        },
        by_product: [],
        monthly_trend: [],
      },
      { status: 500 }
    );
  }
}
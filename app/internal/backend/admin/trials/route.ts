// FILE: app/internal/backend/admin/trials/route.ts
// PURPOSE: GET list of all trials with status and days left, DELETE trial
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/admin/trials, DELETE /internal/backend/admin/trials

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  let client = null;
  
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        hardware_id,
        started_at,
        expiry_date,
        status
      FROM trials
      ORDER BY started_at DESC
    `);
    
    client.release();
    
    const trialsWithDaysLeft = result.rows.map((trial: any) => {
      let daysLeft = 0;
      if (trial.status === 'active' && trial.expiry_date) {
        const expiry = new Date(trial.expiry_date);
        const today = new Date();
        daysLeft = Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      }
      return {
        hardware_id: trial.hardware_id,
        started_at: trial.started_at,
        expiry_date: trial.expiry_date?.split('T')[0],
        status: trial.status,
        days_left: daysLeft,
      };
    });
    
    return NextResponse.json({
      success: true,
      trials: trialsWithDaysLeft,
      count: trialsWithDaysLeft.length,
    });
    
  } catch (error) {
    console.error("Trials error:", error);
    
    if (client) client.release();
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch trials", trials: [] },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  let client = null;
  
  try {
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Trial ID is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    const result = await client.query(
      `DELETE FROM trials WHERE id = $1 RETURNING id`,
      [id]
    );
    
    client.release();
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Trial not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Trial deleted successfully"
    });
    
  } catch (error) {
    console.error("Delete trial error:", error);
    
    if (client) client.release();
    
    return NextResponse.json(
      { success: false, error: "Failed to delete trial" },
      { status: 500 }
    );
  }
}
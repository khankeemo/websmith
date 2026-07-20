// FILE: D:\websmith\app\internal\backend\admin\active-senders\route.ts
// PURPOSE: Active Senders API - Get and update active email/SMS senders
// DATABASE: Neon PostgreSQL only
// ENDPOINTS:
//   GET /internal/backend/admin/active-senders - Get active senders
//   PUT /internal/backend/admin/active-senders - Update active sender
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================================================
// GET /internal/backend/admin/active-senders
// Description: Get currently active email and SMS senders
// ============================================================
export async function GET() {
  let client = null;
  
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        a.id,
        a.type,
        a.sender_id,
        a.updated_at,
        s.value as sender_value,
        s.is_active as sender_is_active
      FROM active_senders a
      JOIN sender_configs s ON a.sender_id = s.id
      ORDER BY a.type
    `);
    
    client.release();
    
    const emailSender = result.rows.find(r => r.type === 'email');
    const smsSender = result.rows.find(r => r.type === 'sms');
    
    return NextResponse.json({
      success: true,
      data: {
        email: emailSender ? {
          id: emailSender.sender_id,
          value: emailSender.sender_value,
          is_active: emailSender.sender_is_active
        } : null,
        sms: smsSender ? {
          id: smsSender.sender_id,
          value: smsSender.sender_value,
          is_active: smsSender.sender_is_active
        } : null
      }
    });
    
  } catch (error) {
    console.error("GET active-senders error:", error);
    
    if (client) client.release();
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch active senders" },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT /internal/backend/admin/active-senders
// Description: Update active sender
// Body: { type: "email" | "sms", sender_id: number }
// ============================================================
export async function PUT(request: NextRequest) {
  let client = null;
  
  try {
    const body = await request.json();
    const { type, sender_id } = body;
    
    if (!type || (type !== 'email' && type !== 'sms')) {
      return NextResponse.json(
        { success: false, error: "Valid type (email or sms) is required" },
        { status: 400 }
      );
    }
    
    if (!sender_id || isNaN(parseInt(sender_id))) {
      return NextResponse.json(
        { success: false, error: "Valid sender_id is required" },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    // Check if sender exists
    const senderCheck = await client.query(
      `SELECT id, value, is_active FROM sender_configs WHERE id = $1 AND type = $2`,
      [sender_id, type]
    );
    
    if (senderCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: `Sender with id ${sender_id} not found for type ${type}` },
        { status: 404 }
      );
    }
    
    // Update active sender
    await client.query(
      `UPDATE active_senders 
       SET sender_id = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE type = $2`,
      [sender_id, type]
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: `${type === 'email' ? 'Email' : 'SMS'} sender updated successfully`,
      data: {
        type,
        sender_id,
        sender_value: senderCheck.rows[0].value
      }
    });
    
  } catch (error) {
    console.error("PUT active-senders error:", error);
    
    if (client) client.release();
    
    return NextResponse.json(
      { success: false, error: "Failed to update active sender" },
      { status: 500 }
    );
  }
}
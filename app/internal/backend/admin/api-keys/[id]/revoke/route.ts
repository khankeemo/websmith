// ============================================================
// FILE: app/internal/backend/admin/api-keys/[id]/revoke/route.ts
// PURPOSE: Revoke an API key
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDb } from '@/lib/backend-db';

function getUserFromToken(request: NextRequest): { id: string; email: string; name: string; role: string } | null {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;
    if (!JWT_SECRET) {
      return null;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name || "Admin",
      role: decoded.role || "admin",
    };
  } catch (error) {
    console.error("❌ Failed to decode token:", error);
    return null;
  }
}

function isAdmin(user: { role: string } | null): boolean {
  return user?.role === 'admin';
}

// ✅ FIXED: Next.js 16 expects params as Promise
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    // ✅ Await the params
    const { id } = await params;
    
    console.log("🔑 Revoke: ID received:", id);
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "API Key ID is required" },
        { status: 400 }
      );
    }
    
    const currentUser = getUserFromToken(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }
    
    if (!isAdmin(currentUser)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }
    
    client = await (await getDb()).connect();
    
    const keyCheck = await client.query(
      `SELECT api_key, status FROM developer_api_keys WHERE id = $1`,
      [id]
    );
    
    if (keyCheck.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: "API Key not found" },
        { status: 404 }
      );
    }
    
    const keyData = keyCheck.rows[0];
    
    if (keyData.status === 'revoked') {
      client.release();
      return NextResponse.json({
        success: true,
        message: "API Key is already revoked",
        already_revoked: true
      });
    }
    
    await client.query(
      `UPDATE developer_api_keys 
       SET status = 'revoked', 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
    
    try {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, link, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          currentUser.id,
          "API Key Revoked",
          `API Key ${keyData.api_key} revoked by ${currentUser.email}`,
          "api_key_revoked",
          `/internal/api/public-api/keys`
        ]
      );
    } catch (notifError) {
      console.error("⚠️ Failed to create notification:", notifError);
    }

    try {
      await client.query(
        `INSERT INTO api_key_audit_log (key_id, action, performed_by, metadata, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [id, 'revoke', currentUser.id, JSON.stringify({ api_key: keyData.api_key })]
      );
    } catch (auditError) {
      console.error("⚠️ Failed to log audit event:", auditError);
    }

    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp)
         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        ['api_key_revoked', `API Key ${keyData.api_key} revoked by ${currentUser.email}`]
      );
    } catch (logError) {
      console.error("⚠️ Failed to write audit log:", logError);
    }
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: "API Key revoked successfully",
      revoked: true,
      api_key: keyData.api_key
    });
    
  } catch (error) {
    console.error("❌ Revoke API Key error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to revoke API key"
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDb } from '@/lib/backend-db';
import { hashSecret, generateApiKey } from '@/core/utils/validation-system';

function generateProductPrefix(productName: string): string {
  const clean = productName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.length <= 4) {
    return clean.padEnd(4, 'x');
  }
  return `${clean.slice(0, 2)}${clean.slice(-2)}`;
}

function generateProductSecret(productName: string): string {
  const prefix = generateProductPrefix(productName);
  return `sk_${prefix}_${generateApiKey().replace('ws_', '')}`;
}

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    const { id } = await params;
    
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
      `SELECT id, api_key, status, product_id FROM developer_api_keys WHERE id = $1`,
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
    
    if (keyData.status !== 'active') {
      client.release();
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot rotate secret for ${keyData.status} API key. Only active keys can be rotated.`
        },
        { status: 400 }
      );
    }
    
    const productCheck = await client.query(
      `SELECT name FROM products WHERE product_id = $1`,
      [keyData.product_id]
    );
    const productName = productCheck.rows[0]?.name || 'Unknown';
    
    const newSecret = generateProductSecret(productName);
    const newSecretHash = hashSecret(newSecret);
    
    await client.query(
      `UPDATE developer_api_keys 
       SET secret_hash = $1, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newSecretHash, id]
    );
    
    try {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, link, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          currentUser.id,
          "API Key Secret Rotated",
          `Secret rotated for API Key ${keyData.api_key} by ${currentUser.email}`,
          "api_key_rotated",
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
        [id, 'rotate', currentUser.id, JSON.stringify({ api_key: keyData.api_key })]
      );
    } catch (auditError) {
      console.error("⚠️ Failed to log audit event:", auditError);
    }

    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp)
         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        ['api_key_rotated', `Secret rotated for API Key ${keyData.api_key} by ${currentUser.email}`]
      );
    } catch (logError) {
      console.error("⚠️ Failed to write audit log:", logError);
    }
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: "Secret rotated successfully",
      api_key: keyData.api_key,
      new_secret: newSecret,
      warning: "⚠️ Copy the new secret now. It will not be shown again."
    });
    
  } catch (error) {
    console.error("❌ Rotate API Key error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to rotate secret"
      },
      { status: 500 }
    );
  }
}

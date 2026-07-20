// ============================================================
// FILE: app/internal/backend/admin/api-keys/route.ts
// PURPOSE: Admin API Key Management - Generate, List, Revoke, Rotate
// DATABASE: developer_api_keys table
// SECURITY: Admin only - JWT authentication required
// 
// KEY NAMING CONVENTION:
//   API Key:   pk_{product_prefix}_{32_random_chars}
//   Secret:    sk_{product_prefix}_{48_random_chars}
//   Prefix:    First 2 + Last 2 letters of product name (lowercase)
//   Example:   MyProduct → mypr → pk_mypr_XXXXXXXX
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDb } from '@/lib/backend-db';
import { validateApiKeyCreation, hashSecret, generateApiKey } from '@/core/utils/validation-system';

// ============================================================
// HELPERS
// ============================================================

/**
 * Generate product prefix from product name
 * Takes first 2 and last 2 letters of the product name
 * Example: MyProduct → My + uct = myuct
 * Example: WebSmith → we + th = weth
 */
function generateProductPrefix(productName: string): string {
  const clean = productName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.length <= 4) {
    return clean.padEnd(4, 'x');
  }
  return `${clean.slice(0, 2)}${clean.slice(-2)}`;
}

/**
 * Generate Product-Based API Key
 * Format: pk_{prefix}_{32_random_chars}
 * Example: pk_zeos_U2FTC81QRE07CDQD9P7I8CP1EQOF3GHX
 */
function generateProductApiKey(productName: string): string {
  const prefix = generateProductPrefix(productName);
  return `pk_${prefix}_${generateApiKey().replace('ws_', '')}`;
}

/**
 * Generate Product-Based Secret
 * Format: sk_{prefix}_{48_random_chars}
 * Example: sk_zeos_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */
function generateProductSecret(productName: string): string {
  const prefix = generateProductPrefix(productName);
  return `sk_${prefix}_${generateApiKey().replace('ws_', '')}`;
}

// Get user from JWT
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

// Check if user is admin
function isAdmin(user: { role: string } | null): boolean {
  return user?.role === 'admin';
}

// Log audit event
async function logAuditEvent(
  client: any,
  keyId: string,
  action: string,
  userId: string,
  metadata: any
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO api_key_audit_log (key_id, action, performed_by, metadata, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [keyId, action, userId, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error("⚠️ Failed to log audit event:", error);
  }
}

// ============================================================
// GET /internal/backend/admin/api-keys
// PURPOSE: List all API keys
// ============================================================

export async function GET(request: NextRequest) {
  let client = null;
  
  try {
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
    
    const result = await client.query(
      `SELECT 
        dk.id,
        dk.product_id,
        p.name as product_name,
        dk.api_key,
        dk.secret_hash,
        dk.status,
        dk.permissions,
        dk.rate_limit,
        dk.last_used_at,
        dk.created_at,
        dk.expires_at
      FROM developer_api_keys dk
      LEFT JOIN products p ON dk.product_id = p.product_id
      ORDER BY dk.created_at DESC`
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      keys: result.rows,
    });
    
  } catch (error) {
    console.error("❌ GET API Keys error:", error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /internal/backend/admin/api-keys
// PURPOSE: Generate a new API key with product-based naming
// ============================================================

export async function POST(request: NextRequest) {
  let client = null;
  
  try {
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
    
    const body = await request.json();
    const { product_id, permissions, rate_limit, expires_at } = body;
    
    // Use comprehensive validation
    const dbPool = await getDb();
    const validation = await validateApiKeyCreation(dbPool, product_id, expires_at);
    
    client = await dbPool.connect();
    if (!validation.valid) {
      client.release();
      return NextResponse.json(
        { success: false, error: validation.errors[0].message, errors: validation.errors },
        { status: 400 }
      );
    }
    
    const productName = validation.data.productName;
    const productPrefix = generateProductPrefix(productName);
    
    // Generate product-based API key and secret
    const apiKey = generateProductApiKey(productName);
    const secret = generateProductSecret(productName);
    const secretHash = hashSecret(secret);
    
    // Default permissions
    const defaultPermissions = permissions || ['license:read', 'license:write', 'trial:read', 'device:write'];
    const defaultRateLimit = rate_limit || 1000;
    
    // Insert into database
    const result = await client.query(
      `INSERT INTO developer_api_keys (
        product_id,
        api_key,
        secret_hash,
        status,
        permissions,
        rate_limit,
        expires_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING id, product_id, api_key, status, permissions, rate_limit, expires_at, created_at`,
      [
        product_id,
        apiKey,
        secretHash,
        'active',
        defaultPermissions,
        defaultRateLimit,
        expires_at || null
      ]
    );
    
    const newKey = result.rows[0];
    
    // Create notification
    try {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, link, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          currentUser.id,
          `API Key Generated for ${productName}`,
          `New API Key generated for "${productName}" (${apiKey.slice(0, 12)}...)`,
          "api_key_generated",
          `/internal/api/public-api/keys`
        ]
      );
    } catch (notifError) {
      console.error("⚠️ Failed to create notification:", notifError);
    }
    
    // Log audit event
    await logAuditEvent(
      client,
      newKey.id,
      'generate',
      currentUser.id,
      {
        product_id,
        product_name: productName,
        api_key: apiKey.slice(0, 12) + '...',
        permissions: defaultPermissions,
        rate_limit: defaultRateLimit
      }
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: `API Key generated successfully for ${productName}`,
      api_key: apiKey,
      secret: secret,
      key_data: {
        id: newKey.id,
        product_id: newKey.product_id,
        product_name: productName,
        product_prefix: productPrefix,
        status: newKey.status,
        permissions: newKey.permissions,
        rate_limit: newKey.rate_limit,
        expires_at: newKey.expires_at,
        created_at: newKey.created_at,
      },
      warning: "⚠️ Copy the secret now. It will not be shown again."
    });
    
  } catch (error) {
    console.error("❌ Generate API Key error:", error);
    
    if (client) {
      client.release();
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Detailed error:", errorMessage);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : '');
    
    return NextResponse.json(
      { success: false, error: "Failed to generate API key", detail: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /internal/backend/admin/api-keys/:id
// PURPOSE: Permanently delete an API key and all related records
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    const { id } = await params;
    
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
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "API Key ID is required" },
        { status: 400 }
      );
    }
    
    client = await (await getDb()).connect();
    
    const keyCheck = await client.query(
      `SELECT id, api_key, product_id FROM developer_api_keys WHERE id = $1`,
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
    
    // Hard delete inside a transaction
    await client.query('BEGIN');
    
    try {
      await client.query(`DELETE FROM api_request_logs WHERE api_key_id = $1`, [id]);
      await client.query(`DELETE FROM public_api_nonces WHERE api_key_id = $1`, [id]);
      await client.query(`DELETE FROM developer_api_keys WHERE id = $1`, [id]);
      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    }
    
    // Log audit event outside transaction
    try {
      const auditClient = await (await getDb()).connect();
      await logAuditEvent(
        auditClient,
        id,
        'delete',
        currentUser.id,
        {
          api_key: keyData.api_key.slice(0, 12) + '...',
          product_id: keyData.product_id
        }
      );
      auditClient.release();
    } catch (auditError) {
      console.error("⚠️ Failed to log audit event:", auditError);
    }
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: "API Key and all related records permanently deleted",
      deleted: true,
      api_key: keyData.api_key
    });
    
  } catch (error) {
    console.error("❌ Delete API Key error:", error);
    
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      client.release();
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete API key"
      },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT /internal/backend/admin/api-keys/:id/rotate
// PURPOSE: Rotate the secret for an API key
// ============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  
  try {
    const { id } = await params;
    
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
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "API Key ID is required" },
        { status: 400 }
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
    
    // Get product name for new secret
    const productCheck = await client.query(
      `SELECT name FROM products WHERE product_id = $1`,
      [keyData.product_id]
    );
    const productName = productCheck.rows[0]?.name || 'Unknown';
    
    // Generate new secret with product-based naming
    const newSecret = generateProductSecret(productName);
    const newSecretHash = hashSecret(newSecret);
    
    await client.query(
      `UPDATE developer_api_keys 
       SET secret_hash = $1, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newSecretHash, id]
    );
    
    // Create notification
    try {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, link, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          currentUser.id,
          "API Key Secret Rotated",
          `Secret rotated for API Key ${keyData.api_key.slice(0, 12)}...`,
          "api_key_rotated",
          `/internal/api/public-api/keys`
        ]
      );
    } catch (notifError) {
      console.error("⚠️ Failed to create notification:", notifError);
    }
    
    // Log audit event
    await logAuditEvent(
      client,
      id,
      'rotate',
      currentUser.id,
      {
        api_key: keyData.api_key.slice(0, 12) + '...',
        product_id: keyData.product_id
      }
    );
    
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
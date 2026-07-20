// ============================================================
// FILE: lib/public-api/auth.ts
// PURPOSE: API Key validation and product isolation
// DATABASE: developer_api_keys table
// ============================================================

import { getDb } from '@/lib/backend-db';

export interface AuthResult {
  apiKeyId: string;
  productId: string;
  productName: string;  // ✅ ADDED: Product name for display
  permissions: string[];
  rateLimit: number;
}

export interface AuthError {
  code: string;
  message: string;
}

export async function validateApiKey(apiKey: string): Promise<AuthResult> {
  let client = null;
  
  try {
    if (!apiKey) {
      throw { code: 'INVALID_API_KEY', message: 'API key is required' };
    }

    client = await (await getDb()).connect();

    // 1. Get the API key
    const result = await client.query(
      `SELECT 
        id,
        product_id,
        permissions,
        rate_limit,
        status,
        expires_at
      FROM developer_api_keys
      WHERE api_key = $1`,
      [apiKey]
    );

    if (result.rows.length === 0) {
      throw { code: 'INVALID_API_KEY', message: 'Invalid API key' };
    }

    const key = result.rows[0];

    // 2. Check status
    if (key.status !== 'active') {
      throw { 
        code: 'API_KEY_INACTIVE', 
        message: `API key is ${key.status}` 
      };
    }

    // 3. Check expiration
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      throw { 
        code: 'API_KEY_EXPIRED', 
        message: 'API key has expired' 
      };
    }

    // 4. ✅ FETCH PRODUCT NAME
    let productName = key.product_id; // Fallback to product_id
    try {
      const productResult = await client.query(
        `SELECT name FROM products WHERE product_id = $1 AND is_active = TRUE`,
        [key.product_id]
      );
      if (productResult.rows.length > 0) {
        productName = productResult.rows[0].name;
      }
    } catch (err) {
      // If product lookup fails, use product_id as fallback
      console.warn(`⚠️ Failed to fetch product name for ${key.product_id}:`, err);
    }

    // 5. Update last_used_at
    await client.query(
      `UPDATE developer_api_keys 
       SET last_used_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [key.id]
    );

    client.release();

    // 6. ✅ RETURN WITH PRODUCT NAME
    return {
      apiKeyId: key.id,
      productId: key.product_id,
      productName: productName,  // ✅ NOW INCLUDED
      permissions: key.permissions || ['license:read'],
      rateLimit: key.rate_limit || 1000
    };

  } catch (error) {
    if (client) {
      client.release();
    }
    throw error;
  }
}

export async function validateProductMatch(
  apiKeyProductId: string,
  licenseProductId: string
): Promise<boolean> {
  if (apiKeyProductId !== licenseProductId) {
    throw {
      code: 'PRODUCT_MISMATCH',
      message: 'License does not belong to the product associated with this API key'
    };
  }
  return true;
}
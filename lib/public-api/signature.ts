// ============================================================
// FILE: lib/public-api/signature.ts
// PURPOSE: HMAC signature + Nonce verification for replay protection
// CONTRACT: Shared secret = API key (available to both SDK and backend)
// DATABASE: public_api_nonces table
// ============================================================

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/backend-db';

const TIMESTAMP_WINDOW = parseInt(process.env.PUBLIC_API_SIGNATURE_TTL || '300', 10); // 5 minutes

export interface SignatureHeaders {
  apiKey: string;
  timestamp: string;
  nonce: string;
  signature: string;
}

export async function verifySignature(request: NextRequest, secret: string): Promise<{ apiKeyId: string; nonce: string }> {
  let client = null;
  
  try {
    // 1. Extract headers
    const apiKey = request.headers.get('X-API-Key');
    const timestamp = request.headers.get('X-Timestamp');
    const nonce = request.headers.get('X-Nonce');
    const signature = request.headers.get('X-Signature');

    if (!apiKey || !timestamp || !nonce || !signature) {
      throw {
        code: 'MISSING_HEADERS',
        message: 'Missing required headers: X-API-Key, X-Timestamp, X-Nonce, X-Signature'
      };
    }

    // 2. Validate timestamp
    const ts = new Date(timestamp).getTime();
    const now = Date.now();
    const diff = Math.abs(now - ts) / 1000;

    if (isNaN(ts) || diff > TIMESTAMP_WINDOW) {
      throw {
        code: 'INVALID_TIMESTAMP',
        message: `Timestamp expired or invalid. Window is ${TIMESTAMP_WINDOW} seconds`
      };
    }

    // 3. Get request body
    let body = '';
    try {
      const cloned = request.clone();
      const json = await cloned.json();
      body = JSON.stringify(json);
    } catch {
      body = '';
    }

    // 4. Build message for HMAC
    const method = request.method;
    const path = new URL(request.url).pathname;
    const query = new URL(request.url).search || '';
    const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
    
    const message = `${method}\n${path}\n${query}\n${bodyHash}\n${timestamp}\n${nonce}`;

    // 5. Verify HMAC
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64');

    if (signature !== expectedSignature) {
      throw {
        code: 'INVALID_SIGNATURE',
        message: 'Invalid HMAC signature'
      };
    }

    // 6. Verify nonce (replay protection)
    client = await (await getDb()).connect();

    const nonceResult = await client.query(
      `SELECT nonce FROM public_api_nonces WHERE nonce = $1`,
      [nonce]
    );

    if (nonceResult.rows.length > 0) {
      throw {
        code: 'DUPLICATE_NONCE',
        message: 'Nonce already used - possible replay attack'
      };
    }

    // 7. Store nonce
    const apiKeyResult = await client.query(
      `SELECT id FROM developer_api_keys WHERE api_key = $1`,
      [apiKey]
    );

    if (apiKeyResult.rows.length === 0) {
      throw {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key'
      };
    }

    const apiKeyId = apiKeyResult.rows[0].id;

    await client.query(
      `INSERT INTO public_api_nonces (nonce, api_key_id, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [nonce, apiKeyId]
    );

    client.release();

    return { apiKeyId, nonce };

  } catch (error) {
    if (client) {
      client.release();
    }
    throw error;
  }
}

export function generateSignature(
  secret: string,
  method: string,
  path: string,
  query: string,
  body: any,
  timestamp: string,
  nonce: string
): string {
  const bodyStr = body ? JSON.stringify(body) : '';
  const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
  const message = `${method}\n${path}\n${query}\n${bodyHash}\n${timestamp}\n${nonce}`;
  
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('base64');
}
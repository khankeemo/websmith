// ============================================================
// FILE: lib/public-api/audit.ts
// PURPOSE: Audit logging to api_request_logs table
// ============================================================

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export interface AuditData {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress: string;
  userAgent: string;
  latencyMs: number;
  requestRedacted?: any;
}

export async function logRequest(data: AuditData): Promise<void> {
  let client = null;
  
  try {
    // Only log if enabled
    if (process.env.PUBLIC_API_AUDIT_ENABLED !== 'true') {
      return;
    }

    client = await pool.connect();

    const redacted = data.requestRedacted || {};

    await client.query(
      `INSERT INTO api_request_logs (
        api_key_id,
        endpoint,
        method,
        status_code,
        ip_address,
        user_agent,
        latency_ms,
        request_redacted,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [
        data.apiKeyId,
        data.endpoint,
        data.method,
        data.statusCode,
        data.ipAddress || 'unknown',
        data.userAgent || 'unknown',
        data.latencyMs || 0,
        JSON.stringify(redacted)
      ]
    );

    client.release();

  } catch (error) {
    console.error('Failed to log audit:', error);
    if (client) {
      client.release();
    }
  }
}

export async function logSecurityViolation(
  apiKeyId: string,
  endpoint: string,
  method: string,
  ipAddress: string,
  userAgent: string,
  error: { code: string; message: string }
): Promise<void> {
  await logRequest({
    apiKeyId,
    endpoint,
    method,
    statusCode: 403,
    ipAddress,
    userAgent,
    latencyMs: 0,
    requestRedacted: {
      error: error.code,
      message: error.message
    }
  });
}

export function redactSensitiveData(body: any): any {
  if (!body) return {};
  
  const redacted = { ...body };
  
  // Redact sensitive fields
  const sensitiveFields = ['password', 'secret', 'token', 'otp', 'otp_code', 'phone'];
  
  for (const field of sensitiveFields) {
    if (redacted[field]) {
      redacted[field] = '[REDACTED]';
    }
  }
  
  return redacted;
}
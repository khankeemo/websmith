import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey } from '@/lib/public-api/auth';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest } from '@/lib/public-api/audit';
import { validateEmail, validateHardwareId } from '@/core/utils/validation-system';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let dbClient = null;
  let apiKeyId = '';

  try {
    const apiKey = request.headers.get('X-API-Key');
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!apiKey) return NextResponse.json({ success: false, error: 'API key required' }, { status: 401 });

    const auth = await validateApiKey(apiKey);
    apiKeyId = auth.apiKeyId;

    const rate = await checkRateLimit(auth.apiKeyId, ipAddress, 'customer_register');
    if (!rate.allowed) return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });

    const body = await request.json();
    const { name, email, mobile, country_code, company_name, hardware_id } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 });
    }

    // Allow partial data — missing name/mobile/hardware_id default to empty string
    const safeName = (name || '').trim();
    const safeMobile = (mobile || '').trim();
    const safeHardwareId = (hardware_id || '').trim();
    const safeCountryCode = (country_code || '').trim();
    const safeCompanyName = (company_name || '').trim();

    dbClient = await pool.connect();

    // Ensure columns exist (runtime migration)
    await dbClient.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT ''
    `);
    await dbClient.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS hardware_id TEXT DEFAULT ''
    `);
    await dbClient.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT ''
    `);

    await dbClient.query(
      `INSERT INTO customers (name, email, phone, company, company_name, country_code, hardware_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       ON CONFLICT (email) DO UPDATE SET
         name = COALESCE(NULLIF($1, ''), customers.name),
         phone = COALESCE(NULLIF($3, ''), customers.phone),
         company = COALESCE(NULLIF($4, ''), customers.company),
         company_name = COALESCE(NULLIF($5, ''), customers.company_name),
         country_code = COALESCE(NULLIF($6, ''), customers.country_code),
         hardware_id = COALESCE(NULLIF($7, ''), customers.hardware_id),
         status = 'active',
         updated_at = CURRENT_TIMESTAMP`,
      [safeName, email, safeMobile, safeCompanyName, safeCompanyName, safeCountryCode, safeHardwareId]
    );

    await logRequest({
      apiKeyId, endpoint: '/api/v1/customer/register', method: 'POST',
      statusCode: 200, latencyMs: Date.now() - startTime, ipAddress, userAgent,
      requestRedacted: { email, name: safeName, action: 'customer_registered' },
    });

    return NextResponse.json({
      success: true,
      message: 'Customer registered successfully',
      customer: { name: safeName, email, mobile: safeMobile, country_code: safeCountryCode, company_name: safeCompanyName },
    });
  } catch (error) {
    await logRequest({
      apiKeyId, endpoint: '/api/v1/customer/register', method: 'POST',
      statusCode: 500, latencyMs: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      requestRedacted: { error: 'register_failed', action: 'failure' },
    });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    if (dbClient) dbClient.release();
  }
}

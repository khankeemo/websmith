import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey } from '@/lib/public-api/auth';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest } from '@/lib/public-api/audit';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

function codeToFlag(code: string): string {
  return String.fromCodePoint(...code.split('').map(c => 0x1F1E6 + c.codePointAt(0)! - 65));
}

export async function POST(request: NextRequest) {
  return handleCountries(request);
}

export async function GET(request: NextRequest) {
  return handleCountries(request);
}

async function handleCountries(request: NextRequest) {
  const startTime = Date.now();
  let apiKeyId = '';

  try {
    const apiKey = request.headers.get('X-API-Key');
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key required' }, { status: 401 });
    }

    const auth = await validateApiKey(apiKey);
    apiKeyId = auth.apiKeyId;

    const rate = await checkRateLimit(auth.apiKeyId, ipAddress, 'countries');
    if (!rate.allowed) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    let countries: { code: string; name: string; dial: string; flag: string }[] = [];
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT code, name, dial, min_digits, max_digits FROM countries WHERE is_active = TRUE ORDER BY display_order ASC, name ASC'
        );
        countries = result.rows.map(r => ({ ...r, flag: codeToFlag(r.code) }));
      } finally {
        client.release();
      }
    } catch (dbError) {
      console.warn('[countries] DB unavailable:', dbError);
    }

    await logRequest({
      apiKeyId, endpoint: '/api/v1/countries', method: request.method,
      statusCode: 200, latencyMs: Date.now() - startTime, ipAddress, userAgent,
      requestRedacted: { action: 'countries_listed', count: countries.length },
    });

    return NextResponse.json({ success: true, data: countries });
  } catch (error) {
    await logRequest({
      apiKeyId, endpoint: '/api/v1/countries', method: request.method,
      statusCode: 500, latencyMs: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      requestRedacted: { error: 'countries_failed' },
    });
    return NextResponse.json({ success: true, data: [] });
  }
}

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
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let client = null;
  let apiKeyId = '';

  try {
    const apiKey = request.headers.get('X-API-Key');
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_API_KEY', message: 'X-API-Key header is required' }
      }, { status: 401 });
    }

    let authResult;
    try {
      authResult = await validateApiKey(apiKey);
      apiKeyId = authResult.apiKeyId;
    } catch (authError: any) {
      return NextResponse.json({
        success: false,
        error: { code: authError.code || 'AUTH_ERROR', message: authError.message || 'Authentication failed' }
      }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, '/api/v1/communication/list');
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Try again later.' }
      }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('customer_email') || '').trim().toLowerCase();
    const category = searchParams.get('category') || '';

    if (!email) {
      const body = await request.json().catch(() => ({}));
      const bodyEmail = (body.customer_email || '').trim().toLowerCase();
      if (!bodyEmail) {
        return NextResponse.json({
          success: false,
          error: { code: 'MISSING_EMAIL', message: 'customer_email is required' }
        }, { status: 400 });
      }
    }

    client = await pool.connect();

    const queryEmail = email || (await request.json().catch(() => ({}))).customer_email?.trim().toLowerCase();
    let query = 'SELECT * FROM communication_conversations WHERE LOWER(customer_email) = $1 AND deleted_at IS NULL';
    const params: any[] = [queryEmail];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }

    query += ' ORDER BY updated_at DESC';

    const result = await client.query(query, params);
    client.release();
    client = null;

    await logRequest({
      apiKeyId, endpoint: '/api/v1/communication/list', method: 'GET',
      statusCode: 200, ipAddress, userAgent,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      data: { conversations: result.rows },
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Communication list error:', error);

    if (client) { client.release(); }

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list conversations.' }
    }, { status: 500 });
  }
}
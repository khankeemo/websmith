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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const startTime = Date.now();
  let client = null;
  let apiKeyId = '';
  
  try {
    const { requestId } = await params;
    
    const apiKey = request.headers.get('X-API-Key');
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
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

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, `/api/v1/support/${requestId}/messages`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Try again later.' }
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.reset)
        }
      });
    }

    // Get hardware_id from query params
    const searchParams = request.nextUrl.searchParams;
    const hardwareId = searchParams.get('hardware_id');

    if (!hardwareId) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_HARDWARE_ID', message: 'hardware_id query parameter is required' }
      }, { status: 400 });
    }

    client = await pool.connect();

    // Verify the request exists and get its customer_email for authorization
    const requestResult = await client.query(
      `SELECT customer_email, status FROM requests WHERE request_id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      client.release();
      client = null;
      
      return NextResponse.json({
        success: false,
        error: { code: 'REQUEST_NOT_FOUND', message: 'Support request not found' }
      }, { status: 404 });
    }

    const reqData = requestResult.rows[0];

    // Get conversation messages
    const messagesResult = await client.query(
      `SELECT 
        id, request_id, sender_type, sender_name, sender_email, message, 
        is_internal, email_sent, email_error, created_at
       FROM conversation_messages
       WHERE request_id = $1
       ORDER BY created_at ASC`,
      [requestId]
    );

    client.release();
    client = null;

    // Also include the original request message
    const originalRequestResult = await client?.query(
      `SELECT request_id, customer_name, customer_email, subject, message, created_at 
       FROM requests WHERE request_id = $1`,
      [requestId]
    ).catch(() => ({ rows: [] }));

    const originalMessage = originalRequestResult?.rows[0] ? {
      id: 0,
      request_id: requestId,
      sender_type: 'customer',
      sender_name: originalRequestResult.rows[0].customer_name || 'Customer',
      sender_email: originalRequestResult.rows[0].customer_email || '',
      message: originalRequestResult.rows[0].message,
      is_internal: false,
      email_sent: false,
      email_error: null,
      created_at: originalRequestResult.rows[0].created_at
    } : null;

    const allMessages = originalMessage ? [originalMessage, ...messagesResult.rows] : messagesResult.rows;

    await logRequest({
      apiKeyId,
      endpoint: `/api/v1/support/${requestId}/messages`,
      method: 'GET',
      statusCode: 200,
      ipAddress,
      userAgent,
      latencyMs: Date.now() - startTime,
      requestRedacted: { request_id: requestId }
    });

    return NextResponse.json({
      success: true,
      data: {
        request_id: requestId,
        status: reqData.status,
        messages: allMessages
      }
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Support conversation error:', error);
    
    if (client) {
      client.release();
    }
    
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' }
    }, { status: 500 });
  }
}
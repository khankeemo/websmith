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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, `/api/v1/communication/${id}`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Try again later.' }
      }, { status: 429 });
    }

    client = await pool.connect();

    const convResult = await client.query(
      'SELECT * FROM communication_conversations WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (convResult.rows.length === 0) {
      client.release();
      client = null;

      return NextResponse.json({
        success: false,
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' }
      }, { status: 404 });
    }

    const msgsResult = await client.query(
      `SELECT id, sender_type, sender_name, sender_email, message, has_attachments, created_at
       FROM conversation_messages
       WHERE conversation_id = $1 AND is_internal = false
       ORDER BY created_at ASC`,
      [id]
    );

    const attResult = await client.query(
      `SELECT cm.id as message_id, ca.id as attachment_id, ca.file_name, ca.file_size, ca.mime_type, ca.uploaded_at
       FROM conversation_messages cm
       LEFT JOIN conversation_attachments ca ON cm.id = ca.message_id
       WHERE cm.conversation_id = $1 AND ca.id IS NOT NULL
       ORDER BY ca.uploaded_at ASC`,
      [id]
    );

    client.release();
    client = null;

    await logRequest({
      apiKeyId, endpoint: `/api/v1/communication/${id}`, method: 'GET',
      statusCode: 200, ipAddress, userAgent,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      data: {
        conversation: convResult.rows[0],
        messages: msgsResult.rows,
        attachments: attResult.rows,
      },
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Communication get error:', error);

    if (client) { client.release(); }

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load conversation.' }
    }, { status: 500 });
  }
}
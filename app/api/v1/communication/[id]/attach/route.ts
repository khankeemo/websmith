import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateApiKey } from '@/lib/public-api/auth';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest } from '@/lib/public-api/audit';
import path from 'path';
import fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const ALLOWED_MIME_TYPES = [
  'text/plain', 'text/csv', 'text/html', 'text/xml',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/json', 'application/pdf',
  'application/octet-stream',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_MESSAGE = 5;

export async function POST(
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

    const rateLimitResult = await checkRateLimit(apiKeyId, ipAddress, `/api/v1/communication/${id}/attach`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Try again later.' }
      }, { status: 429 });
    }

    client = await pool.connect();

    const convResult = await client.query(
      'SELECT * FROM communication_conversations WHERE id = $1',
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

    const existingAttachments = await client.query(
      'SELECT COUNT(*) as count FROM conversation_attachments WHERE message_id IN (SELECT id FROM conversation_messages WHERE conversation_id = $1)',
      [id]
    );

    const existingCount = parseInt(existingAttachments.rows[0]?.count || '0', 10);
    if (existingCount >= MAX_FILES_PER_MESSAGE) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'MAX_ATTACHMENTS_EXCEEDED', message: `Maximum ${MAX_FILES_PER_MESSAGE} attachments per conversation.` }
      }, { status: 400 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_CONTENT_TYPE', message: 'Content-Type must be multipart/form-data' }
      }, { status: 400 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_FORM_DATA', message: 'Failed to parse form data' }
      }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FILE', message: 'file field is required in form data' }
      }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` }
      }, { status: 400 });
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'UNSUPPORTED_FILE_TYPE', message: `File type ${mimeType} is not supported.` }
      }, { status: 400 });
    }

    const storagePath = process.env.ATTACHMENT_STORAGE_PATH || path.join(process.cwd(), 'public', 'attachments');
    const convDir = path.join(storagePath, id);
    fs.mkdirSync(convDir, { recursive: true });

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${sanitizedName}`;
    const filePath = path.join(convDir, uniqueName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const now = new Date().toISOString();
    const attachmentId = `ATT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await client.query(
      `INSERT INTO conversation_attachments
       (message_id, file_name, file_size, mime_type, storage_path, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, sanitizedName, file.size, mimeType, filePath, now]
    );

    await client.query(
      `UPDATE conversation_messages SET has_attachments = true WHERE conversation_id = $1`,
      [id]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
       VALUES ($1, $2, $3, $4, $5)`,
      ['attachment_uploaded', `Attachment ${sanitizedName} (${file.size} bytes) uploaded to conversation ${id}`, now, ipAddress, convResult.rows[0]?.license_key || null]
    );

    client.release();
    client = null;

    await logRequest({
      apiKeyId, endpoint: `/api/v1/communication/${id}/attach`, method: 'POST',
      statusCode: 200, ipAddress, userAgent,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      message: 'Attachment uploaded successfully.',
      attachment_id: attachmentId,
      file_name: sanitizedName,
      file_size: file.size,
      mime_type: mimeType,
    }, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.reset)
      }
    });

  } catch (error: any) {
    console.error('Attachment upload error:', error);

    if (client) { client.release(); }

    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to upload attachment.' }
    }, { status: 500 });
  }
}

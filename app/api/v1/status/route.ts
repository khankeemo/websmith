import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/public-api/auth';
import { checkRateLimit } from '@/lib/public-api/rate-limit';
import { logRequest } from '@/lib/public-api/audit';

export async function GET(request: NextRequest) {
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

    const rate = await checkRateLimit(auth.apiKeyId, ipAddress, 'status');
    if (!rate.allowed) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    await logRequest({
      apiKeyId, endpoint: '/api/v1/status', method: 'GET',
      statusCode: 200, latencyMs: Date.now() - startTime, ipAddress, userAgent,
      requestRedacted: { action: 'status_check' },
    });

    return NextResponse.json({
      success: true,
      data: {
        status: 'ok',
        service: 'Websmith Universal License API',
        version: '1.0.0'
      }
    });
  } catch (error) {
    await logRequest({
      apiKeyId, endpoint: '/api/v1/status', method: 'GET',
      statusCode: 500, latencyMs: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      requestRedacted: { error: 'status_failed' },
    });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

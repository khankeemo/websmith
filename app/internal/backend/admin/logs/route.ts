// FILE: D:\websmith\app\internal\backend\admin\logs\route.ts
// PURPOSE: GET audit logs (admin wrapper) - redirects to main logs endpoint
// DATABASE: Neon PostgreSQL only
// ENDPOINT: GET /internal/backend/admin/logs?limit=50&offset=0
// RULE 02: All code stays inside /internal - no main website interference
// RULE 2: Single Database Policy - Neon PostgreSQL only
// NOTE: This is a wrapper that redirects to /internal/backend/logs to avoid duplication

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') || '100';
  const offset = searchParams.get('offset') || '0';
  
  // Redirect to main logs endpoint
  const url = new URL('/internal/backend/logs', request.url);
  url.searchParams.set('limit', limit);
  url.searchParams.set('offset', offset);
  
  try {
    const authHeader = request.headers.get('authorization') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    const response = await fetch(url.toString(), { headers });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Admin logs proxy error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs", data: [] },
      { status: 500 }
    );
  }
}
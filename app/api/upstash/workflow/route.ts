/**
 * app/api/upstash/workflow/route.ts
 * 
 * Upstash Workflow Endpoint - Receives QStash messages
 * 
 * RESPONSIBILITIES:
 * - Extract workflow payload from request
 * - Invoke sdk-workflow
 * - Return HTTP response
 * 
 * ARCHITECTURE:
 * - Single pipeline only (Pipeline A)
 * - No business logic
 * - No SDK generation
 * - No queue manipulation
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeSDKWorkflow, WorkflowPayload } from '@/lib/upstatsworkflow/sdk-workflow';

export async function POST(req: NextRequest) {
  console.log(`[Upstash] 001 workflow handler invoked`);

  try {
    // Log raw body before parsing
    const rawText = await req.text();
    console.log(`[Upstash] 002 RAW body length:`, rawText?.length || 0);
    console.log(`[Upstash] 003 RAW body preview:`, rawText?.substring(0, 500));
    console.log(`[Upstash] 004 Content-Type:`, req.headers.get('content-type'));
    console.log(`[Upstash] 005 All headers:`, Object.fromEntries(req.headers.entries()));

    // Parse the request body
    const payload: WorkflowPayload = JSON.parse(rawText);

    console.log(`[Upstash] 006 payload received, jobId:`, payload?.jobId || 'UNKNOWN');
    console.log(`[Upstash] 007 payload:`, payload);

    const result = await executeSDKWorkflow(payload);

    console.log(`[Upstash] 008 workflow completed for job: ${payload.jobId}`);
    console.log(`[Upstash] 009 result:`, {
      success: result.success,
      status: result.status,
      error: result.error || 'none',
    });

    return NextResponse.json(
      {
        success: result.success,
        jobId: result.jobId,
        status: result.status,
        ...(result.error && { error: result.error }),
        ...(result.result && { result: result.result }),
      },
      { status: result.success ? 200 : 500 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack';

    console.error(`[Upstash] 010 ❌ Workflow error`);
    console.error(`[Upstash] error message:`, errorMessage);
    console.error(`[Upstash] error stack:`, errorStack);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'SDK Workflow endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
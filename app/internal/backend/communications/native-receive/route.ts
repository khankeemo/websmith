import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { runNativeReceiveCycle } from '@/lib/communications/native-receive-core';

// IMAP connect + parse + insert cycles need longer than the default 10s
// serverless budget; QStash is configured with a matching 60s timeout.
export const maxDuration = 60;

// ============================================================================
// UNIVERSAL NATIVE RECEIVE — QStash entry point (AWS-01 R01)
//
// Thin wrapper: the actual receive cycle lives in
// `lib/communications/native-receive-core.ts` so the SAME single pipeline can
// also be triggered on demand by the Query Inbox bridge (throttled) — a client
// email reply then reaches Messenger Chat in seconds instead of waiting up to
// a full minute for this cron fire. Security is unchanged: only QStash-signed
// requests are accepted here.
// ============================================================================

const nativeReceiveHandler = async (_request: NextRequest) => {
  try {
    const result = await runNativeReceiveCycle();
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Native receive error:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Native receive failed.' }
    }, { status: 500 });
  }
};

export const POST = verifySignatureAppRouter(nativeReceiveHandler, {
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || 'development_dummy_key_current',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || 'development_dummy_key_next',
  url: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/internal/backend/communications/native-receive`
    : undefined,
});

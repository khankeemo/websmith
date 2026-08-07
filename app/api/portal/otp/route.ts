// FILE: app/api/portal/otp/route.ts
// PURPOSE: OTP send/verify for the Universal Buy & Renew Portal. Reuses the
//          shared portal OTP service (same email template + otp_verifications
//          table as the rest of the platform). Rate-limited per IP.

import { NextRequest, NextResponse } from 'next/server';
import { getPortalDb } from '@/lib/portal/db';
import { sendPortalOtp, verifyPortalOtp } from '@/lib/portal/otp';

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const action = body?.action;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || 'unknown';
  const pool = getPortalDb();

  if (action === 'send') {
    const email = body?.email;
    const result = await sendPortalOtp(pool, email, ipAddress);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: 'OTP sent successfully', expires_in: result.expires_in });
  }

  if (action === 'verify') {
    const { email, otp } = body || {};
    const result = await verifyPortalOtp(pool, email, otp);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          attempts_used: result.attempts_used,
          max_attempts: result.max_attempts,
          expired: result.expired,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, message: 'OTP verified successfully' });
  }

  return NextResponse.json(
    { success: false, error: 'Invalid action. Supported actions: send, verify' },
    { status: 400 }
  );
}

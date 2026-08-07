// FILE: app/api/portal/order/create/route.ts
// PURPOSE: Portal order creation for BOTH Buy and Renew. Reuses the store's
//          createPendingOrder() (single payment/pricing pipeline — NO new
//          implementation). Enforces server-side OTP verification (never
//          trusts client OTP state) and, for renew, license eligibility via
//          resolveGlobalLicenseStatus().

import { NextRequest, NextResponse } from 'next/server';
import { getPortalDb } from '@/lib/portal/db';
import { hasVerifiedPortalOtp } from '@/lib/portal/otp';
import { createPendingOrder } from '@/lib/store/checkout';
import { resolveGlobalLicenseStatus } from '@/lib/license/serializer';
import { isValidEmail } from '@/lib/validation';

const ALLOWED_GATEWAYS = ['dummy', 'stripe', 'razorpay', 'paddle', 'lemonsqueezy'];

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const pool = getPortalDb();
  const mode = body?.mode === 'renew' ? 'renew' : 'buy';
  const customer = body?.customer || {};
  const email = (customer.email || '').trim().toLowerCase();

  if (!isValidEmail(email)) {
    return NextResponse.json({ success: false, error: 'Valid customer email is required' }, { status: 400 });
  }
  if (!customer.firstName || !customer.lastName) {
    return NextResponse.json({ success: false, error: 'First and last name are required' }, { status: 400 });
  }

  // SERVER-SIDE OTP gate — payment must never proceed without a verified OTP.
  const otpOk = await hasVerifiedPortalOtp(pool, email);
  if (!otpOk) {
    return NextResponse.json(
      { success: false, error: 'OTP verification is required before placing an order.' },
      { status: 403 }
    );
  }

  // Renewal-specific validation (never trust the client's license claims).
  if (mode === 'renew') {
    const licenseKey = (body?.license_key || '').trim().toUpperCase();
    if (!licenseKey) {
      return NextResponse.json({ success: false, error: 'License key is required for renewal' }, { status: 400 });
    }
    const { verdict, ctx } = await resolveGlobalLicenseStatus(pool, { licenseKey });
    const renewable = verdict.status === 'ACTIVE' || verdict.status === 'EXPIRED';
    if (!renewable) {
      return NextResponse.json(
        {
          success: false,
          status: verdict.status,
          code: verdict.code,
          reason: verdict.reason,
          message: verdict.message,
          actions: verdict.actions,
        },
        { status: verdict.httpStatus }
      );
    }
    if (String(ctx?.license?.customer_email || '').toLowerCase() !== email) {
      return NextResponse.json(
        { success: false, error: 'This license does not belong to the verified email address.' },
        { status: 403 }
      );
    }

    const productId = ctx?.license?.product_id;
    const planId = parseInt(String(body?.plan_id || ''), 10);
    if (!productId) {
      return NextResponse.json({ success: false, error: 'License product not found' }, { status: 400 });
    }

    const result = await createPendingOrder(pool, {
      customer: toCustomerInput(customer),
      items: [{ productId, planId: isNaN(planId) ? undefined : planId, quantity: 1 }],
      paymentGateway: sanitizeGateway(body?.payment_gateway),
      notes: `Portal renewal for license ${licenseKey}`,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      mode: 'renew',
      order_number: result.order?.order_number,
      totals: result.totals,
    });
  }

  // BUY mode
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ success: false, error: 'Please select a product and plan' }, { status: 400 });
  }
  const normalizedItems = items.map((it: any) => ({
    productId: String(it?.product_id || ''),
    planId: it?.plan_id ? parseInt(String(it.plan_id), 10) : undefined,
    quantity: Math.max(1, parseInt(String(it?.quantity || '1'), 10) || 1),
  }));
  if (normalizedItems.some((it: any) => !it.productId)) {
    return NextResponse.json({ success: false, error: 'A valid product is required' }, { status: 400 });
  }

  const result = await createPendingOrder(pool, {
    customer: toCustomerInput(customer),
    items: normalizedItems,
    paymentGateway: sanitizeGateway(body?.payment_gateway),
    notes: body?.notes || '',
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    mode: 'buy',
    order_number: result.order?.order_number,
    totals: result.totals,
  });
}

function toCustomerInput(customer: any) {
  return {
    firstName: String(customer.firstName || '').trim(),
    lastName: String(customer.lastName || '').trim(),
    email: String(customer.email || '').trim().toLowerCase(),
    company: String(customer.company || '').trim(),
    mobile: String(customer.mobile || customer.mobileNumber || '').trim(),
    alternativeMobile: String(customer.alternativeMobile || customer.lastMobile || '').trim(),
    addressLine1: String(customer.address_line1 || customer.addressLine1 || '').trim(),
    addressLine2: String(customer.address_line2 || customer.addressLine2 || '').trim(),
    city: String(customer.city || '').trim(),
    state: String(customer.state || '').trim(),
    country: String(customer.country || '').trim(),
    postalCode: String(customer.postal_code || customer.postalCode || '').trim(),
  };
}

function sanitizeGateway(gw: unknown): string {
  const value = String(gw || '').trim().toLowerCase();
  return ALLOWED_GATEWAYS.includes(value) ? value : 'dummy';
}
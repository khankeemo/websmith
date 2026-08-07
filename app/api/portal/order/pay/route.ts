// FILE: app/api/portal/order/pay/route.ts
// PURPOSE: Portal payment capture + fulfillment for BOTH Buy and Renew.
//          •  BUY   → reuse store fulfillOrder() → generates a NEW license.
//          •  RENEW → reuse portal renewal fulfill → EXTENDS the existing
//                     license (never creates a new one). The license key is
//                     derived SERVER-SIDE from the order's recorded notes, so
//                     paid -> client value is never trusted.
//
//          === No duplicate payment logic === The payment/gateway handling is
//          entirely reused: createPendingOrder() (order) is the same as the
//          Software Store, and fulfillment is the store's fulfillOrder() for
//          purchases / a shared renewal fulfillment for renewals.

import { NextRequest, NextResponse } from 'next/server';
import { getPortalDb } from '@/lib/portal/db';
import { fulfillOrder } from '@/lib/store/checkout';
import { fulfillPortalRenewal } from '@/lib/store/renewal';

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const orderNumber = String(body?.order_number || '').trim();
  if (!orderNumber) {
    return NextResponse.json({ success: false, error: 'Order number is required' }, { status: 400 });
  }

  const pool = getPortalDb();
  let client = null;
  let order: any = null;

  // Load the order to derive intent server-side (never trust client mode).
  try {
    client = await pool.connect();
    const r = await client.query(`SELECT order_number, status, notes FROM orders WHERE order_number = $1`, [orderNumber]);
    order = r.rows[0] || null;
  } catch (error) {
    console.error('portal pay: load order error:', error);
  } finally {
    if (client) client.release();
  }

  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }
  if (order.status === 'completed') {
    return NextResponse.json({ success: false, error: 'This order has already been fulfilled.' }, { status: 409 });
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ success: false, error: 'This order cannot be paid.' }, { status: 409 });
  }

  const notes = order.notes || '';
  const isRenewal = /portal renewal/i.test(notes);
  // License key is bound to the order server-side at create time (order.notes).
  const keyMatch = notes.match(/license\s+([A-Z0-9-]+)/i);
  const renewalLicenseKey = keyMatch ? String(keyMatch[1]).toUpperCase() : null;

  try {
    if (isRenewal) {
      if (!renewalLicenseKey) {
        return NextResponse.json({ success: false, error: 'Renewal license binding is missing.' }, { status: 400 });
      }
      const result = await fulfillPortalRenewal(pool, orderNumber, renewalLicenseKey);
      return NextResponse.json({
        success: true,
        mode: 'renew',
        order_number: orderNumber,
        ...result,
      });
    }

    // BUY — generate a NEW license via the store's fulfillment pipeline.
    const result = await fulfillOrder(pool, orderNumber, { gateway: 'dummy' });
    const license = result.licenses?.[0] || null;
    return NextResponse.json({
      success: true,
      mode: 'buy',
      order_number: orderNumber,
      order: result.order,
      licenses: result.licenses || [],
      license_key: license?.license_key || '',
      expiry_date: license?.expiry_date || '',
      plan: license?.plan || '',
      max_devices: license?.max_devices || 1,
      payment: result.payment || null,
      totals: result.payment ? { total: result.payment.amount, currency: result.payment.currency } : undefined,
    });
  } catch (error: any) {
    console.error('portal order pay error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Payment processing failed. Please try again.' },
      { status: 400 }
    );
  }
}
// FILE: app/api/v1/checkout/pay/route.ts
// PURPOSE: Payment capture — dummy gateway in development.
//          Payment success → payment record → license generation →
//          plan assignment → customer (if new) → email → communication
//          log → audit log → dashboard (license-derived) update.
//          No payment success = no license generation.
// ACCESS: Public (software store)

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { fulfillOrder } from '@/lib/store/checkout';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.order_number) {
      return NextResponse.json({ success: false, error: 'order_number is required' }, { status: 400 });
    }

    const orderNumber = String(body.order_number).trim();

    let orderCheck = null;
    try {
      const c = await pool.connect();
      try {
        const r = await c.query(`SELECT status, total, currency FROM orders WHERE order_number = $1`, [orderNumber]);
        orderCheck = r.rows[0] || null;
      } finally {
        c.release();
      }
    } catch { /* orders table not ready */ }

    if (!orderCheck) {
      return NextResponse.json({ success: false, error: 'Order not found. Please restart checkout.' }, { status: 404 });
    }
    if (orderCheck.status === 'completed') {
      return NextResponse.json({ success: false, error: 'This order has already been paid and fulfilled' }, { status: 409 });
    }
    if (orderCheck.status === 'cancelled' || orderCheck.status === 'refunded') {
      return NextResponse.json({ success: false, error: 'This order cannot be paid' }, { status: 409 });
    }

    const result = await fulfillOrder(pool, orderNumber, {
      gateway: 'dummy',
      transactionId: `TXN-${Date.now().toString(36).toUpperCase()}`,
    });

    return NextResponse.json({
      success: true,
      order_number: orderNumber,
      payment: {
        payment_number: result.payment.payment_number,
        gateway: result.payment.gateway,
        transaction_id: result.payment.transaction_id,
        amount: result.payment.amount,
        currency: result.payment.currency,
        status: result.payment.status,
      },
      licenses: result.licenses.map((l: any) => ({
        license_key: l.license_key,
        product_id: l.product_id,
        plan: l.plan,
        expiry_date: l.expiry_date,
        max_devices: l.max_devices,
      })),
      totals: {
        subtotal: result.order.subtotal,
        discount: result.order.discount,
        tax: result.order.tax,
        total: result.order.total,
        currency: result.order.currency,
      },
      email_sent: true,
    });
  } catch (error: any) {
    console.error('checkout pay error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Payment processing failed. Please try again.' }, { status: 500 });
  }
}

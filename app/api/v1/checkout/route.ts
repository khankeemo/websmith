// FILE: app/api/v1/checkout/route.ts
// PURPOSE: Public checkout — creates a PENDING order (no payment).
//          Payment must succeed via /api/v1/checkout/pay before any
//          license is generated. Customer record is upserted here so the
//          order and every later step reference the SAME customer.
// ACCESS: Public (software store)

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { createPendingOrder } from '@/lib/store/checkout';
import { isValidEmail, isValidMobile } from '@/lib/validation';

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
    if (!body) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const { customer, items, coupon_code, payment_gateway, notes } = body;

    if (!customer || !isValidEmail(customer.email)) {
      return NextResponse.json({ success: false, error: 'A valid email address is required' }, { status: 400 });
    }
    if (!customer.firstName || !customer.lastName) {
      return NextResponse.json({ success: false, error: 'First name and last name are required' }, { status: 400 });
    }

    // Universal mobile validation against the selected country's rules.
    // The country dial is stored/transmitted alongside the local number but is
    // NOT part of the local digit count — strip it before validating.
    if (customer.mobile) {
      let country = null;
      if (customer.country) {
        try {
          const cRes = await pool.query(
            `SELECT dial, min_digits, max_digits FROM countries WHERE name = $1 OR code = $2`,
            [customer.country, customer.country]
          );
          if (cRes.rows.length > 0) {
            const row = cRes.rows[0];
            country = { dial: row.dial, minDigits: row.min_digits, maxDigits: row.max_digits };
          }
        } catch { /* countries table may not exist */ }
      }
      let digits = String(customer.mobile || '').replace(/\D/g, '').replace(/^0+/, '');
      const dialDigits = country?.dial ? String(country.dial).replace(/\D/g, '') : '';
      if (dialDigits && digits.startsWith(dialDigits)) {
        digits = digits.slice(dialDigits.length).replace(/^0+/, '');
      }
      if (!isValidMobile(country, digits)) {
        const ruleError = country
          ? `Mobile number must contain ${country.minDigits}${country.minDigits !== country.maxDigits ? `–${country.maxDigits}` : ''} digits for the selected country`
          : 'Mobile number is required and must contain digits only';
        return NextResponse.json({ success: false, error: ruleError }, { status: 400 });
      }
    }

    const result = await createPendingOrder(pool, {
      customer: {
        firstName: String(customer.firstName || '').trim(),
        lastName: String(customer.lastName || '').trim(),
        email: String(customer.email || '').trim(),
        company: String(customer.company || '').trim(),
        mobile: String(customer.mobile || '').replace(/\s/g, ''),
        alternativeMobile: String(customer.alternative_mobile || '').replace(/\s/g, ''),
        addressLine1: String(customer.address_line1 || '').trim(),
        addressLine2: String(customer.address_line2 || '').trim(),
        city: String(customer.city || '').trim(),
        state: String(customer.state || '').trim(),
        country: String(customer.country || '').trim(),
        postalCode: String(customer.postal_code || '').trim(),
      },
      items: Array.isArray(items) ? items.map((i: any) => ({
        productId: String(i.product_id || i.productId || ''),
        planId: i.plan_id ?? i.planId ?? undefined,
        quantity: parseInt(String(i.quantity || 1)) || 1,
      })) : [],
      couponCode: coupon_code || '',
      paymentGateway: payment_gateway || 'dummy',
      notes: notes || '',
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to create order' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order_number: result.order!.order_number,
      order_id: result.order!.id,
      totals: result.totals,
    });
  } catch (error) {
    console.error('checkout create error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create order. Please try again.' }, { status: 500 });
  }
}

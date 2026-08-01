// FILE: lib/store/checkout.ts
// PURPOSE: Shared purchase workflow — the only place that creates orders,
//          records payments, and fulfills paid orders into licenses.
//          Used by: public checkout API (/api/v1/checkout/*), admin order
//          processing (/internal/backend/admin/orders/*), sales module.
// RULE: Single source of truth for the purchase pipeline. No other module
//       may insert into orders / order_items / payments.

import { Pool, PoolClient } from 'pg';
import { triggerNotification } from '@/lib/notification/notification-service';
import { generateLicenseKey } from '@/core/utils/validation-system';
import { generateOrderNumber, generateInvoiceNumber } from '@/lib/store/index';
import { isValidEmail } from '@/lib/validation';

export interface CheckoutCustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  mobile?: string;
  alternativeMobile?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface CheckoutItemInput {
  productId: string;
  planId?: number;
  quantity: number;
}

export interface CheckoutTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  taxName: string;
}

export interface CreateOrderInput {
  customer: CheckoutCustomerInfo;
  items: CheckoutItemInput[];
  couponCode?: string;
  paymentGateway?: string;
  notes?: string;
}

export interface FulfillResult {
  order: any;
  orderItems: any[];
  licenses: any[];
  payment: any;
  invoice: any;
}

// ============================================================
// CUSTOMER — single source of truth
// All modules must use this helper; no other INSERT INTO customers upserts.
// ============================================================

export interface CustomerUpsertInput {
  email: string;
  name?: string;
  phone?: string;
  mobile?: string;
  alternativeMobile?: string;
  company?: string;
  country?: string;
  countryCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  notes?: string;
  customerType?: string;
}

export async function upsertCustomer(client: PoolClient, input: CustomerUpsertInput): Promise<any> {
  const email = (input.email || '').trim().toLowerCase();
  const r = await client.query(
    `INSERT INTO customers (
       email, name, phone, mobile, alternative_mobile, company, country, country_code,
       address_line1, address_line2, city, state, postal_code, notes,
       customer_type, status, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT (email) DO UPDATE SET
       name = COALESCE(NULLIF($2,''), customers.name),
       phone = COALESCE(NULLIF($3,''), customers.phone),
       mobile = COALESCE(NULLIF($4,''), customers.mobile),
       alternative_mobile = COALESCE(NULLIF($5,''), customers.alternative_mobile),
       company = COALESCE(NULLIF($6,''), customers.company),
       country = COALESCE(NULLIF($7,''), customers.country),
       country_code = COALESCE(NULLIF($8,''), customers.country_code),
       address_line1 = COALESCE(NULLIF($9,''), customers.address_line1),
       address_line2 = COALESCE(NULLIF($10,''), customers.address_line2),
       city = COALESCE(NULLIF($11,''), customers.city),
       state = COALESCE(NULLIF($12,''), customers.state),
       postal_code = COALESCE(NULLIF($13,''), customers.postal_code),
       notes = COALESCE(NULLIF($14,''), customers.notes),
       customer_type = CASE WHEN customers.customer_type IS NULL OR customers.customer_type = '' THEN $15 ELSE customers.customer_type END,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      email,
      (input.name || '').trim(),
      (input.phone || input.mobile || '').trim(),
      (input.mobile || input.phone || '').trim(),
      (input.alternativeMobile || '').trim(),
      (input.company || '').trim(),
      (input.country || '').trim(),
      (input.countryCode || '').trim(),
      (input.addressLine1 || '').trim(),
      (input.addressLine2 || '').trim(),
      (input.city || '').trim(),
      (input.state || '').trim(),
      (input.postalCode || '').trim(),
      (input.notes || '').trim(),
      (input.customerType || 'active').trim(),
    ]
  );
  return r.rows[0];
}

export function customerFullName(c: CheckoutCustomerInfo): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
}

// ============================================================
// TAX / COUPON / PRICING (server-authoritative — client never sets prices)
// ============================================================

export async function loadTaxConfig(client: PoolClient): Promise<{ taxRate: number; taxName: string; currency: string }> {
  try {
    const r = await client.query(`SELECT tax_rate, tax_name, currency FROM payment_config WHERE id = 1`);
    if (r.rows.length > 0) {
      return {
        taxRate: Number(r.rows[0].tax_rate) || 0,
        taxName: r.rows[0].tax_name || 'VAT',
        currency: r.rows[0].currency || 'USD',
      };
    }
  } catch { /* config table not created yet */ }
  return { taxRate: 0, taxName: 'VAT', currency: 'USD' };
}

export async function validateCoupon(
  client: PoolClient,
  code: string,
  subtotal: number,
  customerEmail: string
): Promise<{ valid: boolean; discount: number; error?: string; coupon?: any }> {
  if (!code || !code.trim()) return { valid: true, discount: 0 };
  try {
    const r = await client.query(
      `SELECT * FROM coupons WHERE LOWER(code) = LOWER($1) LIMIT 1`,
      [code.trim()]
    );
    if (r.rows.length === 0) return { valid: false, discount: 0, error: 'Invalid coupon code' };
    const coupon = r.rows[0];
    if (!coupon.is_active) return { valid: false, discount: 0, error: 'Coupon is no longer active' };
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { valid: false, discount: 0, error: 'Coupon has expired' };
    }
    if (coupon.max_uses > 0 && coupon.current_uses >= coupon.max_uses) {
      return { valid: false, discount: 0, error: 'Coupon usage limit reached' };
    }
    if (coupon.min_purchase_amount > 0 && subtotal < Number(coupon.min_purchase_amount)) {
      return { valid: false, discount: 0, error: `Minimum purchase of ${coupon.min_purchase_amount} required for this coupon` };
    }
    const discount =
      coupon.discount_type === 'percentage'
        ? subtotal * (Number(coupon.discount_value) / 100)
        : Math.min(Number(coupon.discount_value), subtotal);
    return { valid: true, discount: Math.round(discount * 100) / 100, coupon };
  } catch (e) {
    console.error('validateCoupon error:', e);
    return { valid: false, discount: 0, error: 'Could not validate coupon' };
  }
}

// ============================================================
// CREATE PENDING ORDER (checkout step 1)
// ============================================================

export async function createPendingOrder(
  pool: Pool,
  input: CreateOrderInput
): Promise<{ success: boolean; order?: any; items?: any[]; totals?: CheckoutTotals; error?: string }> {
  const email = (input.customer.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return { success: false, error: 'Valid customer email is required' };
  if (!input.customer.firstName || !input.customer.lastName) {
    return { success: false, error: 'First name and last name are required' };
  }
  if (!input.items || input.items.length === 0) {
    return { success: false, error: 'Your cart is empty' };
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    const taxConfig = await loadTaxConfig(client);

    // Resolve products + plans from DB (server prices only)
    const resolved: any[] = [];
    let subtotal = 0;
    for (const item of input.items) {
      const qty = Math.max(1, parseInt(String(item.quantity)) || 1);
      const productRes = await client.query(
        `SELECT product_id, name, price, is_active FROM products
         WHERE product_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
           AND (is_active = true OR is_active IS NULL)`,
        [item.productId]
      );
      if (productRes.rows.length === 0) {
        return { success: false, error: `Product ${item.productId} is not available` };
      }
      const product = productRes.rows[0];

      let plan = null;
      if (item.planId) {
        const planRes = await client.query(
          `SELECT id, name, price, default_expiry_days, max_devices, is_trial_plan
           FROM plans WHERE id = $1 AND product_id = $2 AND is_active = true`,
          [item.planId, item.productId]
        );
        if (planRes.rows.length === 0) {
          return { success: false, error: 'Selected plan is no longer available' };
        }
        plan = planRes.rows[0];
        if (plan.is_trial_plan) {
          return { success: false, error: 'Trial plans cannot be purchased' };
        }
      }

      const unitPrice = Number(plan?.price ?? product.price ?? 0);
      subtotal += unitPrice * qty;
      resolved.push({ product, plan, quantity: qty, unitPrice });
    }

    // Coupon
    let discount = 0;
    if (input.couponCode && input.couponCode.trim()) {
      const couponResult = await validateCoupon(client, input.couponCode, subtotal, email);
      if (!couponResult.valid) return { success: false, error: couponResult.error || 'Invalid coupon' };
      discount = couponResult.discount;
      if (couponResult.coupon) {
        await client.query(
          `UPDATE coupons SET current_uses = current_uses + 1 WHERE id = $1`,
          [couponResult.coupon.id]
        );
      }
    }

    const tax = Math.round((subtotal - discount) * (taxConfig.taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal - discount + tax) * 100) / 100;

    // Customer record (single source of truth)
    const fullName = customerFullName(input.customer);
    await upsertCustomer(client, {
      email,
      name: fullName,
      phone: input.customer.mobile,
      mobile: input.customer.mobile,
      alternativeMobile: input.customer.alternativeMobile,
      company: input.customer.company,
      country: input.customer.country,
      addressLine1: input.customer.addressLine1,
      addressLine2: input.customer.addressLine2,
      city: input.customer.city,
      state: input.customer.state,
      postalCode: input.customer.postalCode,
      customerType: 'active',
    });

    const orderNumber = generateOrderNumber();
    const orderRes = await client.query(
      `INSERT INTO orders (
         order_number, customer_email, customer_name, status,
         subtotal, discount, tax, total, currency,
         coupon_code, payment_gateway, notes, billing_address,
         created_at, updated_at
       ) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        orderNumber, email, fullName,
        Math.round(subtotal * 100) / 100, discount, tax, total,
        taxConfig.currency,
        input.couponCode?.trim() || null,
        input.paymentGateway || 'dummy',
        input.notes || '',
        JSON.stringify({
          first_name: input.customer.firstName,
          last_name: input.customer.lastName,
          company: input.customer.company || '',
          email,
          mobile: input.customer.mobile || '',
          alternative_mobile: input.customer.alternativeMobile || '',
          address_line1: input.customer.addressLine1 || '',
          address_line2: input.customer.addressLine2 || '',
          city: input.customer.city || '',
          state: input.customer.state || '',
          country: input.customer.country || '',
          postal_code: input.customer.postalCode || '',
        }),
      ]
    );
    const order = orderRes.rows[0];

    const items: any[] = [];
    for (const r of resolved) {
      const itemRes = await client.query(
        `INSERT INTO order_items (order_id, product_id, plan_id, plan_name, quantity, unit_price, total_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          order.id,
          r.product.product_id,
          r.plan?.id ?? null,
          r.plan?.name ?? 'Standard',
          r.quantity,
          r.unitPrice,
          Math.round(r.unitPrice * r.quantity * 100) / 100,
        ]
      );
      items.push(itemRes.rows[0]);
    }

    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
        ['order_created', `Order ${orderNumber} created (${total} ${taxConfig.currency}) for ${email}`, '']
      );
    } catch (e) {
      console.error('order audit log failed:', e);
    }

    return {
      success: true,
      order,
      items,
      totals: { subtotal, discount, tax, total, currency: taxConfig.currency, taxName: taxConfig.taxName },
    };
  } catch (error) {
    console.error('createPendingOrder error:', error);
    return { success: false, error: 'Failed to create order. Please try again.' };
  } finally {
    if (client) client.release();
  }
}

// ============================================================
// FULFILL ORDER (payment captured — license generation pipeline)
// No payment → never called. Idempotent: a completed order returns its licenses.
// ============================================================

export async function fulfillOrder(pool: Pool, orderNumber: string, paymentInfo?: { gateway?: string; transactionId?: string }): Promise<FulfillResult> {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const orderRes = await client.query(
      `SELECT * FROM orders WHERE order_number = $1`,
      [orderNumber]
    );
    if (orderRes.rows.length === 0) {
      throw new Error('Order not found');
    }
    const order = orderRes.rows[0];

    const itemsRes = await client.query(
      `SELECT oi.*, p.name AS product_name, p.version AS product_version
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.product_id
       WHERE oi.order_id = $1`,
      [order.id]
    );
    const orderItems = itemsRes.rows;

    // Idempotent — already fulfilled
    if (order.status === 'completed') {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      const licenses = await client.query(
        `SELECT l.* FROM licenses l
         JOIN order_items oi ON oi.license_key_generated = l.license_key
         WHERE oi.order_id = $1`,
        [order.id]
      );
      const payments = await client.query(
        `SELECT * FROM payments WHERE order_number = $1`,
        [orderNumber]
      );
      return { order, orderItems, licenses: licenses.rows, payment: payments.rows[0] || null, invoice: null };
    }

    const billing = order.billing_address || {};
    const fullName = order.customer_name || [billing.first_name, billing.last_name].filter(Boolean).join(' ') || billing.email || '';

    const licenses: any[] = [];
    for (const item of orderItems) {
      if (item.license_key_generated) {
        const existing = await client.query(
          `SELECT * FROM licenses WHERE license_key = $1`,
          [item.license_key_generated]
        );
        if (existing.rows[0]) {
          licenses.push(existing.rows[0]);
          continue;
        }
      }

      // Plan lookup (may be deleted since order — resolve current plan data)
      let plan = null;
      if (item.plan_id) {
        const planRes = await client.query(
          `SELECT * FROM plans WHERE id = $1`,
          [item.plan_id]
        );
        if (planRes.rows.length > 0) plan = planRes.rows[0];
      }
      const durationDays = plan?.default_expiry_days || 365;
      const maxDevices = plan?.max_devices || 1;
      const planName = item.plan_name || plan?.name || 'Standard';

      const licenseKey = generateLicenseKey();
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + durationDays);
      const expiryDateString = expiry.toISOString();

      const licenseRes = await client.query(
        `INSERT INTO licenses (
           license_key, product_id, customer_name, customer_email, customer_username,
           customer_phone, customer_mobile, plan, plan_id, status, inactive_reason,
           is_trial, expiry_date, duration_days, max_devices, device_count,
           notes, is_activated, activated_at, last_validated, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'inactive','Pending activation',FALSE,
           $10,$11,$12,0,$13,FALSE,NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          licenseKey,
          item.product_id,
          fullName,
          order.customer_email,
          fullName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) || 'customer',
          billing.mobile || '',
          billing.alternative_mobile || billing.mobile || '',
          planName,
          plan?.id ?? null,
          expiryDateString,
          durationDays,
          maxDevices,
          item.notes || '',
        ]
      );
      licenses.push(licenseRes.rows[0]);

      await client.query(
        `UPDATE order_items SET license_key_generated = $1 WHERE id = $2`,
        [licenseKey, item.id]
      );

      await client.query(
        `INSERT INTO customer_licenses (customer_email, license_key, product_id, plan_name, status, expiry_date)
         VALUES ($1,$2,$3,$4,'active',$5)
         ON CONFLICT (customer_email, license_key) DO NOTHING`,
        [order.customer_email, licenseKey, item.product_id, planName, expiryDateString]
      );
    }

    // Customer (create/refresh — single source of truth)
    await upsertCustomer(client, {
      email: order.customer_email,
      name: fullName,
      mobile: billing.mobile || '',
      alternativeMobile: billing.alternative_mobile || '',
      company: billing.company || '',
      country: billing.country || '',
      addressLine1: billing.address_line1 || '',
      addressLine2: billing.address_line2 || '',
      city: billing.city || '',
      state: billing.state || '',
      postalCode: billing.postal_code || '',
      customerType: 'active',
    });

    // Payment record
    const paymentNumber = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const gateway = paymentInfo?.gateway || order.payment_gateway || 'dummy';
    const paymentRes = await client.query(
      `INSERT INTO payments (
         payment_number, order_id, order_number, customer_email, gateway,
         transaction_id, method, amount, currency, status, paid_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'succeeded',CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        paymentNumber,
        order.id,
        orderNumber,
        order.customer_email,
        gateway,
        paymentInfo?.transactionId || `TXN-${Date.now().toString(36).toUpperCase()}`,
        gateway === 'dummy' ? 'Test (Development)' : gateway,
        order.total,
        order.currency,
      ]
    );
    const payment = paymentRes.rows[0];

    // Order → completed
    await client.query(
      `UPDATE orders SET status = 'completed', paid_at = CURRENT_TIMESTAMP,
         payment_gateway = $2, payment_intent_id = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id, gateway, payment.transaction_id]
    );

    // Invoice (paid)
    const invoiceRes = await client.query(
      `INSERT INTO invoices (
         invoice_number, order_id, customer_email, status,
         amount, tax, total, currency, paid_at, created_at, updated_at
       ) VALUES ($1,$2,$3,'paid',$4,$5,$6,$7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        generateInvoiceNumber(),
        order.id,
        order.customer_email,
        order.subtotal,
        order.tax,
        order.total,
        order.currency,
      ]
    );

    // Communication center — conversation for this order
    const conversationId = `CONV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();
    const licenseList = licenses.map((l) => l.license_key).join(', ');
    await client.query(
      `INSERT INTO communication_conversations
       (id, category, status, customer_email, customer_name, subject,
        product_id, license_key, created_at, updated_at)
       VALUES ($1,'sales','open',$2,$3,$4,$5,$6,$7,$7)`,
      [
        conversationId,
        order.customer_email,
        fullName,
        `Order ${orderNumber} — payment received`,
        orderItems[0]?.product_id || '',
        licenseList,
        now,
      ]
    );
    await client.query(
      `INSERT INTO conversation_messages
       (conversation_id, sender_type, sender_name, sender_email, message, is_internal, created_at)
       VALUES ($1,'customer',$2,$3,$4,FALSE,$5)`,
      [
        conversationId,
        fullName,
        order.customer_email,
        `Payment received for order ${orderNumber} (${order.total} ${order.currency}). License${licenses.length > 1 ? 's' : ''} generated: ${licenseList}.`,
        now,
      ]
    );

    // Audit trail
    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1,$2,CURRENT_TIMESTAMP,$3,$4)`,
        ['order_paid', `Order ${orderNumber} paid via ${gateway} (${order.total} ${order.currency}); license(s): ${licenseList}`, '', licenseList.split(', ')[0] || null]
      );
    } catch (e) {
      console.error('order_paid audit failed:', e);
    }

    await client.query('COMMIT');
    client.release();
    client = null;

    // Post-commit notifications (own connections)
    const productName = orderItems[0]?.product_name || '';
    try {
      await triggerNotification(pool, 'payment_success', {
        customer_email: order.customer_email,
        customer_name: fullName,
        order_number: orderNumber,
        amount: `${order.total} ${order.currency}`,
        product_name: productName,
        license_key: licenses[0]?.license_key || '',
      });
    } catch (e) {
      console.error('payment_success notification failed:', e);
    }

    for (const lic of licenses) {
      try {
        await triggerNotification(pool, 'license_created', {
          license_key: lic.license_key,
          customer_name: fullName,
          customer_email: order.customer_email,
          customer_phone: billing.mobile || '',
          product_id: lic.product_id,
          plan_name: lic.plan,
          expiry_date: lic.expiry_date.split('T')[0],
          max_devices: lic.max_devices,
        });
      } catch (e) {
        console.error('license_created notification failed:', e);
      }
    }

    return { order: { ...order, status: 'completed' }, orderItems, licenses, payment, invoice: invoiceRes.rows[0] };
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      client.release();
    }
    throw error;
  }
}

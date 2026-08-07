// FILE: lib/store/renewal.ts
// PURPOSE: Renewal fulfillment for the Universal Renew Portal. Reuses the
//          SAME payment/order architecture as the Software Store (order ->
//          payment -> invoice, dummy/configured gateway) but, unlike a fresh
//          purchase, NEVER generates a new license — it EXTENDS the existing
//          license (expiry/plan/duration) and records renewal_history.
//
//          This is the payment counterpart of /internal/backend/licenses/renew
//          (the admin no-payment renew). Both write paths extend the existing
//          license row; neither creates a replacement.

import { Pool } from 'pg';
import { triggerNotification } from '@/lib/notification/notification-service';
import { generateInvoiceNumber } from '@/lib/store/index';

export interface PortalRenewalResult {
  order_number: string;
  license_key: string;
  plan: string;
  max_devices: number;
  extra_days: number;
  old_expiry: string;
  new_expiry: string;
  payment: any;
  invoice?: any;
  already_completed?: boolean;
}

export async function fulfillPortalRenewal(
  pool: Pool,
  orderNumber: string,
  licenseKey: string
): Promise<PortalRenewalResult> {
  let client = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const orderRes = await client.query(
      `SELECT * FROM orders WHERE order_number = $1`,
      [orderNumber]
    );
    if (orderRes.rows.length === 0) throw new Error('Order not found');
    const order = orderRes.rows[0];

    const licenseRes = await client.query(
      `SELECT * FROM licenses WHERE license_key = $1`,
      [licenseKey]
    );
    if (licenseRes.rows.length === 0) throw new Error('License not found');
    const license = licenseRes.rows[0];

    if (String(license.customer_email || '').toLowerCase() !== String(order.customer_email || '').toLowerCase()) {
      throw new Error('License does not belong to this customer');
    }

    // Idempotent — a completed renewal order returns its existing result.
    if (order.status === 'completed') {
      const paymentRes = await client.query(
        `SELECT * FROM payments WHERE order_number = $1 ORDER BY created_at DESC LIMIT 1`,
        [orderNumber]
      );
      await client.query('ROLLBACK');
      client.release();
      client = null;
      return {
        order_number: orderNumber,
        license_key: licenseKey,
        plan: license.plan,
        max_devices: license.max_devices,
        extra_days: license.duration_days || 0,
        old_expiry: '',
        new_expiry: license.expiry_date,
        payment: paymentRes.rows[0] || null,
        already_completed: true,
      };
    }

    if (order.status !== 'pending') {
      throw new Error('Order is no longer pending');
    }

    // Resolve the renewal plan from the order item (server-side only).
    const itemRes = await client.query(
      `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC LIMIT 1`,
      [order.id]
    );
    const item = itemRes.rows[0] || null;

    let plan = null;
    if (item?.plan_id) {
      const planRes = await client.query(`SELECT * FROM plans WHERE id = $1`, [item.plan_id]);
      if (planRes.rows.length > 0) plan = planRes.rows[0];
    }

    const extraDays = Math.max(1, plan?.default_expiry_days || license.duration_days || 365);
    const targetPlanName = item?.plan_name || plan?.name || license.plan || 'Standard';
    const targetPlanId = plan?.id ?? license.plan_id ?? null;
    const planMaxDevices = plan?.max_devices || license.max_devices || 1;

    // Compute new expiry (renewal extends the EXISTING license).
    let currentExpiry: Date;
    try {
      currentExpiry = new Date(license.expiry_date);
      if (isNaN(currentExpiry.getTime())) currentExpiry = new Date();
    } catch {
      currentExpiry = new Date();
    }
    const now = new Date();
    const startDate = currentExpiry < now ? now : currentExpiry;
    const newExpiry = new Date(startDate);
    newExpiry.setDate(newExpiry.getDate() + extraDays);
    const newExpiryISO = newExpiry.toISOString();

    // Extend the existing license — NEVER create a new one.
    await client.query(
      `UPDATE licenses SET
         expiry_date = $1,
         status = 'active',
         inactive_reason = NULL,
         plan_id = $2,
         plan = $3,
         max_devices = $4,
         duration_days = $5,
         last_renewed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP,
         notes = CASE
           WHEN notes IS NULL THEN $6
           ELSE notes || E'\n' || $6
         END
       WHERE license_key = $7`,
      [
        newExpiryISO,
        targetPlanId,
        targetPlanName,
        planMaxDevices,
        extraDays,
        `[${new Date().toISOString()}] Renewed for ${extraDays} days via portal. New expiry: ${newExpiryISO}`,
        licenseKey,
      ]
    );

    await client.query(
      `UPDATE customer_licenses SET expiry_date = $1, plan_name = $2, status = 'active'
       WHERE customer_email = $3 AND license_key = $4`,
      [newExpiryISO, targetPlanName, order.customer_email, licenseKey]
    );

    await client.query(
      `INSERT INTO renewal_history
       (license_key, old_plan, new_plan, old_plan_id, new_plan_id,
        old_expiry_date, new_expiry_date, extra_days, renewed_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        licenseKey,
        license.plan,
        targetPlanName,
        license.plan_id,
        targetPlanId,
        license.expiry_date,
        newExpiryISO,
        extraDays,
        'portal',
        `Paid renewal via portal order ${orderNumber}`,
      ]
    );

    // Payment record (same shape as the store fulfillOrder).
    const paymentNumber = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const gateway = order.payment_gateway || 'dummy';
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
        `TXN-${Date.now().toString(36).toUpperCase()}`,
        gateway === 'dummy' ? 'Test (Development)' : gateway,
        order.total,
        order.currency,
      ]
    );
    const payment = paymentRes.rows[0];

    await client.query(
      `UPDATE orders SET status = 'completed', paid_at = CURRENT_TIMESTAMP,
         payment_gateway = $2, payment_intent_id = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id, gateway, payment.transaction_id]
    );

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

    try {
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1,$2,CURRENT_TIMESTAMP,$3,$4)`,
        [
          'license_renewed',
          `License ${licenseKey} renewed via portal order ${orderNumber} (${order.total} ${order.currency}). Old expiry: ${license.expiry_date}, New expiry: ${newExpiryISO}`,
          '',
          licenseKey,
        ]
      );
    } catch (e) {
      console.error('portal renewal audit failed:', e);
    }

    await client.query('COMMIT');
    client.release();
    client = null;

    try {
      await triggerNotification(pool, 'license_renewed', {
        license_key: licenseKey,
        customer_name: license.customer_name,
        customer_email: order.customer_email,
        product_id: license.product_id,
        plan_name: targetPlanName,
        expiry_date: newExpiryISO.split('T')[0],
      });
    } catch (e) {
      console.error('portal renewal notification failed:', e);
    }

    return {
      order_number: orderNumber,
      license_key: licenseKey,
      plan: targetPlanName,
      max_devices: planMaxDevices,
      extra_days: extraDays,
      old_expiry: license.expiry_date,
      new_expiry: newExpiryISO,
      payment,
      invoice: invoiceRes.rows[0],
    };
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      client.release();
    }
    throw error;
  }
}

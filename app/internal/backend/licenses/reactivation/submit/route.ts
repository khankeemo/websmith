import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import { sendEmail } from '@/lib/email/mailer';

const SENDER_EMAIL = process.env.SENDER_EMAIL || 'support@websmithdigital.com';
const SENDER_NAME = 'Websmith Digital';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@websmithdigital.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      licenseKey,
      customerName,
      customerEmail,
      customerPhone,
      hardwareId,
      newCustomerName,
      newCustomerEmail,
      newCustomerPhone,
      newHardwareId,
      reason,
    } = body;

    if (!licenseKey) {
      return NextResponse.json(
        { success: false, error: 'License key is required' },
        { status: 400 }
      );
    }

    const normalizedKey = licenseKey.toUpperCase().trim();
    const now = new Date();
    const nowISO = now.toISOString();

    const pool = await getDb();
    const client = await pool.connect();

    try {
      const licenseResult = await client.query(
        `SELECT l.product_id, l.customer_name, l.customer_email, l.plan, p.name AS product_name
         FROM licenses l
         LEFT JOIN products p ON l.product_id = p.product_id
         WHERE l.license_key = $1`,
        [normalizedKey]
      );

      const lic = licenseResult.rows[0] || {};
      const productId = lic.product_id || '';
      const productName = lic.product_name || '';
      const currentPlan = lic.plan || '';

      const existingRequests = await client.query(
        `SELECT id FROM reactivation_requests
         WHERE license_key = $1 AND status = 'pending'`,
        [normalizedKey]
      );

      if (existingRequests.rows.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'A pending reactivation request already exists for this license key. Please wait for admin review.',
          existing_request_id: existingRequests.rows[0].id,
        }, { status: 409 });
      }

      const dbResult = await client.query(
        `INSERT INTO reactivation_requests
         (license_key, customer_name, customer_email, customer_phone, hardware_id,
          product_id, product_name, plan,
          new_customer_name, new_customer_email, new_customer_phone, new_hardware_id,
          reason, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, $14)
         RETURNING id`,
        [
          normalizedKey,
          customerName || lic.customer_name || '',
          customerEmail || lic.customer_email || '',
          customerPhone || '',
          hardwareId || '',
          productId,
          productName,
          currentPlan,
          newCustomerName || '',
          newCustomerEmail || '',
          newCustomerPhone || '',
          newHardwareId || '',
          reason || '',
          nowISO,
        ]
      );

      const requestId = dbResult.rows[0].id;

      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'reactivation_request',
          `Reactivation request #${requestId} submitted for ${normalizedKey} — ${customerName || lic.customer_name || ''} (${customerEmail || lic.customer_email || ''})`,
          nowISO,
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          normalizedKey,
        ]
      );

      const emailSubject = `[Reactivation Request] ${productName || 'License'} - ${customerName || lic.customer_name || ''}`;
      const emailBody = [
        `License Key: ${normalizedKey}`,
        `Product: ${productName || 'N/A'}`,
        `Plan: ${currentPlan || 'N/A'}`,
        ``,
        `Current Customer:`,
        `  Name: ${customerName || lic.customer_name || 'N/A'}`,
        `  Email: ${customerEmail || lic.customer_email || 'N/A'}`,
        `  Phone: ${customerPhone || 'N/A'}`,
        `  Hardware ID: ${hardwareId || 'N/A'}`,
        ``,
        newCustomerName || newCustomerEmail || newCustomerPhone || newHardwareId ? `Requested Changes:` : ``,
        newCustomerName ? `  Name: ${customerName} → ${newCustomerName}` : ``,
        newCustomerEmail ? `  Email: ${customerEmail || lic.customer_email} → ${newCustomerEmail}` : ``,
        newCustomerPhone ? `  Phone: ${customerPhone} → ${newCustomerPhone}` : ``,
        newHardwareId ? `  Hardware ID: ${hardwareId} → ${newHardwareId}` : ``,
        ``,
        reason ? `Reason: ${reason}` : ``,
        ``,
        `Created: ${nowISO.split('T')[0]}`,
      ].filter(Boolean).join('\n');

      let emailSent = false;
      try {
        const emailResult = await sendEmail(client, 'admin_notification', {
          email: SUPPORT_EMAIL,
          name: 'Support',
        }, {}, {
          custom: {
            subject: emailSubject,
            html: `<pre style="font-family:monospace;white-space:pre-wrap">${emailBody}</pre>`,
            plainText: emailBody,
          },
        });
        emailSent = emailResult.success;
        if (!emailResult.success) {
          console.error(`Email send failed [reactivation_request]: ${emailResult.error}`);
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }

      client.release();

      return NextResponse.json({
        success: true,
        message: emailSent
          ? 'Reactivation request submitted successfully. You will be notified via email once reviewed.'
          : 'Reactivation request submitted. Email service is currently unavailable — support will follow up.',
        request_id: `REQ-${String(requestId).padStart(5, '0')}`,
        data: {
          license_key: normalizedKey,
          request_id: requestId,
          email_sent: emailSent,
          support_email: SUPPORT_EMAIL,
        },
      });
    } catch (dbError) {
      client.release();
      console.error('[Reactivation Submit] DB error:', dbError);
      const msg = dbError?.message || '';
      if (msg.includes('42P01') || msg.includes('relation "')) {
        return NextResponse.json(
          { success: false, error: 'Database migration is missing. Please run the latest Neon migration.' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Database error while submitting request' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Reactivation Submit] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit reactivation request' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}

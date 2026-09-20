import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import { sendEmail } from '@/lib/email/mailer';

const SENDER_EMAIL = process.env.SENDER_EMAIL || 'support@websmithdigital.com';
const SENDER_NAME = 'Websmith Digital';
const SUPPORT_EMAIL = 'support@websmithdigital.com';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON body',
      }, { status: 400 });
    }

    const {
      license_key,
      customer_name,
      customer_email,
      customer_mobile,
      email,
      mobile,
      message,
      request_type,
      current_plan_id,
      current_plan_name,
      requested_plan_id,
      requested_plan_name,
      selected_plan_id,
      selected_plan_name,
    } = body;

    if (!license_key) {
      return NextResponse.json({
        success: false,
        error: 'license_key is required',
      }, { status: 400 });
    }

    const normalizedLicenseKey = license_key.toUpperCase();
    const now = new Date();
    const nowISO = now.toISOString();
    const todayDate = nowISO.split('T')[0];

    const finalEmail = customer_email || email || '';
    const finalMobile = customer_mobile || mobile || '';
    const finalRequestedPlanId = requested_plan_id || selected_plan_id || '';
    const finalRequestedPlanName = requested_plan_name || selected_plan_name || '';

    const pool = await getDb();
    const client = await pool.connect();

    try {
      const licenseResult = await client.query(
        `SELECT l.product_id, l.status, l.customer_name, l.customer_email, l.plan, l.plan_id, p.name as product_name
         FROM licenses l
         LEFT JOIN products p ON l.product_id = p.product_id
         WHERE l.license_key = $1`,
        [normalizedLicenseKey]
      );

      const requestType = request_type || 'renew';
      const lic = licenseResult.rows[0] || {};
      const finalCurrentPlanName = current_plan_name || lic.plan || '';
      const finalCurrentPlanId = current_plan_id || (lic.plan_id ? String(lic.plan_id) : '');
      const customerName = customer_name || lic.customer_name || '';

      const dbResult = await client.query(
        `INSERT INTO renewal_requests
         (license_key, product_id, product_name, customer_name, customer_email, customer_mobile,
          current_plan_id, current_plan_name, selected_plan_id, selected_plan_name,
          request_type, message, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, $13)
         RETURNING id`,
        [
          normalizedLicenseKey,
          lic.product_id || '',
          lic.product_name || '',
          customerName,
          finalEmail,
          finalMobile,
          finalCurrentPlanId,
          finalCurrentPlanName,
          finalRequestedPlanId,
          finalRequestedPlanName,
          requestType,
          message || '',
          nowISO,
        ]
      );

      const requestId = dbResult.rows[0].id;

      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'license_renewal_request',
          `Renewal request #${requestId} submitted: ${requestType === 'renew' ? 'Renew' : 'New License'} — ${customerName} (${finalEmail}) | Current: ${finalCurrentPlanName} -> Requested: ${finalRequestedPlanName || 'N/A'}`,
          nowISO,
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          normalizedLicenseKey,
          '',
        ]
      );

      const emailSubject = `[Renewal Request] ${lic.product_name || 'Product'} - ${customerName}`;      const emailBody = `
License Key:
${normalizedLicenseKey}

Customer:
${customerName}

Email:
${finalEmail}

Current Plan:
${finalCurrentPlanName || 'N/A'}

Requested Plan:
${finalRequestedPlanName || 'N/A'}

Request Type:
${requestType === 'renew' ? 'Renew' : 'New'}

Message:
${message || 'N/A'}

Created:
${todayDate}
      `.trim();

      let emailSent = false;
      try {
        const emailResult = await sendEmail(client, 'admin_notification', {
          email: SUPPORT_EMAIL,
          name: 'Websmith Support',
        }, {}, {
          custom: {
            subject: emailSubject,
            html: `<pre style="font-family: monospace; white-space: pre-wrap;">${emailBody}</pre>`,
            plainText: emailBody,
          },
        });
        emailSent = emailResult.success;
        if (!emailResult.success) {
          console.error(`Email send failed [renewal_request -> ${SUPPORT_EMAIL}]: ${emailResult.error}`);
        }
      } catch (emailErr: any) {
        console.error('Failed to send renewal request email:', emailErr);
      }

      client.release();

      return NextResponse.json({
        success: true,
        message: emailSent
          ? 'Renewal request submitted successfully.'
          : 'Renewal request submitted. Email service is currently unavailable — support will follow up.',
        request_id: `REQ-${String(requestId).padStart(5, '0')}`,
        data: {
          license_key: normalizedLicenseKey,
          request_type: requestType,
          current_plan: finalCurrentPlanName,
          requested_plan: finalRequestedPlanName,
          email_sent: emailSent,
          support_email: SUPPORT_EMAIL,
        },
      });

    } catch (dbError) {
      client.release();
      console.error('[Renewal Request] Database error:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Database error occurred while processing renewal request',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Renewal Request] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to submit renewal request',
    }, { status: 500 });
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

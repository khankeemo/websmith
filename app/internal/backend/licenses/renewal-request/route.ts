// FILE: app/internal/backend/licenses/renewal-request/route.ts
// Handles: POST /internal/backend/licenses/renewal-request
// Purpose: Customer-facing renewal request — validates, saves to DB, emails support, audits
// Security: JWT auth via proxy.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
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
      email,
      mobile,
      subject,
      message,
      request_type,
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

    const pool = await getDb();
    const client = await pool.connect();

    try {
      // Verify license exists
      const licenseResult = await client.query(
        `SELECT product_id, status, customer_name, customer_email, plan
         FROM licenses WHERE license_key = $1`,
        [normalizedLicenseKey]
      );

      const requestType = request_type || 'renew';
      const currentPlan = licenseResult.rows.length > 0 ? licenseResult.rows[0].plan : '';

      // Save to renewal_requests table
      await client.query(
        `INSERT INTO renewal_requests
         (license_key, customer_name, email, mobile, subject, message,
          request_type, selected_plan_id, selected_plan_name,
          current_plan_name, product_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $12)`,
        [
          normalizedLicenseKey,
          customer_name || '',
          email || '',
          mobile || '',
          subject || 'License Renewal Request',
          message || '',
          requestType,
          selected_plan_id || '',
          selected_plan_name || '',
          currentPlan,
          licenseResult.rows.length > 0 ? licenseResult.rows[0].product_id : '',
          nowISO,
        ]
      );

      // Log to audit_logs
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key, hardware_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'license_renewal_request',
          `Renewal request submitted: ${requestType === 'renew' ? 'Renew' : 'New License'} — ${customer_name || 'N/A'} (${email || 'N/A'}) | Plan: ${selected_plan_name || currentPlan || 'N/A'}`,
          nowISO,
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          normalizedLicenseKey,
          '',
        ]
      );

      client.release();

      // Send email to support
      let emailSent = false;
      if (BREVO_API_KEY) {
        try {
          const emailBody = `
Renewal Request Received
========================

Request Type: ${requestType === 'renew' ? 'Renew Existing License' : 'Request New License'}
License Key: ${normalizedLicenseKey}
Customer Name: ${customer_name || 'N/A'}
Customer Email: ${email || 'N/A'}
Customer Mobile: ${mobile || 'N/A'}
Current Plan: ${currentPlan || 'N/A'}
Requested Plan: ${selected_plan_name || currentPlan || 'N/A'}

Message:
${message || 'No additional details provided.'}

---
Submitted: ${nowISO}
Source: Internal SDK Renewal Dialog
          `.trim();

          const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': BREVO_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sender: { name: SENDER_NAME, email: SENDER_EMAIL },
              to: [{ email: SUPPORT_EMAIL, name: 'Websmith Support' }],
              subject: subject || 'License Renewal Request',
              textContent: emailBody,
              htmlContent: `<pre style="font-family: monospace; white-space: pre-wrap;">${emailBody}</pre>`,
            }),
          });

          emailSent = response.ok;
          if (!response.ok) {
            const errText = await response.text();
            console.error(`Brevo send failed [renewal_request -> ${SUPPORT_EMAIL}]: ${errText}`);
          }
        } catch (emailError) {
          console.error('Email send error:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        message: emailSent
          ? 'Your renewal request has been sent to Websmith Digital.'
          : 'Your renewal request has been logged. Email service is currently unavailable — support will follow up.',
        data: {
          license_key: normalizedLicenseKey,
          request_type: requestType,
          selected_plan: selected_plan_name || currentPlan || '',
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

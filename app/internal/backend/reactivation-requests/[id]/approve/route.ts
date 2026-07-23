import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import { sendEmail } from '@/lib/email/brevo';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const idMatch = pathname.match(/\/reactivation-requests\/(\d+)\/approve/);
    if (!idMatch) {
      return NextResponse.json({ success: false, error: 'Invalid request ID' }, { status: 400 });
    }
    const requestId = parseInt(idMatch[1]);

    const body = await request.json().catch(() => ({}));
    const { adminNotes } = body;

    const pool = await getDb();
    const client = await pool.connect();

    try {
      const reqResult = await client.query(
        `SELECT * FROM reactivation_requests WHERE id = $1`,
        [requestId]
      );

      if (reqResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
      }

      const req = reqResult.rows[0];

      if (req.status !== 'pending') {
        return NextResponse.json({
          success: false,
          error: `Request already ${req.status}`,
        }, { status: 400 });
      }

      const newName = req.new_customer_name || req.customer_name;
      const newEmail = req.new_customer_email || req.customer_email;
      const newPhone = req.new_customer_phone || req.customer_phone;
      const newHardwareId = req.new_hardware_id || req.hardware_id;

      const now = new Date();

      const licenseResult = await client.query(
        `SELECT * FROM licenses WHERE license_key = $1`,
        [req.license_key]
      );

      if (licenseResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });
      }

      const license = licenseResult.rows[0];

      await client.query(
        `UPDATE licenses SET
          status = 'active',
          inactive_reason = NULL,
          is_activated = TRUE,
          activated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE license_key = $1`,
        [req.license_key]
      );

      const fieldsToUpdate: string[] = [];
      const updateParams: any[] = [];
      let idx = 1;

      if (newName && newName !== license.customer_name) {
        fieldsToUpdate.push(`customer_name = $${idx++}`);
        updateParams.push(newName);
      }
      if (newEmail && newEmail !== license.customer_email) {
        fieldsToUpdate.push(`customer_email = $${idx++}`);
        updateParams.push(newEmail);
      }
      if (newPhone && newPhone !== (license.customer_phone || license.customer_mobile)) {
        fieldsToUpdate.push(`customer_phone = $${idx++}`);
        updateParams.push(newPhone);
        fieldsToUpdate.push(`customer_mobile = $${idx++}`);
        updateParams.push(newPhone);
      }

      if (fieldsToUpdate.length > 0) {
        updateParams.push(req.license_key);
        await client.query(
          `UPDATE licenses SET ${fieldsToUpdate.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE license_key = $${idx}`,
          updateParams
        );
      }

      if (newHardwareId && newHardwareId !== license.hardware_id) {
        await client.query(
          `UPDATE licenses SET hardware_id = $1, updated_at = CURRENT_TIMESTAMP WHERE license_key = $2`,
          [newHardwareId, req.license_key]
        );

        const existingAct = await client.query(
          `SELECT id FROM activations WHERE license_key = $1 AND status = 'active'`,
          [req.license_key]
        );

        if (existingAct.rows.length > 0) {
          await client.query(
            `UPDATE activations SET status = 'replaced', last_seen = CURRENT_TIMESTAMP WHERE license_key = $1 AND status = 'active'`,
            [req.license_key]
          );
        }

        await client.query(
          `INSERT INTO activations (license_key, hardware_id, device_name, status, activated_at, last_seen)
           VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [req.license_key, newHardwareId, newName || 'Unknown']
        );
      }

      await client.query(
        `UPDATE reactivation_requests SET
          status = 'approved',
          admin_notes = CASE WHEN $1 IS NOT NULL THEN $1 ELSE admin_notes END,
          admin_actioned_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        [adminNotes || null, requestId]
      );

      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp, ip_address, license_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'reactivation_approved',
          `Reactivation request #${requestId} approved for ${req.license_key} — ${newName} (${newEmail})`,
          now.toISOString(),
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          req.license_key,
        ]
      );

      let emailSent = false;
      const recipientEmail = newEmail || req.customer_email;
      if (recipientEmail && BREVO_API_KEY) {
        try {
          emailSent = await sendEmail(client, 'reactivation_approved', {
            email: recipientEmail,
            name: newName || req.customer_name || '',
          }, {
            customer_name: newName || req.customer_name || '',
            customer_email: recipientEmail,
            license_key: req.license_key,
            product_name: req.product_name || 'Software',
            plan_name: req.plan || '',
            expiry_date: license.expiry_date ? license.expiry_date.split('T')[0] : '',
          });
        } catch (emailError) {
          console.error('Approval email error:', emailError);
        }
      }

      if (!emailSent && recipientEmail && BREVO_API_KEY) {
        try {
          const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': BREVO_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sender: { name: 'Websmith Digital', email: process.env.SENDER_EMAIL || 'support@websmithdigital.com' },
              to: [{ email: recipientEmail, name: newName || '' }],
              subject: 'License Reactivation Approved',
              htmlContent: `
                <!DOCTYPE html>
                <html><head><style>
                  body{font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:24px}
                  .container{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
                  .header{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:28px 32px;text-align:center}
                  .header h1{margin:0;color:#fff;font-size:20px}
                  .header p{margin:4px 0 0;color:#8899bb;font-size:13px}
                  .body{padding:32px}
                  .body h2{margin:0 0 16px;color:#1a1a2e;font-size:18px}
                  .body p{margin:0 0 12px;font-size:14px;color:#555;line-height:1.6}
                  .key-box{background:#f0f4ff;border:1px solid #d0d9ff;border-radius:8px;padding:16px;text-align:center;margin:16px 0}
                  .key-box .label{font-size:12px;color:#666;margin-bottom:4px}
                  .key-box .key{font-size:18px;font-weight:700;color:#1a1a2e;letter-spacing:1px;word-break:break-all}
                  .btn{display:inline-block;background:#4a90d9;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;margin:16px 0}
                  .footer{background:#f8f9fb;padding:24px 32px;text-align:center;font-size:13px;color:#8899aa;border-top:1px solid #e8ecf1}
                </style></head><body>
                <div class="container">
                  <div class="header"><h1>WebSmith</h1><p>License Management Platform</p></div>
                  <div class="body">
                    <h2>License Reactivation Approved</h2>
                    <p>Hello ${newName || req.customer_name || 'there'},</p>
                    <p>Your license reactivation request has been <strong style="color:#16a34a">approved</strong>.</p>
                    <p>Please use the following license key to activate your software:</p>
                    <div class="key-box">
                      <div class="label">License Key</div>
                      <div class="key">${req.license_key}</div>
                    </div>
                    <p style="text-align:center;font-size:13px;color:#666">Open your application and activate using the license key above.</p>
                  </div>
                  <div class="footer">
                    <p>WebSmith License Management<br>Need help? Contact support</p>
                  </div>
                </div>
                </body></html>
              `,
            }),
          });
          emailSent = response.ok;
        } catch (fallbackError) {
          console.error('Fallback email error:', fallbackError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Reactivation request approved. License reactivated successfully.',
        data: {
          request_id: requestId,
          license_key: req.license_key,
          customer_name: newName || req.customer_name,
          customer_email: recipientEmail,
          email_sent: emailSent,
        },
      });
    } catch (dbError) {
      console.error('[Reactivation Approve] DB error:', dbError);
      const msg = dbError?.message || '';
      if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
        return NextResponse.json(
          { success: false, error: 'Database migration is missing. Please run the latest Neon migration.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Reactivation Approve] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to approve request' }, { status: 500 });
  }
}

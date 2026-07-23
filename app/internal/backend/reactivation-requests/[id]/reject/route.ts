import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const idMatch = pathname.match(/\/reactivation-requests\/(\d+)\/reject/);
    if (!idMatch) {
      return NextResponse.json({ success: false, error: 'Invalid request ID' }, { status: 400 });
    }
    const requestId = parseInt(idMatch[1]);

    const body = await request.json().catch(() => ({}));
    const { adminNotes, reason } = body;

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

      const now = new Date();

      await client.query(
        `UPDATE reactivation_requests SET
          status = 'rejected',
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
          'reactivation_rejected',
          `Reactivation request #${requestId} rejected for ${req.license_key}` +
            (adminNotes ? ` — Reason: ${adminNotes}` : ''),
          now.toISOString(),
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          req.license_key,
        ]
      );

      let emailSent = false;
      const recipientEmail = req.new_customer_email || req.customer_email;
      const recipientName = req.new_customer_name || req.customer_name || '';

      if (recipientEmail && BREVO_API_KEY) {
        try {
          const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': BREVO_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sender: {
                name: 'Websmith Digital',
                email: process.env.SENDER_EMAIL || 'support@websmithdigital.com',
              },
              to: [{ email: recipientEmail, name: recipientName }],
              subject: 'License Reactivation Rejected',
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
                  .rejection-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0}
                  .rejection-box p{margin:0;font-size:14px;color:#991b1b}
                  .footer{background:#f8f9fb;padding:24px 32px;text-align:center;font-size:13px;color:#8899aa;border-top:1px solid #e8ecf1}
                </style></head><body>
                <div class="container">
                  <div class="header"><h1>WebSmith</h1><p>License Management Platform</p></div>
                  <div class="body">
                    <h2>License Reactivation Rejected</h2>
                    <p>Hello ${recipientName || 'there'},</p>
                    <p>Your license reactivation request for <strong>${req.product_name || 'your software'}</strong> could not be approved at this time.</p>
                    ${adminNotes || reason ? `
                    <div class="rejection-box">
                      <p><strong>Reason:</strong> ${adminNotes || reason}</p>
                    </div>` : ''}
                    <p>If you believe this is an error or would like further assistance, please contact our support team.</p>
                    <p>We apologize for the inconvenience.</p>
                  </div>
                  <div class="footer">
                    <p>WebSmith License Management<br>Need help? Contact support</p>
                  </div>
                </div>
                </body></html>
              `,
              textContent: [
                `License Reactivation Rejected`,
                ``,
                `Hello ${recipientName || 'there'},`,
                ``,
                `Your license reactivation request for ${req.product_name || 'your software'} could not be approved at this time.`,
                adminNotes || reason ? `\nReason: ${adminNotes || reason}\n` : '',
                `If you believe this is an error or would like further assistance, please contact our support team.`,
                ``,
                `Best regards,`,
                `Websmith Digital`,
              ].join('\n'),
            }),
          });
          emailSent = response.ok;
          if (!response.ok) {
            const errText = await response.text();
            console.error(`Brevo send failed [reactivation_rejected]: ${errText}`);
          }
        } catch (emailError) {
          console.error('Rejection email error:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Reactivation request rejected. The customer has been notified.',
        data: {
          request_id: requestId,
          license_key: req.license_key,
          email_sent: emailSent,
        },
      });
    } catch (dbError) {
      console.error('[Reactivation Reject] DB error:', dbError);
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
    console.error('[Reactivation Reject] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to reject request' }, { status: 500 });
  }
}

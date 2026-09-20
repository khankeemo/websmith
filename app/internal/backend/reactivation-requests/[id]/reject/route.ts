import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import { sendEmail } from '@/lib/email/mailer';

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

      if (recipientEmail) {
        try {
          const emailResult = await sendEmail(client, 'reactivation_rejected', {
            email: recipientEmail,
            name: recipientName,
          }, {
            customer_name: recipientName,
            customer_email: recipientEmail,
            license_key: req.license_key,
            product_name: req.product_name || 'Software',
            reason: adminNotes || reason || '',
          });
          emailSent = emailResult.success;
          if (!emailResult.success) {
            console.error('Rejection email error:', emailResult.error);
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
      if (msg.includes('42P01') || msg.includes('relation "')) {
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

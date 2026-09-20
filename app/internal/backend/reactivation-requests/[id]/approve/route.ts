import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import { sendEmail } from '@/lib/email/mailer';

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
      if (recipientEmail) {
        try {
          const emailResult = await sendEmail(client, 'reactivation_approved', {
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
          emailSent = emailResult.success;
          if (!emailResult.success) {
            console.error('Approval email error:', emailResult.error);
          }
        } catch (emailError) {
          console.error('Approval email error:', emailError);
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
    console.error('[Reactivation Approve] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to approve request' }, { status: 500 });
  }
}

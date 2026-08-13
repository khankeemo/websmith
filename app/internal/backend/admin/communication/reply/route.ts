import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import { sendEmail } from '@/lib/email/brevo';

const CATEGORY_ROUTE_MAP: Record<string, string> = {
  support: 'support_reply',
  sales: 'sales_reply',
  activation: 'support_reply',
  renewal: 'support_reply',
  reactivation: 'support_reply',
  hardware_replacement: 'support_reply',
  general: 'support_reply',
};

export async function POST(request: NextRequest) {
  let client = null;

  try {
    const body = await request.json();
    const { conversation_id, message, sender_name, is_internal } = body;
    // Optional sender override from the compose From dropdown (account ID based).
    const from_email = String(body.from_email || "").trim();
    const from_name = String(body.from_name || "").trim();
    const from_mailbox_id = String(body.from_mailbox_id || "").trim();

    if (!conversation_id || !message || !message.trim()) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'conversation_id and message are required' }
      }, { status: 400 });
    }

    const db = await getDb();
    client = await db.connect();

    const convResult = await client.query(
      'SELECT * FROM communication_conversations WHERE id = $1',
      [conversation_id]
    );

    if (convResult.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' }
      }, { status: 404 });
    }

    const conv = convResult.rows[0];
    const now = new Date().toISOString();
    const adminName = from_name || sender_name || 'Support Team';

    await client.query(
      `INSERT INTO conversation_messages
       (conversation_id, sender_type, sender_name, sender_email, message, is_internal, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [conversation_id, 'admin', adminName, from_email, message, is_internal || false, now]
    );

    await client.query(
      'UPDATE communication_conversations SET status = $1, updated_at = $2 WHERE id = $3',
      ['waiting_customer', now, conversation_id]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['admin_conversation_reply', `Admin reply added to conversation ${conversation_id}`, now]
    );

    if (!is_internal && conv.customer_email) {
      // Sender = a configured external mailbox: send via that mailbox's SMTP
      // (reuses the exact nodemailer pattern from /mailboxes/[id]/send) so the
      // reply leaves FROM the account that received the email.
      if (from_mailbox_id) {
        const mbResult = await client.query('SELECT * FROM mailboxes WHERE id = $1', [from_mailbox_id]);
        const mailbox = mbResult.rows[0];
        if (mailbox && mailbox.is_enabled) {
          const fromLabel = mailbox.display_name ? `"${mailbox.display_name}" <${mailbox.email_address}>` : mailbox.email_address;
          const fullMessage = message + (mailbox.signature ? `\n\n${mailbox.signature}` : "");
          let smtpDelivered = false;
          try {
            const nodemailer = (await import('nodemailer')).default;
            const transporter = nodemailer.createTransport({
              host: mailbox.smtp_host,
              port: mailbox.smtp_port,
              secure: mailbox.smtp_secure,
              auth: { user: mailbox.smtp_username, pass: mailbox.smtp_password },
              tls: { rejectUnauthorized: false },
              connectionTimeout: 30000,
            });
            const info = await transporter.sendMail({
              from: fromLabel,
              to: conv.customer_name ? `"${conv.customer_name}" <${conv.customer_email}>` : conv.customer_email,
              subject: conv.subject ? `Re: ${conv.subject}` : 'Re: Your request',
              text: fullMessage,
              html: `<p>${fullMessage.replace(/\n/g, '<br/>')}</p>`,
            });
            smtpDelivered = true;
            await client.query(
              `INSERT INTO notification_logs (event_type, channel, recipient, subject, status, response, created_at)
               VALUES ($1,'smtp',$2,$3,'sent',$4,$5)`,
              ['support_reply', conv.customer_email, conv.subject ? `Re: ${conv.subject}` : 'Re: Your request', String(info.messageId || ''), now]
            );
            await client.query(
              `INSERT INTO audit_logs (event_type, message, timestamp)
               VALUES ($1, $2, $3)`,
              ['email_sent', `Reply to ${conv.customer_email} sent via SMTP (${mailbox.email_address})`, now]
            );
          } catch (smtpError: any) {
            await client.query(
              `INSERT INTO audit_logs (event_type, message, timestamp)
               VALUES ($1, $2, $3)`,
              ['email_failed', `Reply email failed for ${conversation_id}: ${smtpError?.message || 'SMTP send failed'}`, now]
            );
          }
          client.release();
          client = null;
          // The reply is stored in the conversation either way, but the admin
          // must know when the email never left the mailbox SMTP.
          return NextResponse.json({
            success: true,
            emailDelivered: smtpDelivered,
            warning: smtpDelivered ? undefined : 'Reply saved, but the email could not be sent via the mailbox SMTP.'
          });
        }
        // Mailbox missing/disabled → fall through to the Brevo path below.
      }

      if (process.env.BREVO_API_KEY) {
        const emailTemplate = CATEGORY_ROUTE_MAP[conv.category] || 'support_reply';
        // The reply is for the CUSTOMER — never the admin/company address.
        const emailResult = await sendEmail(
          db,
          emailTemplate,
          { email: conv.customer_email, name: conv.customer_name || 'Valued Customer' },
          {
            conversation_id,
            request_id: conv.request_id || conversation_id,
            customer_name: conv.customer_name || 'N/A',
            customer_email: conv.customer_email,
            message,
          },
          from_email ? { from: { email: from_email, name: from_name || adminName } } : {}
        );
        if (!emailResult.success) {
          console.error(`[Admin Comm] Reply email delivery failed for ${conversation_id}:`, emailResult.error);
          await client.query(
            `INSERT INTO audit_logs (event_type, message, timestamp)
             VALUES ($1, $2, $3)`,
            ['email_failed', `Admin reply email failed for ${conversation_id}: ${emailResult.error || 'Unknown error'}`, now]
          );
        }
      }
    }

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully.',
    });

  } catch (error: any) {
    console.error('Admin communication reply error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send reply.' }
    }, { status: 500 });
  }
}

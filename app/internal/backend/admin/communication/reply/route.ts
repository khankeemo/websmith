import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import { sendEmail } from '@/lib/email/mailer';
import {
  linkConversationAttachments,
  storeUploadedFiles,
  toMailAttachments,
  toNodemailerAttachments,
  validateAttachmentFiles,
} from '@/lib/communications/attachments';

const CATEGORY_ROUTE_MAP: Record<string, string> = {
  support: 'support_reply',
  sales: 'sales_reply',
  activation: 'support_reply',
  renewal: 'support_reply',
  reactivation: 'support_reply',
  hardware_replacement: 'support_reply',
  general: 'support_reply',
};

// The reply is a REAL outbound email when is_internal is false. The composer
// may post `is_internal` as a boolean OR the string "true"/"false", so it is
// normalized here — a non-empty "false" string must never be treated as true.
const parseInternal = (v: unknown): boolean =>
  v === true || String(v).toLowerCase() === 'true';

export async function POST(request: NextRequest) {
  let client = null;

  try {
    const contentType = request.headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');

    let body: Record<string, any> = {};
    const files: File[] = [];
    if (isMultipart) {
      const formData = await request.formData();
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          files.push(value);
        } else {
          body[key] = value;
        }
      }
    } else {
      body = await request.json().catch(() => ({}));
    }

    const { conversation_id, message, sender_name } = body;
    const isInternal = parseInternal(body.is_internal);
    // Optional sender override from the compose From dropdown (account ID based).
    const from_email = String(body.from_email || "").trim();
    const from_name = String(body.from_name || "").trim();
    const from_mailbox_id = String(body.from_mailbox_id || "").trim();
    // Optional compose fields: explicit subject (falls back to "Re: <subject>")
    // and CC/BCC recipients (comma-separated email list).
    const subjectOverride = String(body.subject || "").trim();
    const ccRaw = String(body.cc || "").trim();
    const bccRaw = String(body.bcc || "").trim();
    const splitEmails = (raw: string): string[] =>
      raw.split(/[,;]/).map(e => e.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const ccList = splitEmails(ccRaw);
    const bccList = splitEmails(bccRaw);

    if (!conversation_id || !message || !message.trim()) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'conversation_id and message are required' }
      }, { status: 400 });
    }

    // Outgoing attachment files (uploaded with the reply). Flow through the
    // universal attachment service — validated, stored (best-effort disk +
    // durable DB bytes), and shaped for the email providers. Attached to the
    // real email for BOTH the mailbox-SMTP and centralized SMTP paths.
    const storedFiles: Awaited<ReturnType<typeof storeUploadedFiles>> = [];
    if (isMultipart && files.length > 0) {
      const fileValidation = validateAttachmentFiles(files);
      if (!fileValidation.ok) {
        return NextResponse.json({ success: false, error: fileValidation.error }, { status: 400 });
      }
      storedFiles.push(...(await storeUploadedFiles(files)));
    }
    const attachments = toMailAttachments(storedFiles);
    const nodemailerAttachments = toNodemailerAttachments(storedFiles);

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

    const msgResult = await client.query(
      `INSERT INTO conversation_messages
       (conversation_id, sender_type, sender_name, sender_email, message, is_internal, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [conversation_id, 'admin', adminName, from_email, message, isInternal, now]
    );
    const messageId = msgResult.rows[0]?.id;

    await client.query(
      'UPDATE communication_conversations SET status = $1, updated_at = $2 WHERE id = $3',
      ['waiting_customer', now, conversation_id]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['admin_conversation_reply', `Admin reply added to conversation ${conversation_id}`, now]
    );

    // Stored conversation attachments (linked to this message via the
    // universal service — durable DB bytes + best-effort disk) so the reader
    // thread shows + downloads them under the reply.
    if (storedFiles.length > 0 && messageId) {
      await linkConversationAttachments(client, messageId, storedFiles);
    }

    // Internal notes are NEVER email — nothing is sent below.
    if (isInternal) {
      client.release();
      client = null;
      return NextResponse.json({
        success: true,
        message: 'Internal note added.',
        emailDelivered: false,
        internal: true,
      });
    }

    if (!conv.customer_email) {
      client.release();
      client = null;
      return NextResponse.json({
        success: true,
        message: 'Reply saved.',
        emailDelivered: false,
        warning: 'No customer email on this conversation — reply was saved but no email was sent.',
      });
    }

    // Honest delivery reporting: the final return must never claim the email
    // was delivered unless an email actually went out (mailbox SMTP or centralized SMTP).
    let emailAttempted = false;

    // Sender = a configured external mailbox: send via that mailbox's SMTP
    // (reuses the exact nodemailer pattern from /mailboxes/[id]/send) so the
    // reply leaves FROM the account that received the email.
    if (from_mailbox_id) {
      const mbResult = await client.query('SELECT * FROM mailboxes WHERE id = $1', [from_mailbox_id]);
      const mailbox = mbResult.rows[0];
      if (mailbox && mailbox.is_enabled) {
        emailAttempted = true;
        const fromLabel = mailbox.display_name ? `"${mailbox.display_name}" <${mailbox.email_address}>` : mailbox.email_address;
        const fullMessage = message + (mailbox.signature ? `\n\n${mailbox.signature}` : "");
        const replySubject = subjectOverride || (conv.subject ? `Re: ${conv.subject}` : 'Re: Your request');
        let smtpDelivered = false;
        let smtpErrorMsg = '';
        let messageIdResp = '';
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
            ...(ccList.length > 0 ? { cc: ccList } : {}),
            ...(bccList.length > 0 ? { bcc: bccList } : {}),
            subject: replySubject,
            text: fullMessage,
            html: `<p>${fullMessage.replace(/\n/g, '<br/>')}</p>`,
            ...(nodemailerAttachments.length > 0
              ? { attachments: nodemailerAttachments }
              : {}),
          });
          smtpDelivered = true;
          messageIdResp = String(info.messageId || '');
        } catch (smtpError: any) {
          smtpErrorMsg = smtpError?.message || 'SMTP send failed';
          await client.query(
            `INSERT INTO audit_logs (event_type, message, timestamp)
             VALUES ($1, $2, $3)`,
            ['email_failed', `Reply email failed for ${conversation_id}: ${smtpErrorMsg}`, now]
          );
        }

        if (messageId) {
          await client.query(
            `UPDATE conversation_messages SET email_sent = $1, email_error = $2 WHERE id = $3`,
            [smtpDelivered, smtpDelivered ? null : (smtpErrorMsg || null), messageId]
          );
        }

        if (smtpDelivered) {
          await client.query(
            `INSERT INTO notification_logs (event_type, channel, recipient, subject, status, response, created_at)
             VALUES ($1,'smtp',$2,$3,'sent',$4,$5)`,
            ['support_reply', conv.customer_email, replySubject, messageIdResp, now]
          );
          await client.query(
            `INSERT INTO audit_logs (event_type, message, timestamp)
             VALUES ($1, $2, $3)`,
            ['email_sent', `Reply to ${conv.customer_email} sent via SMTP (${mailbox.email_address})`, now]
          );
        }

        client.release();
        client = null;
        // The reply is stored in the conversation either way, but the admin
        // must know when the email never left the mailbox SMTP.
        return NextResponse.json({
          success: true,
          emailDelivered: smtpDelivered,
          warning: smtpDelivered ? undefined : `Reply saved, but the email could not be sent via the mailbox SMTP (${smtpErrorMsg}).`
        });
      }
      // Mailbox missing/disabled → fall through to the central SMTP mailer below.
    }

    emailAttempted = true;
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
        {
          ...(from_email ? { from: { email: from_email, name: from_name || adminName } } : {}),
          ...(ccList.length > 0 ? { cc: ccList.map(e => ({ email: e })) } : {}),
          ...(bccList.length > 0 ? { bcc: bccList.map(e => ({ email: e })) } : {}),
          ...(attachments.length > 0 ? { attachments } : {}),
          custom: subjectOverride ? { subject: subjectOverride, html: `<p>${message.replace(/\n/g, '<br/>')}</p>`, plainText: message } : null,
        }
      );

      if (messageId) {
        await client.query(
          `UPDATE conversation_messages SET email_sent = $1, email_error = $2 WHERE id = $3`,
          [emailResult.success, emailResult.success ? null : (emailResult.error || null), messageId]
        );
      }

      if (!emailResult.success) {
        console.error(`[Admin Comm] Reply email delivery failed for ${conversation_id}:`, emailResult.error);
        await client.query(
          `INSERT INTO audit_logs (event_type, message, timestamp)
           VALUES ($1, $2, $3)`,
          ['email_failed', `Admin reply email failed for ${conversation_id}: ${emailResult.error || 'Unknown error'}`, now]
        );
        client.release();
        client = null;
        // The reply is stored in the conversation, but the admin must know
        // the email never reached the customer (never fake success).
        return NextResponse.json({
          success: true,
          emailDelivered: false,
          warning: `Reply saved, but the email could not be delivered (${emailResult.error || 'provider error'}).`
        });
      }

    client.release();
    client = null;

    // No mail provider available: the reply is
    // saved but the email cannot leave — report honestly instead of faking success.
    if (!emailAttempted) {
      return NextResponse.json({
        success: true,
        emailDelivered: false,
        warning: 'Reply saved, but no email provider is configured.'
      });
    }

    return NextResponse.json({
      success: true,
      emailDelivered: true,
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
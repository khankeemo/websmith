import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  let syncStartTime = Date.now();
  try {
    const { id } = await params;
    client = await (await getDb()).connect();

    const result = await client.query('SELECT * FROM mailboxes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'MAILBOX_NOT_FOUND', message: 'Mailbox not found.' }
      }, { status: 404 });
    }

    const mailbox = result.rows[0];

    // Disabled mailboxes must not process incoming mail (enable/disable
    // toggle is honored on the sync path too).
    if (!mailbox.is_enabled) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'MAILBOX_DISABLED', message: 'This mailbox is disabled. Enable it before synchronizing.' }
      }, { status: 403 });
    }

    const now = new Date().toISOString();

    await client.query(
      `UPDATE mailboxes SET sync_status = 'syncing', updated_at = $1 WHERE id = $2`,
      [now, id]
    );

    const logId = await client.query(
      `INSERT INTO mailbox_sync_logs (mailbox_id, status, started_at) VALUES ($1, 'running', $2) RETURNING id`,
      [id, now]
    );
    const syncLogId = logId.rows[0].id;

    let messagesFetched = 0;
    let messagesNew = 0;
    let messagesUpdated = 0;
    let errorMessage = '';
    let syncStatus = 'completed';

    try {
      const Imap = (await import('imap')).default;
      const { simpleParser } = await import('mailparser');

      const imap = new Imap({
        host: mailbox.imap_host,
        port: mailbox.imap_port,
        tls: mailbox.imap_secure,
        tlsOptions: { rejectUnauthorized: false },
        user: mailbox.imap_username,
        password: mailbox.imap_password,
        connTimeout: 30000,
        authTimeout: 30000,
      });

      await new Promise<void>((resolve, reject) => {
        imap.once('ready', () => resolve());
        imap.once('error', (err: Error) => reject(err));
        imap.connect();
      });

      await new Promise<void>((resolve, reject) => {
        imap.openBox('INBOX', true, (err: Error | null, box: any) => {
          if (err) return reject(err);
          resolve();
        });
      });

      const searchCriteria = ['UNSEEN'];
      await new Promise<void>((resolve, reject) => {
        imap.search(searchCriteria, async (err: Error | null, uids: number[]) => {
          if (err) return reject(err);
          if (!uids || uids.length === 0) {
            imap.end();
            return resolve();
          }

          messagesFetched = uids.length;
          const fetch = imap.fetch(uids, { bodies: '', struct: true });

          fetch.on('message', (msg: any, seqno: number) => {
            msg.on('body', async (stream: any) => {
              try {
                const parsed = await simpleParser(stream);
                const messageId = parsed.messageId || `<${Date.now()}-${Math.random().toString(36).substring(2)}@${mailbox.email_address}>`;
                const subject = parsed.subject || '(No Subject)';
                const from = parsed.from?.text || '';
                const to = parsed.to?.text || '';
                const date = parsed.date || new Date();
                const text = parsed.text || '';
                const html = parsed.html || '';
                const hasAttachments = parsed.attachments && parsed.attachments.length > 0;

                const existing = await client?.query(
                  'SELECT id FROM communication_conversations WHERE customer_email = $1 AND subject = $2 AND deleted_at IS NULL',
                  [from, subject]
                );

                let conversationId: string;
                if (existing?.rows.length > 0) {
                  conversationId = existing.rows[0].id;
                  await client?.query(
                    `UPDATE communication_conversations SET updated_at = $1, mailbox_id = COALESCE(mailbox_id, $2) WHERE id = $3`,
                    [new Date().toISOString(), id, conversationId]
                  );
                  messagesUpdated++;
                } else {
                  // A conversation already in Trash stays out of Inbox even if
                  // the IMAP server still has the message (it is usually still
                  // UNSEEN). Reuse the trashed conversation rather than creating
                  // a duplicate that would reappear in the Inbox list.
                  const trashed = await client?.query(
                    'SELECT id FROM communication_conversations WHERE customer_email = $1 AND subject = $2 AND deleted_at IS NOT NULL ORDER BY updated_at DESC LIMIT 1',
                    [from, subject]
                  );
                  const reuseTrashed = (trashed?.rows?.length ?? 0) > 0;

                  if (reuseTrashed) {
                    conversationId = trashed.rows[0].id;
                    await client?.query(
                      `UPDATE communication_conversations SET updated_at = $1, mailbox_id = COALESCE(mailbox_id, $2) WHERE id = $3 AND deleted_at IS NOT NULL`,
                      [new Date().toISOString(), id, conversationId]
                    );
                    messagesUpdated++;
                  } else {
                    conversationId = `CONV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                    await client?.query(
                      `INSERT INTO communication_conversations (id, category, status, customer_email, customer_name, subject, mailbox_id, created_at, updated_at)
                       VALUES ($1, 'general', 'open', $2, $3, $4, $5, $6, $6)`,
                      [conversationId, from, from, subject, id, date.toISOString()]
                    );
                    messagesNew++;
                  }

                  // ---- Auto-reply (new feature, UI/UX-scoped): if the mailbox
                  // has auto-reply enabled, answer the FIRST message of a NEW
                  // conversation using the configured template + signature
                  // (falls back to the legacy free-text auto_reply_message).
                  // Reuses the same nodemailer transporter options as the
                  // existing [id]/send route — no SMTP engine changes.
                  // Never auto-replies to mail that is being re-held in Trash.
                  if (mailbox.auto_reply_enabled && !reuseTrashed) {
                    try {
                      let replyBody = '';
                      if (mailbox.auto_reply_template_key) {
                        const tpl = await client?.query(
                          `SELECT body, plain_text FROM email_templates WHERE email_type = $1`,
                          [mailbox.auto_reply_template_key]
                        );
                        const t = tpl?.rows?.[0];
                        if (t) replyBody = t.plain_text || t.body || '';
                      }
                      if (!replyBody) replyBody = mailbox.auto_reply_message || '';

                      // Resolve auto_reply_signature (ID) to content from system_settings,
                      // respecting enabled flag; fall back to mailbox.signature (static content)
                      let replySignature = '';
                      if (mailbox.auto_reply_signature) {
                        const settingsResult = await client?.query(
                          `SELECT settings FROM system_settings ORDER BY id DESC LIMIT 1`
                        );
                        const allSettings = settingsResult?.rows?.[0]?.settings || {};
                        const sigs = allSettings.communications?.signatures || [];
                        const sig = sigs.find((s: any) => s.id === mailbox.auto_reply_signature && s.enabled !== false);
                        if (sig) replySignature = sig.content || '';
                      }
                      if (!replySignature) replySignature = mailbox.signature || '';

                      const fullReply = replyBody + (replySignature ? `\n\n${replySignature}` : '');
                      if (fullReply.trim()) {
                        const fromName = parsed.from?.value?.[0]?.name || '';
                        const fromAddress = parsed.from?.value?.[0]?.address || (from.includes('<') ? (from.match(/<([^>]+)>/)?.[1] || '') : from);
                        const fromLabel = mailbox.display_name ? `"${mailbox.display_name}" <${mailbox.email_address}>` : mailbox.email_address;
                        const nodemailer = (await import('nodemailer')).default;
                        const transporter = nodemailer.createTransport({
                          host: mailbox.smtp_host,
                          port: mailbox.smtp_port,
                          secure: mailbox.smtp_secure,
                          auth: { user: mailbox.smtp_username, pass: mailbox.smtp_password },
                          tls: { rejectUnauthorized: false },
                          connectionTimeout: 30000,
                        });
                        let autoReplyOk = false;
                        let autoReplyError = '';
                        try {
                          await transporter.sendMail({
                            from: fromLabel,
                            to: fromAddress ? (fromName ? `"${fromName}" <${fromAddress}>` : fromAddress) : from,
                            subject: `Re: ${subject}`,
                            text: fullReply,
                            html: `<p>${fullReply.replace(/\n/g, '<br/>')}</p>`,
                          });
                          autoReplyOk = true;
                        } catch (sendErr: any) {
                          autoReplyError = sendErr?.message || 'SMTP send failed';
                        }

                        await client?.query(
                          `INSERT INTO conversation_messages (conversation_id, sender_type, sender_name, sender_email, message, is_internal, email_sent, created_at)
                           VALUES ($1, 'admin', $2, $3, $4, FALSE, TRUE, $5)`,
                          [conversationId, mailbox.display_name || mailbox.email_address, mailbox.email_address, replyBody, new Date().toISOString()]
                        );
                        await client?.query(
                          `INSERT INTO notification_logs (event_type, channel, recipient, subject, status, response, error, created_at)
                           VALUES ($1, 'smtp', $2, $3, $4, NULL, $5, $6)`,
                          ['auto_reply', fromAddress || from, `Re: ${subject}`, autoReplyOk ? 'sent' : 'failed', autoReplyOk ? null : autoReplyError, new Date().toISOString()]
                        );
                        await client?.query(
                          `UPDATE communication_conversations SET status = 'waiting_customer', updated_at = $1 WHERE id = $2`,
                          [new Date().toISOString(), conversationId]
                        );
                        await client?.query(
                          `INSERT INTO audit_logs (event_type, message, timestamp)
                           VALUES ($1, $2, $3)`,
                          ['auto_reply_sent', `Auto-reply sent for ${fromAddress || from} via ${mailbox.email_address}${autoReplyOk ? '' : ` (SMTP error: ${autoReplyError})`}`, new Date().toISOString()]
                        );
                      }
                    } catch (autoReplyErr: any) {
                      console.error('Mailbox auto-reply error:', autoReplyErr?.message || autoReplyErr);
                    }
                  }
                }

                await client?.query(
                  `INSERT INTO conversation_messages (conversation_id, sender_type, sender_name, sender_email, message, has_attachments, created_at)
                   VALUES ($1, 'customer', $2, $3, $4, $5, $6)`,
                  [conversationId, from, from, text || html || '(No content)', hasAttachments, date.toISOString()]
                );
              } catch (parseError: any) {
                console.error('Failed to parse email:', parseError);
              }
            });
          });

          fetch.once('error', (err: Error) => reject(err));
          fetch.once('end', () => {
            imap.end();
            resolve();
          });
        });
      });

    } catch (syncError: any) {
      syncStatus = 'failed';
      errorMessage = syncError?.message || 'Sync failed';
      console.error('Mailbox sync error:', syncError);
    }

    const durationMs = Date.now() - syncStartTime;
    const completedAt = new Date().toISOString();

    await client.query(
      `UPDATE mailboxes SET 
         sync_status = $1, 
         last_sync = $2, 
         last_success = $3, 
         last_failure = $4, 
         last_error = $5, 
         queue_size = $6,
         updated_at = $2 
       WHERE id = $7`,
      [syncStatus, completedAt, syncStatus === 'completed' ? completedAt : null, syncStatus === 'failed' ? completedAt : null, errorMessage, messagesNew, id]
    );

    await client.query(
      `UPDATE mailbox_sync_logs SET 
         status = $1, 
         messages_fetched = $2, 
         messages_new = $3, 
         messages_updated = $4, 
         error_message = $5, 
         duration_ms = $6, 
         completed_at = $7 
       WHERE id = $8`,
      [syncStatus, messagesFetched, messagesNew, messagesUpdated, errorMessage, durationMs, completedAt, syncLogId]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['mailbox_synced', `Mailbox ${mailbox.email_address} synced: ${messagesNew} new, ${messagesUpdated} updated, status=${syncStatus}`, completedAt]
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: {
        messages_fetched: messagesFetched,
        messages_new: messagesNew,
        messages_updated: messagesUpdated,
        status: syncStatus,
        error: errorMessage,
        duration_ms: durationMs,
      }
    });

  } catch (error: any) {
    console.error('Mailbox sync error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to sync mailbox.' }
    }, { status: 500 });
  }
}
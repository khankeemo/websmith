import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';
import { linkConversationAttachments, storeIncomingAttachment } from '@/lib/communications/attachments';

type ReceiveAccount = {
  id: string | null;
  email_address: string;
  display_name: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;
  imap_password: string;
  category: string;
  is_native: boolean;
  is_enabled: boolean;
  auto_reply_enabled?: boolean;
};

// Built-in accounts stay in communications.mail_accounts. Their receive
// configuration is supplied only by the existing secure environment layer;
// no system account is ever materialized as a mailboxes row.
const DEFAULT_NATIVE_MAIL_ACCOUNTS = [
  {
    id: 'support',
    name: 'Support',
    email: process.env.MAIL_SUPPORT_ADDRESS || 'support@websmithdigital.com',
    display_name: process.env.MAIL_SUPPORT_NAME || 'Websmith Support Team',
    type: 'support',
    is_active: true,
  },
  {
    id: 'sales',
    name: 'Sales',
    email: process.env.MAIL_SALES_ADDRESS || 'sales@websmithdigital.com',
    display_name: process.env.MAIL_SALES_NAME || 'Websmith Sales Team',
    type: 'sales',
    is_active: true,
  },
];

const DEFAULT_NATIVE_ROUTING = {
  support_categories: ['support', 'activation', 'renewal', 'reactivation', 'hardware_replacement', 'general'],
  sales_categories: ['sales'],
};

function nativeReceiveAccount(settings: any, id: string): ReceiveAccount | null {
  const communications = settings?.communications || {};
  const routing = { ...DEFAULT_NATIVE_ROUTING, ...(communications.routing || {}) };
  const accounts = Array.isArray(communications.mail_accounts) && communications.mail_accounts.length > 0
    ? communications.mail_accounts
    : DEFAULT_NATIVE_MAIL_ACCOUNTS;
  const account = accounts.find((item: any) => String(item?.id) === id);
  if (!account || account.is_active === false || !['support', 'sales'].includes(String(account.type))) return null;

  const type = String(account.type).toUpperCase();
  const read = (name: string) => String(process.env[`MAIL_${type}_IMAP_${name}`] || '').trim();
  const host = read('HOST');
  const username = read('USERNAME');
  const password = read('PASSWORD');
  const port = Number(read('PORT'));
  const secureValue = read('SECURE').toLowerCase();
  const categories = account.type === 'sales' ? routing.sales_categories : routing.support_categories;
  const category = Array.isArray(categories) && categories[0] ? String(categories[0]) : '';

  if (!host || !username || !password || !Number.isInteger(port) || !category || !String(account.email || '').trim()) {
    return null;
  }
  return {
    id: null,
    email_address: String(account.email).trim(),
    display_name: String(account.display_name || account.name || account.email).trim(),
    imap_host: host,
    imap_port: port,
    imap_secure: secureValue === 'true',
    imap_username: username,
    imap_password: password,
    category,
    is_native: true,
    is_enabled: true,
    auto_reply_enabled: false,
  };
}

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
    let mailbox: ReceiveAccount | any = result.rows[0] || null;
    if (!mailbox) {
      const settingsResult = await client.query('SELECT settings FROM system_settings ORDER BY id DESC LIMIT 1');
      mailbox = nativeReceiveAccount(settingsResult.rows[0]?.settings, id);
      if (!mailbox) {
        client.release();
        client = null;
        return NextResponse.json({
          success: false,
          error: { code: 'NATIVE_RECEIVE_NOT_CONFIGURED', message: 'The selected system account has no active secure inbound configuration.' }
        }, { status: 404 });
      }
    } else {
      mailbox.category = 'general';
      mailbox.is_native = false;
    }

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

    let syncLogId: number | null = null;
    if (!mailbox.is_native) {
      await client.query(
        `UPDATE mailboxes SET sync_status = 'syncing', updated_at = $1 WHERE id = $2`,
        [now, id]
      );
      const logId = await client.query(
        `INSERT INTO mailbox_sync_logs (mailbox_id, status, started_at) VALUES ($1, 'running', $2) RETURNING id`,
        [id, now]
      );
      syncLogId = logId.rows[0].id;
    }

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
                const messageId = String(parsed.messageId || '').trim() || null;
                const subject = parsed.subject || '(No Subject)';
                const parsedAddress = parsed.from?.value?.[0]?.address || parsed.from?.text || '';
                const parsedName = parsed.from?.value?.[0]?.name || parsed.from?.text || parsedAddress;
                const from = mailbox.is_native ? parsedAddress : (parsed.from?.text || '');
                const to = parsed.to?.text || '';
                const date = parsed.date || new Date();
                const text = parsed.text || '';
                const html = parsed.html || '';

                // IMAP is deliberately read-only, so the provider can return
                // the same UNSEEN message on later sweeps. Provider Message-ID
                // is the shared, durable dedupe boundary for native and
                // external receive transports alike.
                if (messageId) {
                  const duplicate = await client?.query(
                    'SELECT id FROM conversation_messages WHERE provider_message_id = $1 LIMIT 1',
                    [messageId]
                  );
                  if (duplicate?.rows.length) return;
                  // Permanently-deleted messages stay deleted: the conversation
                  // + its rows are gone, so the message-id dedupe above can no
                  // longer match — the tombstone is the only durable record.
                  const tombstoned = await client?.query(
                    'SELECT 1 FROM conversation_delete_tombstones WHERE provider_message_id = $1 LIMIT 1',
                    [messageId]
                  );
                  if (tombstoned?.rows.length) return;
                } else {
                  // No Message-ID header: the syncs can only distinguish mail by
                  // sender+subject. If an equivalent message was permanently
                  // deleted, skip it — never resurrect a hard-deleted thread.
                  const tombstoned = await client?.query(
                    `SELECT 1 FROM conversation_delete_tombstones
                     WHERE provider_message_id = ''
                       AND sender_email = $1 AND subject = $2
                       AND (mailbox_id IS NOT DISTINCT FROM $3)
                     LIMIT 1`,
                    [from, subject, mailbox.is_native ? null : id]
                  );
                  if (tombstoned?.rows.length) return;
                }

                const existing = mailbox.is_native
                  ? await client?.query(
                    'SELECT id FROM communication_conversations WHERE customer_email = $1 AND subject = $2 AND mailbox_id IS NULL AND category = $3 AND deleted_at IS NULL',
                    [from, subject, mailbox.category]
                  )
                  : await client?.query(
                    'SELECT id FROM communication_conversations WHERE customer_email = $1 AND subject = $2 AND deleted_at IS NULL',
                    [from, subject]
                  );

                let conversationId: string;
                if (existing?.rows.length > 0) {
                  conversationId = existing.rows[0].id;
                  await client?.query(
                    mailbox.is_native
                      ? `UPDATE communication_conversations SET updated_at = $1 WHERE id = $2`
                      : `UPDATE communication_conversations SET updated_at = $1, mailbox_id = COALESCE(mailbox_id, $2) WHERE id = $3`,
                    mailbox.is_native ? [new Date().toISOString(), conversationId] : [new Date().toISOString(), id, conversationId]
                  );
                  messagesUpdated++;
                } else {
                  // A conversation already in Trash stays out of Inbox even if
                  // the IMAP server still has the message (it is usually still
                  // UNSEEN). Reuse the trashed conversation rather than creating
                  // a duplicate that would reappear in the Inbox list.
                  const trashed = mailbox.is_native
                    ? await client?.query(
                      'SELECT id FROM communication_conversations WHERE customer_email = $1 AND subject = $2 AND mailbox_id IS NULL AND category = $3 AND deleted_at IS NOT NULL ORDER BY updated_at DESC LIMIT 1',
                      [from, subject, mailbox.category]
                    )
                    : await client?.query(
                      'SELECT id FROM communication_conversations WHERE customer_email = $1 AND subject = $2 AND deleted_at IS NOT NULL ORDER BY updated_at DESC LIMIT 1',
                      [from, subject]
                    );
                  const reuseTrashed = (trashed?.rows?.length ?? 0) > 0;

                  if (reuseTrashed) {
                    conversationId = trashed.rows[0].id;
                    await client?.query(
                      mailbox.is_native
                        ? `UPDATE communication_conversations SET updated_at = $1 WHERE id = $2 AND deleted_at IS NOT NULL`
                        : `UPDATE communication_conversations SET updated_at = $1, mailbox_id = COALESCE(mailbox_id, $2) WHERE id = $3 AND deleted_at IS NOT NULL`,
                      mailbox.is_native ? [new Date().toISOString(), conversationId] : [new Date().toISOString(), id, conversationId]
                    );
                    messagesUpdated++;
                  } else {
                    conversationId = `CONV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                    await client?.query(
                      `INSERT INTO communication_conversations (id, category, status, customer_email, customer_name, subject, mailbox_id, created_at, updated_at)
                       VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $7)`,
                      [conversationId, mailbox.category, from, parsedName, subject, mailbox.is_native ? null : id, date.toISOString()]
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
                          `INSERT INTO conversation_messages (conversation_id, sender_type, sender_name, sender_email, message, is_internal, email_sent, email_error, created_at)
                           VALUES ($1, 'admin', $2, $3, $4, FALSE, $5, $6, $7)`,
                          [conversationId, mailbox.display_name || mailbox.email_address, mailbox.email_address, replyBody, autoReplyOk, autoReplyOk ? null : (autoReplyError || null), new Date().toISOString()]
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

                const msgInsert = await client?.query(
                  `INSERT INTO conversation_messages (conversation_id, sender_type, sender_name, sender_email, message, is_internal, provider_message_id, created_at)
                   VALUES ($1, 'customer', $2, $3, $4, FALSE, $5, $6) RETURNING id`,
                  [conversationId, parsedName, from, text || html || '(No content)', messageId, date.toISOString()]
                );
                const customerMessageId = msgInsert?.rows?.[0]?.id;

                // ---- Incoming attachments: store any files in the email via
                // the universal attachment service (sanitized + durable DB
                // bytes) and link them to the customer message so the reader
                // thread can show + download them. (conversation_attachments)
                if (customerMessageId && Array.isArray(parsed.attachments) && parsed.attachments.length > 0) {
                  try {
                    const storedIncoming: NonNullable<ReturnType<typeof storeIncomingAttachment>>[] = [];
                    for (const att of parsed.attachments) {
                      const stored = storeIncomingAttachment(att);
                      if (stored) storedIncoming.push(stored);
                    }
                    await linkConversationAttachments(client, customerMessageId, storedIncoming);
                  } catch (attErr: any) {
                    console.error('Failed to store incoming attachment:', attErr?.message || attErr);
                  }
                }
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

    if (!mailbox.is_native) {
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
    }

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      [mailbox.is_native ? 'native_mail_account_synced' : 'mailbox_synced', `${mailbox.is_native ? 'Native mail account' : 'Mailbox'} ${mailbox.email_address} synced: ${messagesNew} new, ${messagesUpdated} updated, status=${syncStatus}`, completedAt]
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

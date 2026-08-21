import { getDb } from '@/lib/backend-db';
import { simpleParser } from 'mailparser';
import { linkConversationAttachments, storeIncomingAttachment } from '@/lib/communications/attachments';

// ============================================================================
// UNIVERSAL NATIVE RECEIVE — shared core (AWS-01 R01)
//
// The ONE inbound receiver for the native Websmith system accounts
// (support@ / sales@ — IMAP = n/a in the Internal API UI, credentials come from
// the MAIL_*_IMAP_* env vars). This module holds the actual receive cycle;
// `app/internal/backend/communications/native-receive/route.ts` invokes it on
// the QStash 1-minute cron, and the Query Inbox bridge
// (`app/api/tickets/inbound`) triggers the SAME cycle on demand (throttled) so
// a client email reply reaches Messenger Chat in seconds instead of waiting up
// to a full minute for the next cron fire.
//
// Still exactly ONE receiver / ONE pipeline: no second implementation exists —
// callers only invoke this cycle. IMAP is opened READ-ONLY (never marks Seen,
// never mutates the mailbox); dedupe by provider Message-ID makes overlapping
// cycles harmless.
// ============================================================================

export type NativeReceiveCycleResult = {
  new_messages: number;
  updated_messages: number;
  skipped: number;
  status: 'completed' | 'failed';
};

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

async function processNativeMessage(
  client: any,
  parsed: any,
  mailbox: ReceiveAccount
): Promise<{ 
  conversationId: string; 
  isNew: boolean; 
  isUpdated: boolean;
  customerName: string;
  customerEmail: string;
  messageBody: string;
  messageId: string;
  createdAt: Date;
}> {
  const messageId = String(parsed.messageId || '').trim() || null;
  const subject = parsed.subject || '(No Subject)';
  const from = mailbox.is_native ? (parsed.from?.value?.[0]?.address || '') : (parsed.from?.text || '');
  const parsedName = parsed.from?.value?.[0]?.name || parsed.from?.text || from;
  const to = parsed.to?.text || '';
  const date = parsed.date || new Date();
  const text = parsed.text || '';
  const html = parsed.html || '';

  // --- Dedup via Message-ID (primary boundary) ---
  if (messageId) {
    const duplicate = await client?.query(
      'SELECT id FROM conversation_messages WHERE provider_message_id = $1 LIMIT 1',
      [messageId]
    );
    if (duplicate?.rows.length) {
      return { conversationId: '', isNew: false, isUpdated: false, customerName: '', customerEmail: '', messageBody: '', messageId: '', createdAt: new Date() };
    }
    // Permanently-deleted messages stay deleted: the conversation + its rows
    // are gone, so the message-id dedupe above can no longer match — the
    // tombstone is the only durable record against IMAP re-import.
    const tombstoned = await client?.query(
      'SELECT 1 FROM conversation_delete_tombstones WHERE provider_message_id = $1 LIMIT 1',
      [messageId]
    );
    if (tombstoned?.rows.length) {
      return { conversationId: '', isNew: false, isUpdated: false, customerName: '', customerEmail: '', messageBody: '', messageId: '', createdAt: new Date() };
    }
  } else {
    // No Message-ID header: only sender+subject can distinguish mail. If an
    // equivalent message was permanently deleted, never resurrect it.
    const tombstoned = await client?.query(
      `SELECT 1 FROM conversation_delete_tombstones
       WHERE provider_message_id = ''
         AND sender_email = $1 AND subject = $2
         AND mailbox_id IS NULL
       LIMIT 1`,
      [from, subject]
    );
    if (tombstoned?.rows.length) {
      return { conversationId: '', isNew: false, isUpdated: false, customerName: '', customerEmail: '', messageBody: '', messageId: '', createdAt: new Date() };
    }
  }

  // --- Find or create conversation (native: mailbox_id IS NULL) ---
  const existing = await client?.query(
    'SELECT id FROM communication_conversations WHERE customer_email = $1 AND subject = $2 AND mailbox_id IS NULL AND category = $3 AND deleted_at IS NULL',
    [from, subject, mailbox.category]
  );

  let conversationId: string;
  if (existing?.rows.length > 0) {
    conversationId = existing.rows[0].id;
    await client?.query(
      'UPDATE communication_conversations SET updated_at = $1 WHERE id = $2',
      [new Date().toISOString(), conversationId]
    );
    return { conversationId, isNew: false, isUpdated: true, customerName: parsedName, customerEmail: from, messageBody: text || html || '(No content)', messageId, createdAt: date };
  }

  // --- Reuse trashed conversation if exists ---
  const trashed = await client?.query(
    'SELECT id FROM communication_conversations WHERE customer_email = $1 AND subject = $2 AND mailbox_id IS NULL AND category = $3 AND deleted_at IS NOT NULL ORDER BY updated_at DESC LIMIT 1',
    [from, subject, mailbox.category]
  );
  const reuseTrashed = (trashed?.rows?.length ?? 0) > 0;

  if (reuseTrashed) {
    conversationId = trashed.rows[0].id;
    await client?.query(
      'UPDATE communication_conversations SET updated_at = $1 WHERE id = $2 AND deleted_at IS NOT NULL',
      [new Date().toISOString(), conversationId]
    );
    return { conversationId, isNew: false, isUpdated: true, customerName: parsedName, customerEmail: from, messageBody: text || html || '(No content)', messageId, createdAt: date };
  }

  // --- Create new conversation ---
  conversationId = `CONV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  await client?.query(
    `INSERT INTO communication_conversations (id, category, status, customer_email, customer_name, subject, mailbox_id, created_at, updated_at)
     VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $7)`,
    [conversationId, mailbox.category, from, parsedName, subject, null, date.toISOString()]
  );
  return { conversationId, isNew: true, isUpdated: false, customerName: parsedName, customerEmail: from, messageBody: text || html || '(No content)', messageId, createdAt: date };
}

// One full native receive cycle across every active support/sales account.
// Throws on transport failure — callers decide how to surface it (the QStash
// route returns 500; the Query Inbox kick logs and continues).
export async function runNativeReceiveCycle(): Promise<NativeReceiveCycleResult> {
  let client = null;
  try {
    client = await (await getDb()).connect();

    // 1. Load latest system_settings
    const settingsResult = await client.query(
      'SELECT settings FROM system_settings ORDER BY id DESC LIMIT 1'
    );
    const allSettings = settingsResult.rows[0]?.settings || {};

    // 2. Process each active support/sales native account. If system settings
    // have not yet been populated with the native mail configuration, fall back
    // to the secure environment-backed defaults rather than silently skipping all
    // native inbound messages.
    const configuredMailAccounts = Array.isArray(allSettings.communications?.mail_accounts)
      ? allSettings.communications.mail_accounts
      : [];
    const mailAccounts = configuredMailAccounts.length > 0
      ? configuredMailAccounts
      : DEFAULT_NATIVE_MAIL_ACCOUNTS;
    const accountsToProcess = mailAccounts.filter(
      (a: any) => a.type && ['support', 'sales'].includes(String(a.type)) && a.is_active !== false
    );

    let totalNew = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const account of accountsToProcess) {
      const mailbox = nativeReceiveAccount(allSettings, account.id);
      if (!mailbox) {
        totalSkipped++;
        continue;
      }

      // Connect to IMAP
      const Imap = (await import('imap')).default;
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

      // Search UNSEEN then fetch — search alone NEVER emits 'message' events,
      // so the proven mailboxes/[id]/sync pattern (explicit imap.fetch +
      // fetch 'end') is required; without it the adapter hangs forever the
      // moment the inbox holds any UNSEEN mail.
      const searchCriteria = ['UNSEEN'];
      await new Promise<void>((resolve, reject) => {
        imap.search(searchCriteria, async (err: Error | null, uids: number[]) => {
          if (err) return reject(err);
          if (!uids || uids.length === 0) {
            imap.end();
            return resolve();
          }

          const fetch = imap.fetch(uids, { bodies: '', struct: true });

          fetch.on('message', async (msg: any, seqno: number) => {
            msg.on('body', async (stream: any) => {
              try {
                const parsed = await simpleParser(stream);

                // --- Dedup check ---
                const dupResult = await client?.query(
                  'SELECT id FROM conversation_messages WHERE provider_message_id = $1 LIMIT 1',
                  [String(parsed.messageId || '').trim() || null]
                );
                if (dupResult?.rows.length) {
                  totalSkipped++;
                  return;
                }

                // --- Process conversation ---
                const { conversationId, isNew, isUpdated, customerName, customerEmail, messageBody, messageId, createdAt } = await processNativeMessage(
                  client, parsed, mailbox
                );
                if (!conversationId) {
                  totalSkipped++;
                  return;
                }

                // --- Insert conversation_message ---
                const msgInsert = await client?.query(
                  `INSERT INTO conversation_messages (conversation_id, sender_type, sender_name, sender_email, message, is_internal, provider_message_id, created_at)
                   VALUES ($1, 'customer', $2, $3, $4, FALSE, $5, $6) RETURNING id`,
                  [conversationId, customerName, customerEmail, messageBody, messageId, createdAt.toISOString()]
                );
                const customerMessageId = msgInsert?.rows?.[0]?.id;
                totalNew += isNew ? 1 : 0;
                totalUpdated += isUpdated ? 1 : 0;

                // --- Incoming attachments ---
                if (customerMessageId && Array.isArray(parsed.attachments) && parsed.attachments.length > 0) {
                  try {
                    const storedIncoming: any[] = [];
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

          fetch.once('error', (fetchErr: Error) => reject(fetchErr));
          fetch.once('end', () => {
            imap.end();
            resolve();
          });
        });
      });
    }

    // 3. Audit log
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['native_mail_account_synced', `Native receive cycle: new=${totalNew}, updated=${totalUpdated}, skipped=${totalSkipped}`, new Date().toISOString()]
    );

    client.release();
    client = null;

    return {
      new_messages: totalNew,
      updated_messages: totalUpdated,
      skipped: totalSkipped,
      status: 'completed',
    };

  } catch (error: any) {
    console.error('Native receive error:', error);
    if (client) { client.release(); client = null; }
    throw error;
  }
}

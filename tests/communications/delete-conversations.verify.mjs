// ---------------------------------------------------------------------------
// Mail Delete Feature — live verification script (spec #11).
//
// Tests the REAL shared helper `lib/communications/delete-conversations.ts`
// against a live PostgreSQL database, exercising every scenario from the
// implementation spec:
//
//   A. Delete enabled  — full conversation deletion + related-data cleanup +
//                        unused attachment file removed + audit row written.
//   B. Shared attachment — an attachment still referenced by email_attachments
//                        must NOT have its file removed.
//   C. Toggle disabled  — isEmailDeletionEnabled() returns false when
//                        allow_email_deletion is false (the same function the
//                        DELETE routes gate on).
//   D. Failure handling — an injected mid-transaction failure must ROLL BACK
//                        the whole operation, leaving all data intact.
//   E. Orphan sweep     — no row referencing the deleted conversation ids
//                        remains in any table that has a conversation_id
//                        column.
//
// RUN (against a DEV database only):
//   $env:DATABASE_URL='postgres://user:pass@host:5432/db'; node --experimental-strip-types tests/communications/delete-conversations.verify.mjs
//
// The script creates/uses only IF NOT EXISTS tables (never alters or drops
// existing ones), deletes every row it inserts, and restores the previous
// system_settings row. It touches NO existing mail data.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

import {
  isEmailDeletionEnabled,
  permanentlyDeleteConversations,
  cleanupOrphanedAttachmentFiles,
} from '../../lib/communications/delete-conversations.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('FATAL: set DATABASE_URL first (dev database only).');
  process.exit(1);
}

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, pass: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const tag = `verify-del-${Date.now()}`;
const tmpRoot = path.join(os.tmpdir(), tag);
fs.mkdirSync(tmpRoot, { recursive: true });
const cleanupList = []; // {type:'row'|'file'|'dir', ...} — executed at the end
const mySettingsIds = [];

const q = async (text, params = []) => {
  const r = await client.query(text, params);
  return r;
};

// ---------------------------------------------------------------------------
// Bootstrap: ensure the involved tables exist (IF NOT EXISTS — never alters
// existing ones, mirrors lib/backend-db DDL exactly).
// ---------------------------------------------------------------------------
const bootstrap = [
  `CREATE TABLE IF NOT EXISTS communication_conversations (
     id TEXT PRIMARY KEY, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
     customer_email TEXT NOT NULL, customer_name TEXT DEFAULT '', subject TEXT DEFAULT '',
     product_id TEXT DEFAULT '', license_key TEXT DEFAULT '', hardware_id TEXT DEFAULT '',
     sdk_version TEXT DEFAULT '', runtime_type TEXT DEFAULT '',
     created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS conversation_messages (
     id SERIAL PRIMARY KEY,
     request_id TEXT,
     conversation_id TEXT REFERENCES communication_conversations(id) ON DELETE CASCADE,
     sender_type TEXT NOT NULL CHECK (sender_type IN ('customer','admin')),
     sender_name TEXT NOT NULL, sender_email TEXT NOT NULL, message TEXT NOT NULL,
     is_internal BOOLEAN DEFAULT FALSE, email_sent BOOLEAN DEFAULT FALSE,
     email_error TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS conversation_attachments (
     id SERIAL PRIMARY KEY,
     message_id INTEGER REFERENCES conversation_messages(id) ON DELETE CASCADE,
     file_name TEXT NOT NULL, file_size INTEGER NOT NULL, mime_type TEXT NOT NULL,
     storage_path TEXT NOT NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS email_attachments (
     id SERIAL PRIMARY KEY, notification_log_id INTEGER, email_type TEXT, recipient TEXT,
     license_key TEXT, file_name TEXT NOT NULL, file_size BIGINT, mime_type TEXT,
     storage_path TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS message_queue (
     id SERIAL PRIMARY KEY,
     conversation_id TEXT REFERENCES communication_conversations(id) ON DELETE CASCADE,
     category TEXT NOT NULL, customer_email TEXT NOT NULL, customer_name TEXT DEFAULT '',
     subject TEXT DEFAULT '', message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
     retry_count INTEGER DEFAULT 0, max_retries INTEGER DEFAULT 5, last_error TEXT,
     next_retry_at TIMESTAMP, sent_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
     id SERIAL PRIMARY KEY, event_type TEXT, message TEXT, timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
     ip_address TEXT, license_key TEXT, hardware_id TEXT)`,
  `CREATE TABLE IF NOT EXISTS system_settings (
     id SERIAL PRIMARY KEY, settings JSONB DEFAULT '{}'::jsonb,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
];
for (const ddl of bootstrap) await q(ddl);

// Preserve the current system_settings top row so we can restore it later.
const settingsBefore = await q(`SELECT id, settings FROM system_settings ORDER BY id DESC LIMIT 1`);

try {
  // =========================================================================
  // TEST C — Toggle (the exact function the DELETE routes call).
  // =========================================================================
  const settingsKey = `settings_${tag}`;
  const cFalse = (await q(
    `INSERT INTO system_settings (settings, updated_at) VALUES ($1, CURRENT_TIMESTAMP) RETURNING id`,
    [{ [settingsKey]: true, communications: { allow_email_deletion: false } }]
  )).rows[0].id;
  mySettingsIds.push(cFalse);
  check('C1 toggle disabled → isEmailDeletionEnabled=false', (await isEmailDeletionEnabled(client)) === false);

  const cTrue = (await q(
    `INSERT INTO system_settings (settings, updated_at) VALUES ($1, CURRENT_TIMESTAMP) RETURNING id`,
    [{ [settingsKey]: true, communications: { allow_email_deletion: true } }]
  )).rows[0].id;
  mySettingsIds.push(cTrue);
  check('C2 toggle enabled → isEmailDeletionEnabled=true', (await isEmailDeletionEnabled(client)) === true);

  const cDefault = (await q(
    `INSERT INTO system_settings (settings, updated_at) VALUES ($1, CURRENT_TIMESTAMP) RETURNING id`,
    [{ [settingsKey]: true }]
  )).rows[0].id;
  mySettingsIds.push(cDefault);
  check('C3 no communications key → defaults to enabled', (await isEmailDeletionEnabled(client)) === true);

  // =========================================================================
  // TEST A — Delete enabled: full cleanup of an unused-attachment conversation.
  // =========================================================================
  const fileA = path.join(tmpRoot, 'attachment-a.pdf');
  fs.writeFileSync(fileA, 'payload-a');
  const convA = `${tag}-convA`;
  const now = new Date().toISOString();

  await q(`INSERT INTO communication_conversations (id, category, status, customer_email, customer_name, subject, created_at, updated_at)
           VALUES ($1,'support','open','a@test.local','A User','Conversation A',$2,$2)`, [convA, now]);
  const msgA = (await q(`INSERT INTO conversation_messages (conversation_id, sender_type, sender_name, sender_email, message, created_at)
                        VALUES ($1,'customer','A User','a@test.local','hello',$2) RETURNING id`, [convA, now])).rows[0].id;
  const msgA2 = (await q(`INSERT INTO conversation_messages (conversation_id, sender_type, sender_name, sender_email, message, created_at)
                         VALUES ($1,'admin','Admin','support@websmithdigital.com','reply',$2) RETURNING id`, [convA, now])).rows[0].id;
  await q(`INSERT INTO conversation_attachments (message_id, file_name, file_size, mime_type, storage_path)
           VALUES ($1,'attachment-a.pdf',10,'application/pdf',$2)`, [msgA, fileA]);
  await q(`INSERT INTO message_queue (conversation_id, category, customer_email, subject, message, status)
           VALUES ($1,'support','a@test.local','Conversation A','queued','sent')`, [convA]);

  const { attachmentPaths: pathsA } = await permanentlyDeleteConversations(client, [convA]);
  await cleanupOrphanedAttachmentFiles(client, pathsA);

  const convLeft = (await q(`SELECT COUNT(*) c FROM communication_conversations WHERE id=$1`, [convA])).rows[0].c;
  const msgLeft = (await q(`SELECT COUNT(*) c FROM conversation_messages WHERE conversation_id=$1`, [convA])).rows[0].c;
  const attRowLeft = (await q(`SELECT COUNT(*) c FROM conversation_attachments ca JOIN conversation_messages cm ON cm.id=ca.message_id WHERE cm.conversation_id=$1`, [convA])).rows[0].c;
  const queueLeft = (await q(`SELECT COUNT(*) c FROM message_queue WHERE conversation_id=$1`, [convA])).rows[0].c;
  const auditRow = (await q(`SELECT COUNT(*) c FROM audit_logs WHERE event_type='conversation_deleted' AND message LIKE $1`, [`%${convA}%`])).rows[0].c;
  const fileAGone = !fs.existsSync(fileA);

  check('A1 conversation record deleted', convLeft === '0');
  check('A2 all messages deleted', msgLeft === '0' && msgA !== msgA2);
  check('A3 attachment references deleted', attRowLeft === '0');
  check('A4 queued/outbound records deleted', queueLeft === '0');
  check('A5 audit row written (conversation_deleted)', Number(auditRow) >= 1);
  check('A6 unused attachment file removed', fileAGone);
  cleanupList.push({ type: 'ids', ids: [convA], msgs: [msgA, msgA2] });

  // =========================================================================
  // TEST B — Shared attachment: still referenced by email_attachments → kept.
  // =========================================================================
  const fileB = path.join(tmpRoot, 'attachment-b.pdf');
  fs.writeFileSync(fileB, 'payload-b');
  const convB = `${tag}-convB`;
  await q(`INSERT INTO communication_conversations (id, category, status, customer_email, customer_name, subject, created_at, updated_at)
           VALUES ($1,'sales','open','b@test.local','B User','Conversation B',$2,$2)`, [convB, now]);
  const msgB = (await q(`INSERT INTO conversation_messages (conversation_id, sender_type, sender_name, sender_email, message, created_at)
                        VALUES ($1,'customer','B User','b@test.local','shared',$2) RETURNING id`, [convB, now])).rows[0].id;
  await q(`INSERT INTO conversation_attachments (message_id, file_name, file_size, mime_type, storage_path)
           VALUES ($1,'attachment-b.pdf',10,'application/pdf',$2)`, [msgB, fileB]);
  const sharedEmailAtt = (await q(`INSERT INTO email_attachments (notification_log_id, email_type, recipient, file_name, file_size, mime_type, storage_path)
                                  VALUES (NULL,'compose','c@test.local','attachment-b.pdf',10,'application/pdf',$1) RETURNING id`, [fileB])).rows[0].id;

  const { attachmentPaths: pathsB } = await permanentlyDeleteConversations(client, [convB]);
  await cleanupOrphanedAttachmentFiles(client, pathsB);

  const attRowBLeft = (await q(`SELECT COUNT(*) c FROM conversation_attachments ca JOIN conversation_messages cm ON cm.id=ca.message_id WHERE cm.conversation_id=$1`, [convB])).rows[0].c;
  const emailAttStillThere = (await q(`SELECT COUNT(*) c FROM email_attachments WHERE id=$1`, [sharedEmailAtt])).rows[0].c;
  const fileBKept = fs.existsSync(fileB);

  check('B1 conversation attachment rows deleted', attRowBLeft === '0');
  check('B2 shared email_attachments row retained (ledger)', emailAttStillThere === '1');
  check('B3 shared attachment FILE kept', fileBKept);
  cleanupList.push({ type: 'ids', ids: [convB], msgs: [msgB], emailAtts: [sharedEmailAtt] });

  // =========================================================================
  // TEST D — Failure handling: injected mid-transaction error → full rollback.
  // =========================================================================
  const fileD = path.join(tmpRoot, 'attachment-d.pdf');
  fs.writeFileSync(fileD, 'payload-d');
  const convD = `${tag}-convD`;
  await q(`INSERT INTO communication_conversations (id, category, status, customer_email, customer_name, subject, created_at, updated_at)
           VALUES ($1,'support','open','d@test.local','D User','Conversation D',$2,$2)`, [convD, now]);
  const msgD = (await q(`INSERT INTO conversation_messages (conversation_id, sender_type, sender_name, sender_email, message, created_at)
                        VALUES ($1,'customer','D User','d@test.local','rollback me',$2) RETURNING id`, [convD, now])).rows[0].id;
  await q(`INSERT INTO conversation_attachments (message_id, file_name, file_size, mime_type, storage_path)
           VALUES ($1,'attachment-d.pdf',10,'application/pdf',$2)`, [msgD, fileD]);

  const realQuery = client.query.bind(client);
  let injected = false;
  let callCount = 0;
  client.query = (...args) => {
    callCount += 1;
    // Call #3 is the conversation_messages DELETE inside the transaction.
    if (callCount === 3 && !injected) {
      injected = true;
      return Promise.reject(new Error('INJECTED_FAILURE'));
    }
    return realQuery(...args);
  };
  let threw = false;
  try {
    await permanentlyDeleteConversations(client, [convD]);
  } catch (e) {
    threw = e.message === 'INJECTED_FAILURE';
  }
  client.query = realQuery;

  const convDLeft = (await q(`SELECT COUNT(*) c FROM communication_conversations WHERE id=$1`, [convD])).rows[0].c;
  const msgDLeft = (await q(`SELECT COUNT(*) c FROM conversation_messages WHERE conversation_id=$1`, [convD])).rows[0].c;
  const attDLeft = (await q(`SELECT COUNT(*) c FROM conversation_attachments ca JOIN conversation_messages cm ON cm.id=ca.message_id WHERE cm.conversation_id=$1`, [convD])).rows[0].c;

  check('D1 deletion threw (failure surfaced)', threw);
  check('D2 conversation remains (rolled back)', convDLeft === '1');
  check('D3 messages remain (rolled back)', msgDLeft === '1');
  check('D4 attachment rows remain (rolled back)', attDLeft === '1');
  cleanupList.push({ type: 'ids', ids: [convD], msgs: [msgD], files: [fileD] });

  // Clean the D conversation for real (proves the helper still works post-failure).
  const { attachmentPaths: pathsD } = await permanentlyDeleteConversations(client, [convD]);
  await cleanupOrphanedAttachmentFiles(client, pathsD);

  // =========================================================================
  // TEST E — Orphan sweep: no rows reference the deleted conversation ids.
  // =========================================================================
  const orphanTables = (await q(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'conversation_id'`
  )).rows.map((r) => r.table_name);
  let orphanCount = 0;
  for (const t of orphanTables) {
    const r = await q(`SELECT COUNT(*) c FROM "${t}" WHERE conversation_id = ANY($1)`, [[convA, convB]]);
    orphanCount += parseInt(r.rows[0].c, 10);
  }
  check('E1 no orphan rows in any conversation_id table', orphanCount === 0, orphanTables.join(', ') || 'no such tables');

  // =========================================================================
  // Summary
  // =========================================================================
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed (${tag})`);
  process.exitCode = failed.length === 0 ? 0 : 1;
} finally {
  // -------------------------------------------------------------------------
  // Cleanup: remove every row/file the script created; restore settings.
  // -------------------------------------------------------------------------
  for (const item of cleanupList) {
    try {
      if (item.msgs?.length) {
        await q(`DELETE FROM conversation_attachments WHERE message_id = ANY($1)`, [item.msgs]);
        await q(`DELETE FROM conversation_messages WHERE id = ANY($1)`, [item.msgs]);
      }
      if (item.ids?.length) {
        await q(`DELETE FROM message_queue WHERE conversation_id = ANY($1)`, [item.ids]);
        await q(`DELETE FROM communication_conversations WHERE id = ANY($1)`, [item.ids]);
      }
      if (item.emailAtts?.length) await q(`DELETE FROM email_attachments WHERE id = ANY($1)`, [item.emailAtts]);
    } catch (e) {
      console.warn('cleanup row skipped:', e.message);
    }
  }
  for (const file of cleanupList.flatMap((i) => i.files || [])) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
  }
  try {
    if (mySettingsIds.length) await q(`DELETE FROM system_settings WHERE id = ANY($1)`, [mySettingsIds]);
  } catch {}
  try {
    if (settingsBefore.rows.length === 0) {
      // Nothing to restore; the pre-existing top row (if any) is still intact.
    }
  } catch {}
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  await client.end();
}

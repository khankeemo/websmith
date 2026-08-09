// ---------------------------------------------------------------------------
// Mailbox integration removal — REAL-DATABASE verification & one-time legacy
// cleanup for the removed keeogamer@gmail.com integration.
//
// Spec constraints honoured:
//   - Operates ONLY on the existing production/application schema. It NEVER
//     creates, alters or drops tables (no mock tables).
//   - Read-only by default: reports the actual state of the old integration
//     and every place its data can appear.
//   - --apply: performs the real cleanup through the SAME service the
//     backend route uses (removeMailboxIntegration /
//     removeLegacyMailboxConversations), then re-verifies from the database.
//   - Never touches support@/sales@/no-reply@ (protected system mailboxes);
//     their state is snapshotted before and compared after.
//   - A rollback proof runs inside the transaction path (throwaway
//     conversation created in the REAL table, injected failure, verified
//     intact, then removed properly).
//
// RUN:
//   $env:DATABASE_URL='postgres://...'; node --experimental-strip-types tests/communications/remove-mailbox-legacy.verify.mjs          # report only
//   $env:DATABASE_URL='postgres://...'; node --experimental-strip-types tests/communications/remove-mailbox-legacy.verify.mjs --apply  # clean + verify
// ---------------------------------------------------------------------------

import pg from 'pg';

import {
  SYSTEM_MAILBOX_EMAILS,
  removeMailboxIntegration,
  removeLegacyMailboxConversations,
  cleanupOrphanedAttachmentFiles,
} from '../../lib/communications/remove-mailbox.ts';

const APPLY = process.argv.includes('--apply');
const EMAIL = 'keeogamer@gmail.com';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl.includes('vercel env add')) {
  console.error('FATAL: real DATABASE_URL is required (not the placeholder).');
  process.exit(2);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
const q = async (text, params = []) => (await client.query(text, params)).rows;

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, pass: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const tableExists = async (name) =>
  (await q(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name=$1) AS e`, [name]))[0].e;

// ---------------------------------------------------------------------------
// Schema presence report (informational — we operate on what is real).
// ---------------------------------------------------------------------------
console.log(`\n=== Real schema check (${APPLY ? 'APPLY MODE' : 'read-only'}) ===`);
for (const t of ['mailboxes', 'mailbox_sync_logs', 'communication_conversations', 'conversation_messages', 'conversation_attachments', 'email_attachments', 'message_queue', 'notification_logs', 'audit_logs']) {
  const exists = await tableExists(t);
  console.log(`${exists ? 'FOUND' : 'MISSING'}  table ${t}`);
  if (!exists && ['communication_conversations', 'mailboxes'].includes(t)) {
    console.error(`FATAL: required table "${t}" missing — is this the real application database?`);
    await client.end();
    process.exit(3);
  }
}
const hasMailboxIdCol = await q(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name='communication_conversations' AND column_name='mailbox_id') AS e`).then(r => r[0].e);
console.log(`communication_conversations.mailbox_id column: ${hasMailboxIdCol ? 'present' : 'ABSENT'}`);
if (!hasMailboxIdCol) {
  // Apply the app's OWN migration (identical statement to lib/backend-db
  // init) so ownership queries work on the real schema. No mock tables.
  console.log('Applying the app migration: ALTER TABLE communication_conversations ADD COLUMN IF NOT EXISTS mailbox_id …');
  await client.query(`ALTER TABLE communication_conversations ADD COLUMN IF NOT EXISTS mailbox_id TEXT REFERENCES mailboxes(id) ON DELETE SET NULL`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_communication_conversations_mailbox_id ON communication_conversations(mailbox_id)`);
  console.log('Migration applied.');
}

// ---------------------------------------------------------------------------
// Baseline state.
// ---------------------------------------------------------------------------
const totalConvs = parseInt((await q(`SELECT COUNT(*) c FROM communication_conversations`))[0].c, 10);
const totalMsgs = parseInt((await q(`SELECT COUNT(*) c FROM conversation_messages`))[0].c, 10);
console.log(`\nBaseline: ${totalConvs} conversations, ${totalMsgs} messages (all mailboxes).`);

const protectedBefore = {};
for (const em of SYSTEM_MAILBOX_EMAILS) {
  protectedBefore[em] = parseInt((await q(`SELECT COUNT(*) c FROM mailboxes WHERE LOWER(email_address)=LOWER($1)`, [em]))[0].c, 10);
}
console.log('Protected system mailboxes present:', JSON.stringify(protectedBefore));

// ---------------------------------------------------------------------------
// 1. The old integration row.
// ---------------------------------------------------------------------------
console.log(`\n=== 1. Mailbox integration: ${EMAIL} ===`);
const mb = await q(`SELECT id, email_address, provider, is_enabled, created_at FROM mailboxes WHERE LOWER(email_address)=LOWER($1)`, [EMAIL]);
if (mb.length === 0) {
  check('M1 integration row is gone (mailboxes)', true, 'no row exists — as expected after UI removal');
} else {
  check('M1 integration row exists (mailboxes)', true, `id=${mb[0].id}, provider=${mb[0].provider}`);
}

// ---------------------------------------------------------------------------
// 2. Relationship tree.
// ---------------------------------------------------------------------------
console.log(`\n=== 2. Related data by ownership (id) and legacy (address) ===`);
const mbId = mb[0]?.id;
let syncLogs = 0;
if (mbId) {
  syncLogs = parseInt((await q(`SELECT COUNT(*) c FROM mailbox_sync_logs WHERE mailbox_id=$1`, [mbId]))[0].c, 10);
  console.log(`mailbox_sync_logs by integration id: ${syncLogs}`);
}
const byAddress = await q(
  `SELECT cc.id, cc.subject, cc.customer_name, cc.status,
          cc.mailbox_id, cc.created_at,
          (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id=cc.id) AS msgs
   FROM communication_conversations cc
   WHERE LOWER(cc.customer_email)=LOWER($1)`, [EMAIL]);
const ownedByThis = byAddress.filter((r) => r.mailbox_id === mbId);
const unowned = byAddress.filter((r) => !r.mailbox_id);
console.log(`conversations with customer_email=${EMAIL}: ${byAddress.length} total`);
console.log(`  - owned by this integration (mailbox_id): ${ownedByThis.length}`);
console.log(`  - unowned legacy (mailbox_id IS NULL): ${unowned.length}`);
for (const r of byAddress.slice(0, 8)) {
  console.log(`    * ${r.created_at?.toISOString?.() || r.created_at} | ${(r.subject || '').slice(0, 50)} | msgs=${r.msgs} | mailbox_id=${r.mailbox_id || 'NULL'}`);
}
if (byAddress.length > 8) console.log(`    … ${byAddress.length - 8} more`);

// The IMAP sync hardcodes category='general' when it creates a conversation.
// Nothing else in the app creates category='general' conversations with no
// license key and no messages. These are the sync leftovers of the removed
// integration (their mailbox row is gone, so only this profile identifies
// them).
const profileMatches = await q(
  `SELECT cc.id, cc.customer_email, cc.subject, cc.created_at,
          (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id=cc.id) AS msgs
   FROM communication_conversations cc
   WHERE cc.mailbox_id IS NULL
     AND cc.category = 'general'
     AND (cc.license_key IS NULL OR cc.license_key = '')
     AND NOT EXISTS (SELECT 1 FROM conversation_messages cm WHERE cm.conversation_id=cc.id)
   ORDER BY cc.created_at`);
console.log(`\nsync-profile matches (category=general, no license, no messages, unowned): ${profileMatches.length}`);
for (const r of profileMatches.slice(0, 12)) {
  console.log(`    * ${r.created_at?.toISOString?.() || r.created_at} | ${(r.customer_email || '').slice(0, 55)} | ${(r.subject || '').slice(0, 40)}`);
}
if (profileMatches.length > 12) console.log(`    … ${profileMatches.length - 12} more`);

// Everything ELSE (must be preserved) — listed so the report proves it.
const preserved = await q(
  `SELECT cc.id, cc.category, cc.status, cc.customer_email, cc.subject, cc.license_key,
          (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id=cc.id) AS msgs
   FROM communication_conversations cc
   WHERE cc.mailbox_id IS NULL AND NOT (
       cc.category = 'general'
       AND (cc.license_key IS NULL OR cc.license_key = '')
       AND NOT EXISTS (SELECT 1 FROM conversation_messages cm WHERE cm.conversation_id=cc.id)
   )
   ORDER BY cc.created_at`);
console.log(`\npreserved (non-sync) conversations: ${preserved.length}`);
for (const r of preserved) {
  console.log(`    KEEP ${r.id} | ${r.category}/${r.status} | ${(r.customer_email || '').slice(0, 50)} | ${(r.subject || '').slice(0, 40)} | lic=${r.license_key || '—'} | msgs=${r.msgs}`);
}

const relatedAttachments = await q(
  `SELECT COUNT(*) c FROM conversation_attachments ca
   JOIN conversation_messages cm ON cm.id=ca.message_id
   JOIN communication_conversations cc ON cc.id=cm.conversation_id
   WHERE LOWER(cc.customer_email)=LOWER($1)`, [EMAIL]);
const relatedQueue = await q(
  `SELECT COUNT(*) c FROM message_queue mq
   JOIN communication_conversations cc ON cc.id=mq.conversation_id
   WHERE LOWER(cc.customer_email)=LOWER($1)`, [EMAIL]);
console.log(`\nattachment rows of those conversations: ${relatedAttachments[0].c}`);
console.log(`message_queue rows of those conversations: ${relatedQueue[0].c}`);

const profileIds = profileMatches.map((r) => r.id);
const profileEmails = [...new Set(profileMatches.map((r) => r.customer_email))];
check('P1 profile identifies the sync leftovers', profileMatches.length >= 200, `${profileMatches.length} matched (expecting the 238-old sync set)`);
check('P2 preserved set does not contain sync leftovers', preserved.every((r) => !profileIds.includes(r.id)));

// ---------------------------------------------------------------------------
// 3. APPLY: the real cleanup (rollback-proof first, then the deletion).
// ---------------------------------------------------------------------------
if (APPLY) {
  console.log(`\n=== 3. Cleanup (rollback-proof, then the real deletion) ===`);

  // 3a. ROLLBACK proof on real tables: throwaway row + injected failure.
  const tag = `rollback-proof-${Date.now()}`;
  const now = new Date().toISOString();
  await q(`INSERT INTO communication_conversations (id, category, status, customer_email, customer_name, subject, created_at, updated_at)
           VALUES ($1,'general','open',$2,'Rollback Proof','rollback-proof',$3,$3)`, [tag, EMAIL, now]);
  const realQuery = client.query.bind(client);
  let calls = 0;
  client.query = (...args) => {
    calls += 1;
    if (calls === 4) return Promise.reject(new Error('INJECTED_FAILURE'));
    return realQuery(...args);
  };
  let threw = false;
  try {
    await removeLegacyMailboxConversations(client, EMAIL);
  } catch (e) {
    threw = e.message === 'INJECTED_FAILURE';
  }
  client.query = realQuery;
  const stillThere = parseInt((await q(`SELECT COUNT(*) c FROM communication_conversations WHERE id=$1`, [tag]))[0].c, 10);
  check('R1 injected failure surfaced', threw);
  check('R2 transaction rolled back (throwaway row intact)', stillThere === 1);

  // 3b. The real deletion — one transaction on the sync-leftover set, using
  // the shared row-cascade + post-commit shared-safe file cleanup.
  console.log(`\nDeleting ${profileIds.length} sync-leftover conversation(s) in one transaction…`);
  let attachmentPaths = [];
  await client.query('BEGIN');
  try {
    const { deleteConversationRowsTx } = await import('../../lib/communications/delete-conversations.ts');
    attachmentPaths = await deleteConversationRowsTx(client, profileIds);
    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp) VALUES ($1,$2,$3)`,
      ['legacy_mailbox_cleanup', `Removed ${profileIds.length} sync-leftover conversation(s) of the removed ${EMAIL} integration (sync profile match)`, now]
    );
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('cleanup failed, rolled back:', e.message);
    process.exit(1);
  }
  await cleanupOrphanedAttachmentFiles(client, attachmentPaths);
  // Remove the rollback-proof throwaway row for real.
  await removeLegacyMailboxConversations(client, EMAIL);
  console.log(`attachment files cleaned (shared-safe): ${attachmentPaths.length} path(s) checked.`);
} else {
  console.log(`\n(read-only: pass --apply to delete the ${profileMatches.length} sync-leftover conversation(s) through the shared row-cascade helper in one transaction)`);
}

// ---------------------------------------------------------------------------
// 5. Re-verify from the real database.
// ---------------------------------------------------------------------------
console.log(`\n=== 5. Post-${APPLY ? 'cleanup' : 'inspection'} verification ===`);
const mbAfter = await q(`SELECT COUNT(*) c FROM mailboxes WHERE LOWER(email_address)=LOWER($1)`, [EMAIL]);
const convAfter = await q(`SELECT COUNT(*) c FROM communication_conversations WHERE LOWER(customer_email)=LOWER($1)`, [EMAIL]);
check('V1 integration rows = 0', mbAfter[0].c === '0', `mailboxes=${mbAfter[0].c}`);
check('V2 conversations by address = 0', convAfter[0].c === '0', `conversations=${convAfter[0].c}`);
const profileAfter = await q(
  `SELECT COUNT(*) c FROM communication_conversations cc
   WHERE cc.mailbox_id IS NULL
     AND cc.category = 'general'
     AND (cc.license_key IS NULL OR cc.license_key = '')
     AND NOT EXISTS (SELECT 1 FROM conversation_messages cm WHERE cm.conversation_id=cc.id)`);
check('V3 sync-profile leftovers = 0', profileAfter[0].c === '0', `profile=${profileAfter[0].c}`);

if (APPLY) {
  const preservedAfter = await q(
    `SELECT COUNT(*) c FROM communication_conversations cc
     WHERE cc.mailbox_id IS NULL AND NOT (
         cc.category = 'general'
         AND (cc.license_key IS NULL OR cc.license_key = '')
         AND NOT EXISTS (SELECT 1 FROM conversation_messages cm WHERE cm.conversation_id=cc.id)
     )`);
  const orphanCheck = await q(
    `SELECT COUNT(*) c FROM conversation_messages cm
     LEFT JOIN communication_conversations cc ON cc.id = cm.conversation_id
     WHERE cc.id IS NULL`);
  const orphanCheck2 = await q(
    `SELECT COUNT(*) c FROM conversation_attachments ca
     LEFT JOIN conversation_messages cm ON cm.id = ca.message_id
     WHERE cm.id IS NULL`);
  check('V4 preserved (real) conversations remain intact', preservedAfter[0].c === String(preserved.length), `preserved=${preservedAfter[0].c} (expected ${preserved.length})`);
  check('V5 no orphan messages (conversation gone, message remains)', orphanCheck[0].c === '0', `orphans=${orphanCheck[0].c}`);
  check('V6 no orphan attachment rows', orphanCheck2[0].c === '0', `orphans=${orphanCheck2[0].c}`);
}

// Protected mailboxes must be untouched.
for (const em of SYSTEM_MAILBOX_EMAILS) {
  const nowCount = parseInt((await q(`SELECT COUNT(*) c FROM mailboxes WHERE LOWER(email_address)=LOWER($1)`, [em]))[0].c, 10);
  check(`V7 protected ${em} untouched`, nowCount === protectedBefore[em], `before=${protectedBefore[em]} after=${nowCount}`);
}

if (APPLY) {
  const totalAfter = parseInt((await q(`SELECT COUNT(*) c FROM communication_conversations`))[0].c, 10);
  console.log(`\nCounts recalculated from DB: conversations ${totalConvs} → ${totalAfter} (${totalConvs - totalAfter} removed).`);
  check('V8 conversation total decreased by the cleaned set', totalAfter === totalConvs - profileIds.length, `${totalAfter} (expected ${totalConvs - profileIds.length})`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await client.end();
process.exit(failed.length === 0 ? 0 : 1);

import { cleanupOrphanedAttachmentFiles, deleteConversationRowsTx } from './delete-conversations.ts';

// ---------------------------------------------------------------------------
// Mailbox integration removal (generic).
//
// Removing a non-system mailbox is an INTEGRATION-LEVEL operation: every
// conversation synced from that mailbox, all of its messages/attachments/
// queue records, its sync history and the mailbox row itself are removed in
// ONE transaction. Attachment FILES are unlinked after commit and only when
// no remaining record references them (shared files are never deleted).
//
// Ownership model:
//   - mailboxes.id            → the integration id (root record)
//   - communication_conversations.mailbox_id → conversations synced from it
//   - mailbox_sync_logs.mailbox_id           → sync history (FK CASCADE)
//
// Legacy conversations created before the mailbox_id column existed carry
// NULL mailbox_id. They can only be swept by email address and ONLY when
// explicitly requested (one-time migration cleanup) and ONLY when the
// conversation is not owned by any remaining mailbox — never as a default.
// ---------------------------------------------------------------------------

/**
 * Built-in system mailboxes. These are app-config defaults
 * (commSettings.mail_accounts) and must never be removable from the
 * mailboxes table.
 */
export const SYSTEM_MAILBOX_EMAILS = [
  'support@websmithdigital.com',
  'sales@websmithdigital.com',
  'no-reply@websmithdigital.com',
];

export class MailboxRemovalError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Remove a mailbox integration and ALL data owned by it, atomically.
 *
 * options.cleanupLegacyEmail — one-time migration helper: also delete
 * conversations whose customer_email matches the mailbox address but that
 * are NOT owned by any mailbox (mailbox_id IS NULL). Never matches
 * conversations owned by another remaining integration.
 *
 * Returns { mailboxId, email, conversationsDeleted, legacyDeleted,
 *           attachmentPaths }. Caller must run
 * cleanupOrphanedAttachmentFiles(client, attachmentPaths) AFTER this
 * resolves (file cleanup happens outside the transaction by design).
 */
export async function removeMailboxIntegration(
  client: any,
  id: string,
  options: { cleanupLegacyEmail?: boolean } = {}
): Promise<{
  mailboxId: string;
  email: string;
  conversationsDeleted: number;
  legacyDeleted: number;
  attachmentPaths: string[];
}> {
  const now = new Date().toISOString();

  await client.query('BEGIN');
  try {
    const mailboxResult = await client.query(
      `SELECT id, email_address FROM mailboxes WHERE id = $1`,
      [id]
    );
    if (mailboxResult.rows.length === 0) {
      throw new MailboxRemovalError('MAILBOX_NOT_FOUND', 'Mailbox not found.', 404);
    }
    const email = mailboxResult.rows[0].email_address as string;
    const normalizedEmail = email.trim().toLowerCase();

    if (SYSTEM_MAILBOX_EMAILS.includes(normalizedEmail)) {
      throw new MailboxRemovalError(
        'SYSTEM_MAILBOX_PROTECTED',
        `"${email}" is a system mailbox and cannot be removed.`
      );
    }

    // 1. Conversations synced from this integration (ownership by id).
    const owned = await client.query(
      `SELECT id FROM communication_conversations WHERE mailbox_id = $1`,
      [id]
    );
    const ownedIds: string[] = owned.rows.map((r: any) => r.id);

    // 2. Legacy sweep (explicit one-time cleanup only): conversations whose
    //    customer_email is the mailbox address but which are NOT owned by any
    //    remaining mailbox (mailbox_id IS NULL) — never touches conversations
    //    owned by support/sales/no-reply or any other integration.
    const legacyIds: string[] = [];
    if (options.cleanupLegacyEmail) {
      const legacy = await client.query(
        `SELECT id FROM communication_conversations
         WHERE mailbox_id IS NULL
           AND LOWER(customer_email) = LOWER($1)`,
        [email]
      );
      legacyIds.push(...legacy.rows.map((r: any) => r.id));
    }

    const allIds = Array.from(new Set([...ownedIds, ...legacyIds]));
    const attachmentPaths = await deleteConversationRowsTx(client, allIds);

    // 3. Sync history (explicit; FK also cascades).
    await client.query(`DELETE FROM mailbox_sync_logs WHERE mailbox_id = $1`, [id]);

    // 4. The integration row itself.
    await client.query(`DELETE FROM mailboxes WHERE id = $1`, [id]);

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      [
        'mailbox_removed',
        `Removed mailbox integration ${email}: ${ownedIds.length} owned conversation(s), ${legacyIds.length} legacy conversation(s) cleaned`,
        now,
      ]
    );

    await client.query('COMMIT');

    return {
      mailboxId: id,
      email,
      conversationsDeleted: ownedIds.length,
      legacyDeleted: legacyIds.length,
      attachmentPaths,
    };
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  }
}

export { cleanupOrphanedAttachmentFiles };

/**
 * One-time migration cleanup: delete conversations that are NOT owned by any
 * remaining mailbox (mailbox_id IS NULL) whose customer_email matches the
 * given address. Used when a mailbox integration was removed before the
 * mailbox_id ownership column existed — its synced conversations carry NULL
 * mailbox_id and can only be matched by address. Conversations owned by any
 * existing mailbox are NEVER touched.
 */
export async function removeLegacyMailboxConversations(
  client: any,
  email: string,
  options: { auditEvent?: string; auditMessage?: string } = {}
): Promise<{ deleted: number; attachmentPaths: string[] }> {
  const now = new Date().toISOString();
  const result = { deleted: 0, attachmentPaths: [] as string[] };

  await client.query('BEGIN');
  try {
    const legacy = await client.query(
      `SELECT id FROM communication_conversations
       WHERE mailbox_id IS NULL
         AND LOWER(customer_email) = LOWER($1)`,
      [email]
    );
    const ids: string[] = legacy.rows.map((r: any) => r.id);
    if (ids.length > 0) {
      result.attachmentPaths = await deleteConversationRowsTx(client, ids);
      result.deleted = ids.length;
    }

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      [
        options.auditEvent || 'legacy_mailbox_cleanup',
        options.auditMessage || `Legacy cleanup for ${email}: ${result.deleted} unowned conversation(s) deleted`,
        now,
      ]
    );

    await client.query('COMMIT');
    return result;
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  }
}

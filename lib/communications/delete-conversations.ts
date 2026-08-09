import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Conversation deletion helpers (Mail Delete feature).
//
// Only the data that belongs EXCLUSIVELY to a conversation is removed:
//   - conversation_messages (FK-cascades conversation_attachments)
//   - message_queue rows bound to the conversation
//   - the communication_conversations row itself
//
// Shared/parent data is intentionally left intact:
//   - `requests` rows (Universal Request Center, shared infrastructure)
//   - `notification_logs` / `audit_logs` (system ledger, not conversation-scoped)
//   - `email_attachments` (outbound-send metadata bound to notification_logs)
//
// Attachment FILES are removed only AFTER the transaction commits and only
// when no remaining row in conversation_attachments OR email_attachments still
// references the same storage_path (shared files are never deleted).
// ---------------------------------------------------------------------------

/**
 * Resolve the `allow_email_deletion` toggle from the communication settings
 * document. Missing settings / missing table default to ENABLED so existing
 * behaviour is unchanged.
 */
export async function isEmailDeletionEnabled(client: any): Promise<boolean> {
  try {
    const tableCheck = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'system_settings') as exists`
    );
    if (!tableCheck.rows[0]?.exists) return true;

    const result = await client.query(
      `SELECT settings FROM system_settings ORDER BY id DESC LIMIT 1`
    );
    if (result.rows.length === 0) return true;

    const commSettings = result.rows[0].settings?.communications || {};
    return commSettings.allow_email_deletion !== false;
  } catch {
    return true;
  }
}

/**
 * Delete the rows of the given conversations WITHOUT opening a transaction.
 * Must be called inside an already-open transaction (BEGIN/COMMIT owned by
 * the caller). Removes conversation_messages (FK-cascades
 * conversation_attachments), message_queue rows and the conversation rows
 * themselves, and returns the storage paths of their attachment files so the
 * caller can clean files AFTER the transaction commits.
 */
export async function deleteConversationRowsTx(
  client: any,
  ids: string[]
): Promise<string[]> {
  if (!ids || ids.length === 0) return [];

  const filesResult = await client.query(
    `SELECT ca.storage_path
     FROM conversation_attachments ca
     JOIN conversation_messages cm ON cm.id = ca.message_id
     WHERE cm.conversation_id = ANY($1)
       AND ca.storage_path IS NOT NULL
       AND ca.storage_path <> ''`,
    [ids]
  );

  await client.query(
    `DELETE FROM conversation_messages WHERE conversation_id = ANY($1)`,
    [ids]
  );

  try {
    await client.query(
      `DELETE FROM message_queue WHERE conversation_id = ANY($1)`,
      [ids]
    );
  } catch (queueDeleteError: any) {
    console.warn('message_queue cleanup skipped:', queueDeleteError.message);
  }

  await client.query(
    `DELETE FROM communication_conversations WHERE id = ANY($1)`,
    [ids]
  );

  return filesResult.rows.map((r: any) => r.storage_path);
}

/**
 * Permanently delete conversations in ONE transaction. On any failure the
 * whole operation rolls back and the existing data is left unchanged.
 *
 * Returns the deleted ids plus the storage paths of their attachment files
 * (files are cleaned up by cleanupOrphanedAttachmentFiles AFTER commit).
 */
export async function permanentlyDeleteConversations(
  client: any,
  ids: string[]
): Promise<{ deleted: string[]; attachmentPaths: string[] }> {
  if (!ids || ids.length === 0) return { deleted: [], attachmentPaths: [] };

  const now = new Date().toISOString();
  await client.query('BEGIN');
  try {
    const attachmentPaths = await deleteConversationRowsTx(client, ids);

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      [
        'conversation_deleted',
        `Permanently deleted ${ids.length} conversation(s): ${ids.join(', ')}`,
        now,
      ]
    );

    await client.query('COMMIT');

    return { deleted: ids, attachmentPaths };
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  }
}

/**
 * Remove attachment files that are no longer referenced by ANY remaining
 * record (conversation_attachments or email_attachments). Shared files are
 * kept. Must be called after the transaction has committed.
 */
export async function cleanupOrphanedAttachmentFiles(client: any, filePaths: string[]) {
  const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)));
  for (const filePath of uniquePaths) {
    try {
      let remainingRefs = 0;
      try {
        const refs = await client.query(
          `SELECT (SELECT COUNT(*) FROM conversation_attachments WHERE storage_path = $1)
                + (SELECT COUNT(*) FROM email_attachments WHERE storage_path = $1) AS c`,
          [filePath]
        );
        remainingRefs = parseInt(refs.rows[0]?.c || '0', 10);
      } catch (refError: any) {
        // email_attachments may not exist on older databases — count only
        // conversation_attachments in that case.
        try {
          const refs = await client.query(
            `SELECT COUNT(*) AS c FROM conversation_attachments WHERE storage_path = $1`,
            [filePath]
          );
          remainingRefs = parseInt(refs.rows[0]?.c || '0', 10);
        } catch {
          remainingRefs = 1; // fail closed: keep the file when unknown
        }
      }

      if (remainingRefs === 0 && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        // Remove the now-empty conversation folder if nothing else uses it.
        const dir = path.dirname(filePath);
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
          try {
            fs.rmdirSync(dir);
          } catch {}
        }
      }
    } catch (fileError: any) {
      console.warn('Attachment file cleanup skipped:', fileError.message);
    }
  }
}

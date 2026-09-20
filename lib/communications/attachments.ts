// FILE: lib/communications/attachments.ts
// PURPOSE: Universal attachment service for the Internal API email/communications
//          system — the ONE place that stores and persists attachment bytes so
//          upload → send → store → retrieve → download works on ANY host.
//          Bytes are written to disk (best-effort) AND stored in PostgreSQL
//          (durable) so downloads keep working on serverless hosts like Vercel
//          where the runtime filesystem is read-only/ephemeral.
// NOTE: Server-only module (imports Node fs/path). Client components must use
//       ./attachment-policy instead; its validation is re-exported from here.

import fs from "fs";
import path from "path";
import {
  mimeForFile,
  sanitizeFileName,
  validateAttachmentFiles,
  type AttachmentFileInfo,
} from "./attachment-policy";

export interface StoredAttachment {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  content: Buffer;
  contentBase64: string;
}

export function getAttachmentStorageRoot(): string {
  return process.env.ATTACHMENT_STORAGE_PATH || path.join(process.cwd(), "public", "attachments", "email");
}

// Best-effort disk write. On serverless hosts the runtime filesystem is
// read-only/ephemeral, so the write is skipped and the bytes are served from
// the database instead — the email still works either way.
function writeDiskFile(storageRoot: string, uniqueName: string, buffer: Buffer): string {
  try {
    fs.mkdirSync(storageRoot, { recursive: true });
    const filePath = path.join(storageRoot, uniqueName);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (err) {
    console.warn("[attachments] disk write skipped:", (err as Error)?.message || err);
    return "";
  }
}

function buildStoredAttachment(originalName: string, browserType: string, buffer: Buffer, size: number): StoredAttachment {
  const fileName = sanitizeFileName(originalName);
  const mimeType = mimeForFile(originalName, browserType);
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${fileName}`;
  const storagePath = writeDiskFile(getAttachmentStorageRoot(), uniqueName, buffer);
  return {
    fileName,
    fileSize: size,
    mimeType,
    storagePath,
    content: buffer,
    contentBase64: buffer.toString("base64"),
  };
}

export async function storeUploadedFiles(files: File[]): Promise<StoredAttachment[]> {
  const stored: StoredAttachment[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    stored.push(buildStoredAttachment(file.name, file.type, buffer, file.size));
  }
  return stored;
}

// Incoming mail attachments (mailparser) — never extension-validated (the
// sender may attach anything), just sanitized + stored + persisted.
export function storeIncomingAttachment(att: {
  filename?: string;
  contentType?: string;
  content?: Buffer;
  size?: number;
}): StoredAttachment | null {
  const buffer = att.content;
  if (!buffer || buffer.length === 0) return null;
  const size = Number(att.size) || buffer.length;
  return buildStoredAttachment(att.filename || "attachment", att.contentType || "application/octet-stream", buffer, size);
}

// Standard mailer payload shape (Buffer content) for Nodemailer SMTP.
export function toNodemailerAttachments(stored: StoredAttachment[]): { filename: string; content: Buffer; contentType: string }[] {
  return stored.map((s) => ({ filename: s.fileName, content: s.content, contentType: s.mimeType }));
}

export const toMailAttachments = toNodemailerAttachments;

// Backwards-compatibility alias for legacy code
export function toBrevoAttachments(stored: StoredAttachment[]): { name: string; content: string; type?: string }[] {
  return stored.map((s) => ({ name: s.fileName, content: s.contentBase64, type: s.mimeType }));
}

export async function linkConversationAttachments(client: any, messageId: number, stored: StoredAttachment[]): Promise<void> {
  if (!messageId || !stored?.length) return;
  for (const s of stored) {
    await client.query(
      `INSERT INTO conversation_attachments (message_id, file_name, file_size, mime_type, storage_path, content)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [messageId, s.fileName, s.fileSize, s.mimeType, s.storagePath, s.content]
    );
  }
}

export async function linkEmailAttachments(
  client: any,
  notificationLogId: number | null,
  emailType: string,
  recipient: string,
  licenseKey: string | null,
  stored: StoredAttachment[]
): Promise<void> {
  if (!stored?.length) return;
  for (const s of stored) {
    await client.query(
      `INSERT INTO email_attachments (notification_log_id, email_type, recipient, license_key, file_name, file_size, mime_type, storage_path, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [notificationLogId, emailType, recipient, licenseKey, s.fileName, s.fileSize, s.mimeType, s.storagePath, s.content]
    );
  }
}

export interface ResolvedAttachment {
  fileName: string;
  mimeType: string;
  content: Buffer | null;
}

// Resolve attachment bytes by conversation_attachments id — from the DB
// content column, falling back to the on-disk file for legacy rows.
export async function resolveAttachmentById(client: any, id: string | number): Promise<ResolvedAttachment | null> {
  const r = await client.query(
    `SELECT file_name, mime_type, content, storage_path FROM conversation_attachments WHERE id = $1`,
    [id]
  );
  const row = r.rows[0];
  if (!row) return null;
  const mimeType = row.mime_type || "application/octet-stream";
  if (row.content) {
    return { fileName: row.file_name, mimeType, content: row.content };
  }
  if (row.storage_path) {
    try {
      const data = fs.readFileSync(row.storage_path);
      return { fileName: row.file_name, mimeType, content: data };
    } catch {
      /* file no longer on disk */
    }
  }
  return { fileName: row.file_name, mimeType, content: null };
}

export { validateAttachmentFiles };
export type { AttachmentFileInfo };
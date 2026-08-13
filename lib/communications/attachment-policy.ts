// FILE: lib/communications/attachment-policy.ts
// PURPOSE: Pure (Node-free) attachment policy shared by BOTH the client UI
//          (UniversalEmailDialog validation + accept list) and the server
//          routes (send/reply/sync). Single source of truth for allowed
//          attachment types, size and count limits.
// NOTE: No fs/path/process imports in this file so it is importable from
//       client components. The server-only storage service lives in
//       lib/communications/attachments.ts and re-exports the validation.

export const MAX_ATTACHMENT_COUNT = 5;
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB per file

// Canonical extension → MIME type map. Covers the supported email-safe types:
// PDF, TXT, DOC/DOCX, XLS/XLSX, CSV, PPT/PPTX, JPG/JPEG, PNG, GIF/WebP,
// ZIP/RAR/7z, JSON/XML/HTML/MD/RTF, ODF documents, images (SVG/TIFF/BMP),
// iCal/vCard.
const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  json: "application/json",
  xml: "text/xml",
  html: "text/html",
  htm: "text/html",
  md: "text/markdown",
  log: "text/plain",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  ics: "text/calendar",
  vcf: "text/vcard",
};

export const ALLOWED_EXTENSIONS: string[] = Object.keys(EXTENSION_MIME);

export const ATTACHMENT_ACCEPT: string = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export interface AttachmentFileInfo {
  name: string;
  size: number;
  type?: string;
}

export interface AttachmentValidationResult {
  ok: boolean;
  error?: string;
}

export function fileExtension(name: string): string {
  const i = (name || "").lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function mimeForFile(name: string, browserType?: string): string {
  const ext = fileExtension(name);
  if (ext && EXTENSION_MIME[ext]) return EXTENSION_MIME[ext];
  if (browserType && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(browserType)) return browserType;
  return "application/octet-stream";
}

export function sanitizeFileName(name: string): string {
  const cleaned = (name || "attachment")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 150);
  return cleaned || "attachment";
}

export function validateAttachmentFiles(files: AttachmentFileInfo[]): AttachmentValidationResult {
  if (!Array.isArray(files) || files.length === 0) return { ok: true };
  if (files.length > MAX_ATTACHMENT_COUNT) {
    return { ok: false, error: `A maximum of ${MAX_ATTACHMENT_COUNT} attachments are allowed.` };
  }
  for (const f of files) {
    const name = String(f.name || "").trim();
    if (!name) {
      return { ok: false, error: "Attachment files must have a name." };
    }
    if (Number(f.size) <= 0) {
      return { ok: false, error: `File "${name}" is empty.` };
    }
    if (Number(f.size) > MAX_ATTACHMENT_SIZE) {
      return { ok: false, error: `File "${name}" exceeds the 10MB size limit.` };
    }
    const ext = fileExtension(name);
    if (!ext || !EXTENSION_MIME[ext]) {
      return {
        ok: false,
        error: `File "${name}" has an unsupported type. Supported types: ${ALLOWED_EXTENSIONS.join(", ")}.`,
      };
    }
  }
  return { ok: true };
}
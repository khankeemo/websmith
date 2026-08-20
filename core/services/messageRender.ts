// Client-safe renderer for stored ticket message text (Query Inbox Messenger
// Chat + public secure Messenger Chat).
//
// Stored message bodies may contain `[label](url)` link tokens (e.g. the First
// Welcome template's Client Portal and Direct Secure Chat links). The label is
// rendered as a clickable link while the URL — which may carry the signed
// secure-chat JWT (`...?token=<jwt>`) — lives ONLY in the href and is never
// shown as visible text. Everything else is HTML-escaped, so raw markup or
// scripts can never be injected.
//
// This module is pure (no node:*, no bcrypt) so it can be used by any React UI.

const MESSAGE_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s()<>"']+)\)|(https?:\/\/[^\s()<>"']+)/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderMessageHtml(text: string): string {
  if (!text) return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (out.length) out.push("<br>");
    const parts: string[] = [];
    let last = 0;
    MESSAGE_LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MESSAGE_LINK_RE.exec(line)) !== null) {
      parts.push(escapeHtml(line.slice(last, match.index)));
      const url = match[2] || match[3];
      const label = match[1] !== undefined ? match[1] : url;
      parts.push(
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
      );
      last = match.index + match[0].length;
    }
    parts.push(escapeHtml(line.slice(last)));
    out.push(parts.join(""));
  }
  return out.join("");
}
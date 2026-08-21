// ============================================================================
// CANONICAL INBOUND EMAIL BODY CLEANER — Query Inbox Messenger Chat (R02)
//
// ONE pure normalizer for inbound customer email bodies, used at BOTH ends of
// the pipeline so server and client can never drift again:
//
//   1. SERVER (parsing/normalization source): `lib/tickets/inbound-core.ts`
//      re-exports this function and the bridge applies it when a processed
//      universal-email message is appended to a ticket (`messages[]`).
//   2. CLIENT (display mirror for rows stored before a fix existed):
//      `app/admin/messages/AdminMessagesClient.tsx` runs every client email
//      bubble through it at render time — stored data is never mutated.
//
// Contract: keep ONLY the client's own new words. Everything belonging to the
// quoted previous email is REMOVED from the returned text (never hidden with
// CSS): quote-intro lines ("On <date>, <name> <email> wrote:"), the quoted
// block after them, Outlook/Apple original-message separators, reply-header
// blocks and signatures.
//
// Pure module (zero imports, no node:* APIs) so any React UI or server route
// can use it directly.
// ============================================================================

// Reply-header style line ("From:", "Sent:", "To:", ...).
const HEADER_LINE_RE = /^(from|sent|to|cc|bcc|subject|date|reply-to|return-path|message-id|x-[a-z0-9-]+):/i;

// Quote-intro line. Matches every mainstream client shape:
//   Gmail:      On Fri, Aug 21, 2026 at 8:30 PM Websmith Support Team
//               <support@websmithdigital.com> wrote:
//   Apple Mail: On Aug 21, 2026, at 8:30 PM, Websmith Support Team wrote:
//   Plain text: On Fri, Aug 21, 2026 at 8:30 PM, support@websmithdigital.com
//               said:
// The angle brackets around the address are OPTIONAL — HTML→text conversion
// strips them (the address then reads like part of the name). The intro is a
// boundary UNCONDITIONALLY: real-world replies frequently have no blank line
// above it and no ">" markers below it, so requiring either (the old rule)
// leaked the whole quoted email into the chat.
const QUOTE_INTRO_RE = /^on\b.{0,300}\b(?:wrote|said)\s*:\s*$/i;

// Tail of a WRAPPED intro (some clients break the intro across two lines):
//   On Fri, Aug 21, 2026 at 8:30 PM Websmith Support Team
//   support@websmithdigital.com wrote:
const QUOTE_TAIL_RE = /^(?:.{0,300})?\b(?:wrote|said)\s*:\s*$/i;
const ON_START_RE = /^on\b.{0,300}$/i;

export function cleanInboundBody(text: string): string {
  let body = String(text || "");
  if (!body.trim()) return "";
  body = body.replace(/\r\n/g, "\n");
  const lines = body.split("\n");
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Quoted reply block (every line prefixed with ">").
    if (trimmed.startsWith(">")) {
      cut = i;
      break;
    }
    // Outlook / Apple Mail original-message separator.
    if (/^-----+\s*(original message|forwarded message|reply message|message)\s*-----+$/i.test(trimmed)) {
      cut = i;
      break;
    }
    // Mobile signatures ("Sent from my iPhone/Android/...").
    if (/^sent from (my )?(iphone|ipad|android|galaxy|blackberry|windows)/i.test(trimmed)) {
      cut = i;
      break;
    }
    // Signature separator ("-- ").
    if (trimmed === "--" || trimmed.startsWith("-- ")) {
      cut = i;
      break;
    }
    // Quote-intro line — ALWAYS a boundary, wherever it appears (this is the
    // same trimming rule every mail client applies to replies).
    if (QUOTE_INTRO_RE.test(trimmed)) {
      cut = i;
      break;
    }
    // Wrapped intro tail: THIS line ends with "wrote:"/"said:" and the line
    // right above starts the "On <date>" intro → cut at THAT line.
    if (QUOTE_TAIL_RE.test(trimmed) && i > 0 && ON_START_RE.test(lines[i - 1].trim())) {
      cut = i - 1;
      break;
    }
    // Reply-header block ("From: ... / Sent: ... / To: ..."). Detected as a RUN
    // of >= 2 consecutive header-style lines ANYWHERE (not only after a blank
    // line) so forwarded headers glued to the client's text are still stripped.
    if (
      HEADER_LINE_RE.test(trimmed) &&
      i + 1 < lines.length &&
      HEADER_LINE_RE.test(lines[i + 1].trim())
    ) {
      cut = i;
      break;
    }
  }
  return lines
    .slice(0, cut)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

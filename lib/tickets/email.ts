import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { type Db, ObjectId } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/mailer";
import { buildChatUrl } from "@/lib/tickets/chat";
import { buildClientPortalGreeting } from "@/core/services/clientPortalGreeting";


// ============================================================================
// RESOLUTION EMAIL + CLIENT PORTAL ONBOARDING (Public Website domain)
//
// Database-backed resolution email templates (MongoDB `resolution_templates`,
// the same WSD database that backs the public contact / query inbox flow) plus
// the secure client-account creation used by the "Send Resolution Email"
// onboarding action. All rendering helpers live here so the API routes stay
// thin and the templates are never hardcoded into frontend/React code.
//
// Admin/editor markers (-- Client Portal Greeting -- / -- End Client Portal
// Greeting --) are stripped from every customer-facing email copy here so they
// can never appear in a message sent to a customer.
// ============================================================================

export type ResolutionTemplate = {
  key: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  isActive: boolean;
  isDefault: boolean;
};

const COMPANY = "Websmith Digital";
const SIGN_OFF = "Best regards,\nThe Websmith Digital Team";

// ---------------------------------------------------------------------------
// Customer-facing REQUEST ID (WSD-XXXXXX)
//
// Every support request carries a short human reference instead of the internal
// MongoDB ObjectId. The id is generated at ticket creation (Get in Touch AND
// Client Portal), stored on the ticket document as `requestId`, and used as
// `{{request_id}}` in EVERY customer-facing email (welcome / reply /
// resolution / onboarding / resend). The alphabet excludes visually ambiguous
// characters (0/O, 1/I/L) so the id can be read back over the phone.
// ---------------------------------------------------------------------------
const REQUEST_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRequestId(): string {
  const bytes = crypto.randomBytes(6);
  let id = "";
  for (let i = 0; i < 6; i++) id += REQUEST_ID_ALPHABET[bytes[i] % REQUEST_ID_ALPHABET.length];
  return `WSD-${id}`;
}

/** Unique WSD-XXXXXX id for a new ticket — retries on the (rare) collision. */
export async function generateUniqueRequestId(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRequestId();
    const exists = await db.collection("tickets").findOne({ requestId: candidate }, { projection: { _id: 1 } });
    if (!exists) return candidate;
  }
  // Practically unreachable (31^6 space); fall back to a longer unique suffix.
  return `WSD-${crypto.randomBytes(9).toString("base64url").replace(/[-_]/g, "").slice(0, 9).toUpperCase()}`;
}

/**
 * The customer-facing request label for a ticket: the stored WSD-XXXXXX id when
 * present, otherwise the legacy ObjectId (pre-WSD tickets keep rendering their
 * existing references — no data migration).
 */
export function ticketRequestLabel(ticket: any): string {
  const stored = String(ticket?.requestId || "").trim();
  if (stored) return stored;
  return String(ticket?._id ?? "").toString();
}

// The FIRST / default welcome template used from the Query Inbox Reply Thread
// (Phase 3): professional, compact and easy to scan, customer identity dynamic,
// and it carries the decided client communication — Client Portal login link,
// the customer's login email and the direct secure Messenger Chat link for
// THIS conversation. The Portal + Chat links are written as `[label](url)`
// tokens so the shared HTML renderer turns them into clickable <a> links with
// the secure chat JWT hidden behind the link text (never displayed raw).
export const FIRST_WELCOME_TEMPLATE_KEY = "first-welcome";

// The default template is the professional, neutral onboarding message used for
// normal software/project inquiries. Each template is seeded into the database
// (never into React) and supports the dynamic variables below.
export const RESOLUTION_TEMPLATE_SEED: ResolutionTemplate[] = [
  {
    key: "first-welcome",
    name: "First Welcome Message",
    category: "Client Portal Onboarding",
    subject: "Thank You for Contacting Websmith Digital - {{request_id}}",
    body: `Websmith Digital Support

Hello {{client_name}},

Thank you for contacting Websmith Digital. We have successfully received your inquiry (Reference: {{request_id}}).

Our team has received your message regarding "{{query_subject}}" and is reviewing your requirements. We will connect with you during your preferred contact window.

If you are an existing customer or want to manage your account, licenses, or project updates, you can log in through your Client Portal:

Client Portal:
[Client Portal]({{portal_url}})

If you wish to continue the conversation immediately through our direct encrypted chat, use the link below:

{{#if chat_url}}Direct Secure Chat:
[Continue in Secure Chat]({{chat_url}})
{{/if}}
You can reach back anytime through your Client Portal or Direct Secure Chat.

${SIGN_OFF}`,
    isActive: true,
    isDefault: true,
  },
  {
    key: "client-portal-onboarding",
    name: "Client Portal Onboarding",
    category: "Client Portal Onboarding",
    subject: "Your Websmith Client Portal Access - {{request_id}}",
    body: `Hello {{client_name}},

Thank you for contacting ${COMPANY}. We are pleased to confirm that your request has reached the right team and has been reviewed.

{{resolution_summary}}

We have prepared access to your Websmith Client Portal so you can continue our conversation and follow your project in one place.

Client Portal:
{{portal_url}}

Login Email:
{{client_email}}

{{#if client_id}}Client ID:
{{client_id}}
{{/if}}{{#if temporary_password}}Temporary Password:
{{temporary_password}}

For your security, you will be required to create a new password when you first sign in. Please do not share your login credentials with anyone.{{/if}}{{#unless temporary_password}}If you already have a Websmith account, please sign in using your existing credentials. If you need a password reset, use the Forgot Password option on the login page.{{/unless}}

Once signed in, you can continue communication with our team and, where applicable, review your project information and current status.

{{#if project_name}}Your project ({{project_name}}) will show its current status and progress inside the portal.{{/if}}

We look forward to working with you.

${SIGN_OFF}`,
    isActive: true,
    isDefault: true,
  },
  {
    key: "new-project-discussion",
    name: "New Project Discussion",
    category: "New Project Discussion",
    subject: `Your New Project Discussion with ${COMPANY} - {{request_id}}`,
    body: `Hello {{client_name}},

Thank you for reaching out to ${COMPANY} about a new project. We have reviewed your requirements and are ready to take the next steps.

{{resolution_summary}}

To keep the discussion moving, we have set up a private space where you can follow our conversation and the project as it progresses.

Client Portal:
{{portal_url}}

Login Email:
{{client_email}}

{{#if temporary_password}}Temporary Password:
{{temporary_password}}

When you first sign in, you will be asked to create a permanent password for your account.{{/if}}{{#unless temporary_password}}Sign in with your existing Websmith account credentials.{{/unless}}

{{#if project_name}}The discussion for {{project_name}} is tracked in your portal.{{/if}}

We look forward to working with you.

${SIGN_OFF}`,
    isActive: true,
    isDefault: false,
  },
  {
    key: "software-development-inquiry",
    name: "Software Development Inquiry",
    category: "Software Development Inquiry",
    subject: "Your Software Development Inquiry - {{request_id}}",
    body: `Hello {{client_name}},

Thank you for your software development inquiry. Our team has reviewed the details you shared and is ready to help you build the right solution.

{{resolution_summary}}

We have prepared access to your Websmith Client Portal so you can follow our conversation and the progress of your software project.

Client Portal:
{{portal_url}}

Login Email:
{{client_email}}

{{#if temporary_password}}Temporary Password:
{{temporary_password}}

For your security, you will be required to create a new password when you first sign in.{{/if}}{{#unless temporary_password}}Sign in with your existing Websmith account credentials.{{/unless}}

{{#if project_name}}Your development project ({{project_name}}) can be tracked from the portal.{{/if}}

We look forward to building with you.

${SIGN_OFF}`,
    isActive: true,
    isDefault: false,
  },
  {
    key: "ai-agent-automation",
    name: "AI Agent / AI Automation",
    category: "AI Agent / AI Automation",
    subject: "Your AI / Automation Project - {{request_id}}",
    body: `Hello {{client_name}},

Thank you for your interest in AI and automation with ${COMPANY}. We have reviewed your inquiry and outlined the next steps below.

{{resolution_summary}}

To continue the conversation and track your AI project, we have prepared access to your Websmith Client Portal.

Client Portal:
{{portal_url}}

Login Email:
{{client_email}}

{{#if temporary_password}}Temporary Password:
{{temporary_password}}

A password change will be required on your first sign-in for your security.{{/if}}{{#unless temporary_password}}Use your existing Websmith account credentials to sign in.{{/unless}}

{{#if project_name}}Your AI project ({{project_name}}) will be visible in the portal as it progresses.{{/if}}

We look forward to helping you automate and grow.

${SIGN_OFF}`,
    isActive: true,
    isDefault: false,
  },
  {
    key: "billing-software",
    name: "Billing Software",
    category: "Billing Software",
    subject: "Your Billing Software Project - {{request_id}}",
    body: `Hello {{client_name}},

Thank you for your inquiry about billing software with ${COMPANY}. We have reviewed your requirements and are ready to move forward.

{{resolution_summary}}

We have set up access to your Websmith Client Portal so you can follow our conversation and the status of your billing project.

Client Portal:
{{portal_url}}

Login Email:
{{client_email}}

{{#if temporary_password}}Temporary Password:
{{temporary_password}}

For your security, you will need to create a new password on your first sign-in.{{/if}}{{#unless temporary_password}}Sign in with your existing Websmith account credentials.{{/unless}}

{{#if project_name}}Your billing project ({{project_name}}) can be tracked from the portal.{{/if}}

We look forward to working with you.

${SIGN_OFF}`,
    isActive: true,
    isDefault: false,
  },
  {
    key: "custom-software-development",
    name: "Custom Software Development",
    category: "Custom Software Development",
    subject: "Your Custom Software Project - {{request_id}}",
    body: `Hello {{client_name}},

Thank you for choosing ${COMPANY} for your custom software development. We have reviewed your requirements and are ready to begin the next phase.

{{resolution_summary}}

We have prepared access to your Websmith Client Portal where you can follow our conversation and your project as it develops.

Client Portal:
{{portal_url}}

Login Email:
{{client_email}}

{{#if temporary_password}}Temporary Password:
{{temporary_password}}

A permanent password will be required on your first sign-in for security.{{/if}}{{#unless temporary_password}}Use your existing Websmith account credentials to sign in.{{/unless}}

{{#if project_name}}Your custom software project ({{project_name}}) will show current status and progress in the portal.{{/if}}

We look forward to delivering with you.

${SIGN_OFF}`,
    isActive: true,
    isDefault: false,
  },
  {
    key: "website-web-application",
    name: "Website / Web Application",
    category: "Website / Web Application",
    subject: `Your Web Project with ${COMPANY} - {{request_id}}`,
    body: `Hello {{client_name}},

Thank you for your website / web application inquiry. Our team has reviewed your requirements and confirmed the next steps.

{{resolution_summary}}

We have prepared access to your Websmith Client Portal so you can follow our conversation and your web project in one place.

Client Portal:
{{portal_url}}

Login Email:
{{client_email}}

{{#if temporary_password}}Temporary Password:
{{temporary_password}}

You will be asked to create a permanent password when you first sign in.{{/if}}{{#unless temporary_password}}Sign in with your existing Websmith account credentials.{{/unless}}

{{#if project_name}}Your web project ({{project_name}}) will display its current status and progress in the portal.{{/if}}

We look forward to building with you.

${SIGN_OFF}`,
    isActive: true,
    isDefault: false,
  },
  {
    key: "mobile-application",
    name: "Mobile Application",
    category: "Mobile Application",
    subject: "Your Mobile App Project - {{request_id}}",
    body: `Hello {{client_name}},

Thank you for your mobile application inquiry with ${COMPANY}. We have reviewed your requirements and are ready to proceed.

{{resolution_summary}}

We have set up access to your Websmith Client Portal so you can follow our conversation and the status of your mobile app.

Client Portal:
{{portal_url}}

Login Email:
{{client_email}}

{{#if temporary_password}}Temporary Password:
{{temporary_password}}

For your security, a password change is required on your first sign-in.{{/if}}{{#unless temporary_password}}Use your existing Websmith account credentials to sign in.{{/unless}}

{{#if project_name}}Your mobile project ({{project_name}}) will be visible in the portal as it progresses.{{/if}}

We look forward to working with you.

${SIGN_OFF}`,
    isActive: true,
    isDefault: false,
  },
  {
    key: "api-integration",
    name: "API / Integration",
    category: "API / Integration",
    subject: "Your API / Integration Project - {{request_id}}",
    body: `Hello {{client_name}},

Thank you for your API / integration inquiry. Our team has reviewed the technical details and confirmed the next steps.

{{resolution_summary}}

We have prepared access to your Websmith Client Portal where you can follow our conversation and your integration project.

Client Portal:
{{portal_url}}

Login Email:
{{client_email}}

{{#if temporary_password}}Temporary Password:
{{temporary_password}}

A permanent password will be required on your first sign-in for security.{{/if}}{{#unless temporary_password}}Sign in with your existing Websmith account credentials.{{/unless}}

{{#if project_name}}Your integration project ({{project_name}}) can be tracked from the portal.{{/if}}

We look forward to integrating with you.

${SIGN_OFF}`,
    isActive: true,
    isDefault: false,
  },
  {
    key: "project-follow-up",
    name: "Project Follow-Up",
    category: "Project Follow-Up",
    subject: "Project Follow-Up - {{project_name}} - {{request_id}}",
    body: `Hello {{client_name}},

Thank you for your continued work with ${COMPANY}. We wanted to follow up on your recent inquiry and confirm where things stand.

{{resolution_summary}}

We have prepared access to your Websmith Client Portal so you can continue the conversation and check the latest status of your project.

Client Portal:
{{portal_url}}

Login Email:
{{client_email}}

{{#if temporary_password}}Temporary Password:
{{temporary_password}}

For your security, you will need to create a new password when you first sign in.{{/if}}{{#unless temporary_password}}Sign in with your existing Websmith account credentials.{{/unless}}

{{#if project_name}}Your project ({{project_name}}) will show its current status and progress inside the portal.{{/if}}

We look forward to the next steps.

${SIGN_OFF}`,
    isActive: true,
    isDefault: false,
  },
];

export async function ensureResolutionTemplates(db: Db): Promise<ResolutionTemplate[]> {
  const collection = db.collection("resolution_templates");
  const now = new Date();
  // Upsert by key so new seed templates (e.g. the First Welcome Message) are
  // added to existing databases WITHOUT overwriting admin edits to templates
  // that already exist ($setOnInsert only writes when the key is missing).
  await collection.bulkWrite(
    RESOLUTION_TEMPLATE_SEED.map((template) => ({
      updateOne: {
        filter: { key: template.key },
        update: { $setOnInsert: { ...template, createdAt: now, updatedAt: now } },
        upsert: true,
      },
    }))
  );
  // Heal legacy rows that were seeded (or edited) with the literal JS-style
  // `${COMPANY}` placeholder: it is NEVER a valid template token (templates
  // use `{{...}}`), so a stored row carrying it sends the raw literal to
  // customers (production subject "Welcome to ${COMPANY} - <ticket_id>").
  // The pure string replace keeps every other admin-edited value intact and
  // only touches rows that actually contain the broken placeholder.
  await collection.updateMany(
    {
      $or: [
        { subject: { $regex: /\$\{COMPANY\}/ } },
        { body: { $regex: /\$\{COMPANY\}/ } },
      ],
    },
    [
      {
        $set: {
          subject: { $replaceAll: { input: { $ifNull: ["$subject", ""] }, find: "${COMPANY}", replacement: COMPANY } },
          body: { $replaceAll: { input: { $ifNull: ["$body", ""] }, find: "${COMPANY}", replacement: COMPANY } },
        },
      },
    ]
  );
  // One-time content migration for the First Welcome Message: production rows
  // were seeded BEFORE the message structure was rewritten (short text + the
  // raw `[Continue Chat](...token=...)` link). `$setOnInsert` never touches an
  // existing row, so rows whose body lacks the canonical "Direct Secure Chat"
  // marker are re-seeded with the current subject + body exactly once (they
  // must contain the NEW structure; the marker check is self-terminating and
  // leaves any later admin edits untouched).
  const welcomeSeed = RESOLUTION_TEMPLATE_SEED.find((template) => template.key === "first-welcome");
  if (welcomeSeed) {
    await collection.updateOne(
      {
        key: "first-welcome",
        $or: [
          { subject: { $regex: /^Welcome to Websmith/ } },
          { body: { $not: { $regex: /successfully received/ } } },
        ],
      },
      { $set: { subject: welcomeSeed.subject, body: welcomeSeed.body, updatedAt: now } }
    );
  }
  return (await collection.find({}).sort({ name: 1 }).toArray()) as unknown as ResolutionTemplate[];
}

export function findDefaultTemplate(templates: ResolutionTemplate[]): ResolutionTemplate | null {
  return templates.find((template) => template.isDefault) || templates[0] || null;
}

// The dedicated template used by the "Send Client Portal Access" onboarding
// action (Phase 3 / Phase 6). It is the ONLY template that may carry initial
// client credentials; the resolution templates never do.
export const ONBOARDING_TEMPLATE_KEY = "client-portal-onboarding";

// Guarantees the Client ID is present in an onboarding email even when the
// database holds a legacy copy of the onboarding template that predates the
// `client_id` variable. Pure text; never runs markers through a template.
export function appendClientIdIfMissing(body: string, clientId: string): string {
  if (!clientId) return body;
  if (/client\s*id/i.test(body)) return body;
  return `${body}\n\nClient ID:\n${clientId}`.trim();
}

// Shared professional, marker-free Client Portal Greeting (Phase 5). The
// implementation lives in the client-safe module; re-exported here so server
// helpers and the admin UI share exactly one source.
export { buildClientPortalGreeting };

// -- Client Portal Greeting -- / -- End Client Portal Greeting -- are editor-only
// markers; they are removed from any customer-facing email copy.
const ADMIN_MARKER_RE = /^\s*--\s*(?:Client Portal Greeting|End Client Portal Greeting)\s*--\s*$/gm;

export function stripAdminMarkers(value: string): string {
  return value.replace(ADMIN_MARKER_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

// Block tokens: {{#if key}}...{{/if}} keeps the block when the value is
// non-empty; {{#unless key}}...{{/unless}} keeps it when empty. Used for
// optional credential / project-status lines so empty values never leak.
const BLOCK_RE = /\{\{#(if|unless) ([a-z_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

export function renderResolutionTemplate(
  template: { subject: string; body: string },
  data: Record<string, string>
): { subject: string; body: string } {
  const fill = (value: string) => {
    let out = value;
    out = out.replace(BLOCK_RE, (_match, kind: string, key: string, inner: string) => {
      const val = data[key] ?? "";
      const show = kind === "if" ? val !== "" : val === "";
      return show ? inner : "";
    });
    for (const [key, val] of Object.entries(data)) {
      out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val ?? "");
    }
    // Defensive: a literal `${COMPANY}` placeholder is never a valid template
    // token (the renderer only knows `{{...}}`), so it can never be sent to a
    // customer — always resolve it to the company name.
    out = out.replace(/\$\{COMPANY\}/g, data.company_name || COMPANY);
    return out;
  };
  return { subject: fill(template.subject), body: fill(template.body) };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================================================
// Customer-facing message rendering (Phase 7 fix)
//
// The customer's original Get in Touch message, the admin reply message and the
// resolution summary are stored as raw text (they may contain Markdown-style
// tables: `| a | b |` + `| :-: |` separator rows). Rendering that text straight
// into an HTML email body leaked the raw table markup (`| :-: |`, `| - |`) to
// customers. These pure helpers render the message text for emails:
//   - HTML: Markdown table blocks become real HTML tables; every other cell /
//     line is HTML-escaped so no raw markup or scripts can ever be sent.
//   - Plain: table separator rows (alignment rows) are dropped, everything else
//     is kept verbatim (plain text needs no escaping).
// Used by `support_reply` / `sales_reply` (lib/email/mailer.ts) and by
// `resolutionHtmlBody` so every customer-bound email renders cleanly.
// ============================================================================

// Separator (alignment) rows: `| - |`, `| :-: |`, `| :---: |`, `| --- |`.
// A cell is a separator when it contains only dashes with optional colons.
const TABLE_SEPARATOR_RE = /^:?-+:?$/;

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!isTableRow(trimmed)) return false;
  const cells = trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
  return cells.every((cell) => cell === "" || TABLE_SEPARATOR_RE.test(cell));
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function buildTableHtml(header: string[], body: string[][]): string {
  const head = header
    .map(
      (cell) =>
        `<th style="padding:8px 12px;text-align:left;font-size:13px;color:#1a1a2e;background:#f0f4ff;border-bottom:1px solid #e8ecf1">${escapeHtml(cell)}</th>`
    )
    .join("");
  const rows = body
    .map(
      (cells) =>
        `<tr>${cells
          .map(
            (cell) =>
              `<td style="padding:8px 12px;font-size:13px;color:#333;border-bottom:1px solid #eef2f7">${escapeHtml(cell)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0;border:1px solid #e8ecf1;border-radius:8px;overflow:hidden"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

// Renders customer message text (Markdown tables + paragraphs) as email HTML.
// Inline link handling for customer-facing email text:
//   - `[label](url)` tokens render as a clickable <a> whose visible text is the
//     label — the URL (and any signed JWT it carries) stays inside the href and
//     is never shown as raw text.
//   - Bare http(s) URLs render as clickable <a> links too.
// Only http/https schemes are accepted; labels are HTML-escaped so no markup
// can ever be injected. Used by renderCustomerMessageHtml for every
// customer-bound email (First Welcome, replies, resolution templates).
const EMAIL_INLINE_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s()<>"']+)\)|(https?:\/\/[^\s()<>"']+)/g;

function renderInlineEmailText(line: string): string {
  const out: string[] = [];
  let last = 0;
  EMAIL_INLINE_LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMAIL_INLINE_LINK_RE.exec(line)) !== null) {
    out.push(escapeHtml(line.slice(last, m.index)));
    const url = m[2] || m[3];
    const label = m[1] !== undefined ? m[1] : url;
    const href = escapeHtml(url).replace(/"/g, "&quot;");
    out.push(
      `<a href="${href}" style="color:#4a90d9;text-decoration:underline">${escapeHtml(label)}</a>`
    );
    last = m.index + m[0].length;
  }
  out.push(escapeHtml(line.slice(last)));
  return out.join("");
}

export function renderCustomerMessageHtml(text: string): string {
  if (!text) return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i])) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      const cleaned = rows.filter((cells) => !cells.every((cell) => cell === "" || TABLE_SEPARATOR_RE.test(cell)));
      out.push(buildTableHtml(cleaned[0] || [], cleaned.slice(1)));
      continue;
    }
    if (!lines[i].trim()) {
      i++;
      continue;
    }
    out.push(
      `<p style="margin:0 0 10px;font-size:14px;color:#333;line-height:1.7">${renderInlineEmailText(lines[i])}</p>`
    );
    i++;
  }
  return out.join("");
}

// Renders customer message text for plain-text emails: strips Markdown table
// separator (alignment) rows and unwraps `[label](url)` tokens into
// `label: url` so plain-text recipients still see a usable link without raw
// markdown; everything else stays verbatim. Token-bearing URLs (e.g. the
// signed secure-chat link `...?token=<jwt>`) are rendered as label ONLY —
// the sensitive URL is never exposed as visible plain-text.
export function renderCustomerMessagePlain(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s()<>"']+)\)/g,
      (_match, label: string, url: string) => (/[?&]token=/.test(url) ? label : `${label}: ${url}`)
    )
    .split("\n")
    .filter((line) => !isSeparatorRow(line))
    .join("\n")
    .trim();
}

export function resolutionHtmlBody(title: string, bodyText: string): string {
  const paragraphs = renderCustomerMessageHtml(bodyText);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">${COMPANY}</h1>
          <p style="margin:4px 0 0;color:#8899bb;font-size:13px">Client Portal</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600">${escapeHtml(title)}</h2>
          ${paragraphs}
        </td></tr>
        <tr><td style="background-color:#f8f9fb;padding:24px 32px;border-top:1px solid #e8ecf1">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="text-align:center;font-size:13px;color:#8899aa;line-height:1.6">
              <p style="margin:0 0 4px;font-weight:600;color:#555">${COMPANY} — Client Portal</p>
              <p style="margin:0 0 4px">Need help? Contact our support team at <a href="mailto:support@websmithdigital.com" style="color:#4a90d9;text-decoration:none">support@websmithdigital.com</a></p>
              <p style="margin:12px 0 0;font-size:11px;color:#aab">© ${new Date().getFullYear()} ${COMPANY}. All rights reserved.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type CreatedClientAccount = {
  _id: any;
  temporaryPassword: string;
  name: string;
  email: string;
  customId: string;
  password: string;
  role: string;
  isTemporaryPassword: boolean;
  isApproved: boolean;
  setupCompleted: boolean;
  status: string;
};

// ============================================================================
// TEMPORARY PASSWORD AT-REST ENCRYPTION (Phase 3 — Client Onboarding)
//
// A client account may be created automatically from a Get in Touch submission
// (no email sent yet). Its temporary password must therefore be retrievable
// later — by the "Send Credentials" email AND by the admin "Reveal Password"
// action — WITHOUT ever being stored in plaintext or leaked into logs, URLs,
// consoles or unnecessary API responses. The plaintext is encrypted with
// AES-256-GCM using a key derived from the existing JWT_SECRET (always present
// in production; no new env var) and stored on the user document as
// `temporaryPasswordEnc`. The bcrypt hash remains the authoritative password;
// the encrypted copy only exists to relay the initial one-time credential.
// ============================================================================

const SECRET_KEY_DOMAIN = "websmith:tickets:temporary-password";

function secretKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required for temporary-password encryption");
  return crypto.createHash("sha256").update(`${SECRET_KEY_DOMAIN}:${secret}`).digest();
}

/** Encrypt a one-time temporary password at rest (format `enc:iv:tag:data`). */
export function encryptTemporaryPassword(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Decrypt a stored temporary password. Returns "" on any malformed payload. */
export function decryptTemporaryPassword(payload: string): string {
  const parts = String(payload || "").split(":");
  if (parts[0] !== "enc" || parts.length !== 4) return "";
  try {
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const enc = Buffer.from(parts[3], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** Resolve a client account's stored temporary password ("" when none). */
export function resolveStoredTemporaryPassword(account: any): string {
  if (!account || !account.temporaryPasswordEnc) return "";
  return decryptTemporaryPassword(account.temporaryPasswordEnc);
}

// Secure one-off client account creation used by the resolution-email onboarding
// flow. Mirrors the existing client account contract (same `users` collection,
// same role/shape as the Admin Clients creation route): bcrypt hash stored,
// never the plaintext password; temporary password is returned exactly once.
export async function createClientAccount(
  db: Db,
  input: { name: string; email: string }
): Promise<CreatedClientAccount> {
  const temporaryPassword = crypto.randomBytes(12).toString("base64url");
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
  const last = await db
    .collection("users")
    .find({ customId: { $regex: /^CL-\d+$/ } })
    .sort({ customId: -1 })
    .limit(1)
    .toArray();
  const lastNumber = last.length > 0 ? parseInt(last[0].customId.replace("CL-", ""), 10) : 0;
  const customId = `CL-${String(lastNumber + 1).padStart(4, "0")}`;
  const now = new Date();
  const doc = {
    name: input.name,
    email: input.email.toLowerCase(),
    password: hashedPassword,
    role: "client",
    adminLevel: null,
    avatar: "",
    phone: "",
    company: "",
    address: "",
    preferences: { theme: "light", notifications: { email: true, push: true, projectUpdates: true, queryResponses: true } },
    provider: null,
    providerId: "",
    isOAuthUser: false,
    customId,
    isTemporaryPassword: true,
    isApproved: true,
    setupCompleted: true,
    published: false,
    status: "active",
    // Encrypted copy of the one-time temporary password so it can be relayed
    // later by the Send Credentials email / the admin Reveal Password action
    // WITHOUT ever being stored in plaintext or returned unnecessarily.
    temporaryPasswordEnc: encryptTemporaryPassword(temporaryPassword),
    createdAt: now,
    updatedAt: now,
    __v: 0,
  };
  const result = await db.collection("users").insertOne(doc);
  return { ...(doc as any), _id: result.insertedId, temporaryPassword };
}

/** Send the automatic First Welcome Message after a public submission.
 * Reuses the database-backed `first-welcome` template (seeded, never
 * overwritten) and the existing sendEmail pipeline — no new email provider,
 * no new sender identity. The secure chat link is generated server-side and
 * embedded as a real URL (the raw JWT token is never exposed in the message). */
export async function sendWelcomeEmail(
  db: any,
  client: any,
  input: {
    ticketId: string;
    requestId: string;
    contactName: string;
    contactEmail: string;
    subject: string;
    description: string;
    account: { customId?: string | null; _id: string };
    origin: string;
    createdAt: Date;
  }
) {
  const templates = await ensureResolutionTemplates(db);
  const template = templates.find((t) => t.key === FIRST_WELCOME_TEMPLATE_KEY) || findDefaultTemplate(templates);
  if (!template) return;

  const portalUrl = `${input.origin}/login`;
  const data: Record<string, string> = {
    client_name: input.contactName || "Valued Customer",
    client_email: input.contactEmail,
    client_id: String(input.account?.customId ?? ""),
    query_subject: input.subject,
    query_message: input.description,
    resolution_summary: "",
    portal_url: portalUrl,
    chat_url: buildChatUrl({ _id: input.ticketId, contactEmail: input.contactEmail, contactName: input.contactName }, input.origin),
    company_name: "Websmith Digital",
    request_id: input.requestId || ticketRequestLabel({ _id: input.ticketId }),
    query_status: "open",
  };

  const rendered = renderResolutionTemplate(template, data);
  const bodyText = stripAdminMarkers(rendered.body);
  const subject = stripAdminMarkers(rendered.subject) || `Thank You for Contacting Websmith Digital - ${input.requestId}`;

  const sendResult = await sendEmail(
    db,
    "welcome_customer",
    { email: input.contactEmail, name: input.contactName },
    data,
    {
      from: { email: "no-reply@websmithdigital.com", name: "Websmith Digital" },
      replyTo: "support@websmithdigital.com",
      custom: { subject, html: resolutionHtmlBody(subject, bodyText), plainText: renderCustomerMessagePlain(bodyText) },
    }
  );

  // Record outgoing Welcome message on ticket thread
  const now = new Date();
  try {
    const historyEntry = {
      action: "welcome_email",
      actorRole: "system",
      message: "First Welcome Message sent automatically after public submission.",
      templateKey: template.key,
      templateName: template.name,
      recipient: input.contactEmail,
      emailSubject: subject,
      emailBody: bodyText,
      emailDelivered: sendResult.success,
      emailError: sendResult.success ? undefined : sendResult.error,
      createdAt: now,
    };

    const welcomeMessage = {
      id: crypto.randomUUID(),
      senderType: "admin",
      direction: "outbound",
      senderEmail: "no-reply@websmithdigital.com",
      senderName: "Websmith Digital Support",
      recipientEmail: input.contactEmail,
      message: bodyText,
      createdAt: now,
      source: "welcome_email",
      deliveryStatus: sendResult.success ? "sent" : "failed",
      deliveryError: sendResult.success ? undefined : sendResult.error,
      providerMessageId: sendResult.messageId || undefined,
    };

    await db.collection("tickets").updateOne(
      { _id: new ObjectId(input.ticketId) },
      {
        $set: {
          welcomeSentAt: now,
          updatedAt: now,
          adminReadAt: now,
        },
        $push: {
          history: historyEntry,
          messages: welcomeMessage,
        } as any,
      }
    );
  } catch (threadErr) {
    console.error("[Tickets/Email] Failed to append welcome message to thread:", threadErr);
  }
}



import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Db } from "mongodb";
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

// The default template is the professional, neutral onboarding message used for
// normal software/project inquiries. Each template is seeded into the database
// (never into React) and supports the dynamic variables below.
export const RESOLUTION_TEMPLATE_SEED: ResolutionTemplate[] = [
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
    subject: "Your New Project Discussion with ${COMPANY} - {{request_id}}",
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
    subject: "Your Web Project with ${COMPANY} - {{request_id}}",
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
  const count = await collection.countDocuments({});
  if (count === 0) {
    const now = new Date();
    await collection.insertMany(
      RESOLUTION_TEMPLATE_SEED.map((template) => ({ ...template, createdAt: now, updatedAt: now }))
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

export function resolutionHtmlBody(title: string, bodyText: string): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.7">${escapeHtml(paragraph).replace(
          /\n/g,
          "<br/>"
        )}</p>`
    )
    .join("");
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
    createdAt: now,
    updatedAt: now,
    __v: 0,
  };
  const result = await db.collection("users").insertOne(doc);
  return { ...(doc as any), _id: result.insertedId, temporaryPassword };
}

import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/brevo";
import {
  ONBOARDING_TEMPLATE_KEY,
  appendClientIdIfMissing,
  createClientAccount,
  ensureResolutionTemplates,
  findDefaultTemplate,
  renderResolutionTemplate,
  resolutionHtmlBody,
  stripAdminMarkers,
} from "@/lib/tickets/email";

const DEFAULT_ORIGIN = "https://www.websmithdigital.com";

function normalizeOrigin(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^https?:\/\/[^\s/]+/i.test(raw)) return raw.replace(/\/+$/, "");
  return DEFAULT_ORIGIN;
}

// ============================================================================
// CLIENT ONBOARDING — "Send Client Portal Access" (Phase 3 + Phase 6)
//
// This is the dedicated business-onboarding action, kept SEPARATE from the
// Resolution Email (Phase 8). It is used once the deal / business relationship
// is confirmed and delivers the initial credentials: Client ID, login email,
// temporary password (new accounts only), Client Portal login URL and the
// first-login password-change instruction.
//
// Security invariants (Phase 3):
//   - temporary password is securely generated + bcrypt-hashed (createClientAccount)
//   - it is NEVER stored in the ticket/history and NEVER logged; it is returned
//     exactly once in the response so the admin can relay it if delivery fails
//   - an existing client's password is NEVER overwritten or regenerated
//   - onboarding is NEVER triggered by the public Get in Touch submission
// ============================================================================
export const POST = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const recipient = String(ticket.contactEmail || ticket.clientEmail || "").trim().toLowerCase();
  if (!recipient) {
    return json({ success: false, error: "No contact email on this ticket", message: "No contact email on this ticket" }, { status: 400 });
  }
  const clientName = String(ticket.contactName || "Valued Customer").trim();

  // 1. Resolve / create the client account. An existing client account is
  //    reused (never re-created, never its password changed). A new account is
  //    created with a secure, hashed temporary password.
  let account: any = await db.collection("users").findOne({ email: recipient, role: "client" });
  let accountState: "not_created" | "created" | "existing" = "not_created";
  let temporaryPassword: string | undefined;
  if (account) {
    accountState = "existing";
  } else {
    const created = await createClientAccount(db, { name: clientName, email: recipient });
    account = created;
    temporaryPassword = created.temporaryPassword;
    accountState = "created";
  }

  // 2. Render the dedicated onboarding template (database-backed) with real values.
  const templates = await ensureResolutionTemplates(db);
  const template =
    templates.find((t) => t.key === ONBOARDING_TEMPLATE_KEY) ||
    findDefaultTemplate(templates);
  if (!template || template.isActive === false) {
    return json({ success: false, error: "No active onboarding template is available", message: "No active onboarding template is available" }, { status: 400 });
  }

  let projectName = "";
  if (ticket.projectId && typeof ticket.projectId === "object" && (ticket.projectId as any).name) {
    projectName = String((ticket.projectId as any).name);
  }

  const origin = normalizeOrigin(body.portalUrl);
  const portalUrl = `${origin}/login`;
  const data: Record<string, string> = {
    client_name: clientName,
    client_email: recipient,
    client_id: String(account.customId ?? ""),
    project_name: projectName,
    query_subject: String(ticket.subject ?? ""),
    query_message: String(ticket.description ?? ""),
    resolution_summary: "",
    portal_url: portalUrl,
    temporary_password: temporaryPassword ?? "",
    company_name: "Websmith Digital",
    admin_name: String(user.name ?? "Websmith Team"),
    request_id: ticket._id.toString(),
    query_status: String(ticket.status ?? ""),
  };

  const rendered = renderResolutionTemplate(template, data);
  // Marker-free customer copy (Phase 5) + guaranteed Client ID (Phase 3).
  const bodyText = appendClientIdIfMissing(stripAdminMarkers(rendered.body), String(account.customId ?? ""));
  const subject = stripAdminMarkers(rendered.subject) || "Your Websmith Client Portal Access";

  // 3. Send via the existing email provider (honest delivery result).
  const sendResult = await sendEmail(
    db,
    "support_reply",
    { email: recipient, name: clientName },
    data,
    { custom: { subject, html: resolutionHtmlBody(subject, bodyText), plainText: bodyText } }
  );

  // 4. Persist delivery / action history + account relationship.
  const now = new Date();
  const history = ticket.history ?? [];
  history.push({
    action: "onboarding_email",
    actorRole: "admin",
    message: `Client Portal access sent using template "${template.name}".`,
    templateKey: template.key,
    templateName: template.name,
    accountState,
    accountId: account._id.toString(),
    clientCustomId: String(account.customId ?? ""),
    recipient,
    emailSubject: subject,
    emailBody: bodyText,
    emailDelivered: sendResult.success,
    emailError: sendResult.success ? undefined : sendResult.error,
    createdAt: now,
  });

  const update: any = {
    history,
    updatedAt: now,
    clientId: account._id.toString(),
    clientAccountSource: accountState,
    clientAccountEmail: recipient,
    clientCustomId: String(account.customId ?? ""),
    onboardingSentAt: now,
    lastEmailDelivered: sendResult.success,
    lastEmailError: sendResult.success ? null : (sendResult.error || "Email delivery failed"),
  };
  await db.collection("tickets").updateOne({ _id: id }, { $set: update });

  const accountResult: Record<string, any> = {
    accountState,
    createdAccount: accountState === "created",
    clientId: account._id.toString(),
    clientCustomId: String(account.customId ?? ""),
    ...(temporaryPassword ? { temporaryPassword } : {}),
  };

  if (!sendResult.success) {
    return json(
      {
        success: false,
        error: "Failed to send Client Portal access",
        message: "Failed to send Client Portal access",
        emailDelivered: false,
        emailError: sendResult.error,
        ...accountResult,
      },
      { status: 502 }
    );
  }
  return json({ message: "Client Portal access sent", emailDelivered: true, ...accountResult });
}, { auth: "required" });

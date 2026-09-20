import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId, ObjectId } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/mailer";
import { buildChatUrl } from "@/lib/tickets/chat";
import {
  ensureResolutionTemplates,
  findDefaultTemplate,
  renderResolutionTemplate,
  resolutionHtmlBody,
  stripAdminMarkers,
  ticketRequestLabel,
} from "@/lib/tickets/email";
import crypto from "node:crypto";

const DEFAULT_ORIGIN = "https://www.websmithdigital.com";

function normalizeOrigin(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^https?:\/\/[^\s/]+/i.test(raw)) return raw.replace(/\/+$/, "");
  return DEFAULT_ORIGIN;
}

// ============================================================================
// RESOLUTION EMAIL (Phase 7 + Phase 8)
//
// Final project-completion communication: Resolution Summary + Email Template +
// Client Account + Send Resolution Email. It communicates completion, the final
// outcome, a Client Portal reference and a professional closing.
//
// Strict separation (Phase 6 / Phase 8): the Resolution Email NEVER delivers
// initial client credentials and NEVER creates a client account. Initial
// credentials belong to the business onboarding stage ("Send Client Portal
// Access"). If the client already has a portal account, its Client ID is
// referenced; otherwise the email points to the portal without inventing
// credentials (the client can request access / use Forgot Password).
// ============================================================================
export const POST = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const resolution =
    String(body.resolution ?? "").trim() ||
    String(ticket.resolution ?? "").trim() ||
    String(ticket.description ?? "").trim();
  if (!resolution) {
    return json({ success: false, error: "A resolution message is required", message: "A resolution message is required" }, { status: 400 });
  }
  if (resolution.length > 20000) {
    return json({ success: false, error: "Resolution message is too long", message: "Resolution message is too long" }, { status: 400 });
  }

  const recipient = String(ticket.contactEmail || ticket.clientEmail || "").trim().toLowerCase();
  if (!recipient) {
    return json({ success: false, error: "No contact email on this ticket", message: "No contact email on this ticket" }, { status: 400 });
  }
  const clientName = String(ticket.contactName || "Valued Customer").trim();

  // 1. Template selection (database-backed; default when none specified).
  const templates = await ensureResolutionTemplates(db);
  const templateKey = String(body.templateKey ?? "").trim();
  const templateIdRaw = String(body.templateId ?? "").trim();
  let template =
    (templateKey ? templates.find((t) => t.key === templateKey) : null) ||
    (templateIdRaw ? templates.find((t) => String((t as any)._id) === templateIdRaw) : null) ||
    findDefaultTemplate(templates);
  if (!template) {
    return json({ success: false, error: "No resolution email template is available", message: "No resolution email template is available" }, { status: 400 });
  }
  if (template.isActive === false) {
    return json({ success: false, error: "The selected template is inactive", message: "The selected template is inactive" }, { status: 400 });
  }

  // 2. Client account reference (read-only). Never created here, never its
  //    credentials delivered in this email.
  const account: any = await db.collection("users").findOne({ email: recipient, role: "client" });
  const accountState = account ? (ticket.clientAccountSource === "created" ? "created" : "existing") : "not_created";

  // 3. Render the selected template with real values (no temporary password).
  let projectName = "";
  if (ticket.projectId && typeof ticket.projectId === "object" && (ticket.projectId as any).name) {
    projectName = String((ticket.projectId as any).name);
  } else if (typeof ticket.projectId === "string" && /^[0-9a-f]{24}$/i.test(ticket.projectId)) {
    const project = await db.collection("projects").findOne({ _id: new ObjectId(ticket.projectId) });
    if (project) projectName = String(project.name ?? "");
  }

  const origin = normalizeOrigin(body.portalUrl);
  const portalUrl = `${origin}/login`;
  const data: Record<string, string> = {
    client_name: clientName,
    client_email: recipient,
    client_id: String(account?.customId ?? ticket.clientCustomId ?? ""),
    project_name: projectName,
    query_subject: String(ticket.subject ?? ""),
    query_message: String(ticket.description ?? ""),
    resolution_summary: resolution,
    portal_url: portalUrl,
    chat_url: buildChatUrl(ticket, origin),
    temporary_password: "",
    company_name: "Websmith Digital",
    admin_name: String(user.name ?? "Websmith Team"),
    request_id: ticketRequestLabel(ticket),
    query_status: String(ticket.status ?? ""),
  };

  const rendered = renderResolutionTemplate(template, data);
  // Marker-free customer copy (Phase 5).
  const bodyText = stripAdminMarkers(rendered.body);
  const subject = stripAdminMarkers(rendered.subject) || "Your Websmith Client Portal Access";

  // 4. Send via the existing email provider (honest delivery result).
  const sendResult = await sendEmail(
    db,
    "support_reply",
    { email: recipient, name: clientName },
    data,
    { custom: { subject, html: resolutionHtmlBody(subject, bodyText), plainText: bodyText } }
  );

  // 5. Persist delivery / action history + canonical thread entry.
  const now = new Date();
  const history = ticket.history ?? [];
  history.push({
    action: "resolution_email",
    actorRole: "admin",
    message: `Resolution email sent using template "${template.name}": ${resolution}`,
    templateKey: template.key,
    templateName: template.name,
    accountState,
    accountId: account ? account._id.toString() : undefined,
    recipient,
    emailSubject: subject,
    emailBody: bodyText,
    emailDelivered: sendResult.success,
    emailError: sendResult.success ? undefined : sendResult.error,
    createdAt: now,
  });

  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  messages.push({
    id: crypto.randomUUID(),
    senderType: "admin",
    direction: "outbound",
    senderEmail: "",
    senderName: String(user.name ?? "Websmith Team"),
    recipientEmail: recipient,
    message: resolution,
    createdAt: now,
    source: "resolution_email",
    deliveryStatus: sendResult.success ? "sent" : "failed",
    deliveryError: sendResult.success ? undefined : sendResult.error,
    providerMessageId: sendResult.messageId || undefined,
  });

  const update: any = {
    resolution: ticket.resolution || resolution,
    history,
    messages,
    updatedAt: now,
    adminReadAt: now,
    lastEmailDelivered: sendResult.success,
    lastEmailError: sendResult.success ? null : (sendResult.error || "Email delivery failed"),
  };
  if (account) {
    update.clientId = account._id.toString();
    update.clientAccountSource = accountState;
    update.clientAccountEmail = recipient;
    update.clientCustomId = String(account.customId ?? ticket.clientCustomId ?? "");
  }
  await db.collection("tickets").updateOne({ _id: id }, { $set: update });

  const accountResult = {
    accountState,
    clientId: account ? account._id.toString() : ticket.clientId ?? null,
    clientCustomId: String(account?.customId ?? ticket.clientCustomId ?? ""),
  };

  if (!sendResult.success) {
    return json(
      {
        success: false,
        error: "Failed to send resolution email",
        message: "Failed to send resolution email",
        emailDelivered: false,
        emailError: sendResult.error,
        ...accountResult,
      },
      { status: 502 }
    );
  }
  return json({ message: "Resolution email sent", emailDelivered: true, ...accountResult });
}, { auth: "required" });

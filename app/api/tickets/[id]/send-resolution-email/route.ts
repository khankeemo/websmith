import { ObjectId } from "mongodb";
import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";
import { sendEmail } from "@/lib/email/brevo";
import {
  ensureResolutionTemplates,
  findDefaultTemplate,
  renderResolutionTemplate,
  resolutionHtmlBody,
  stripAdminMarkers,
  createClientAccount,
} from "@/lib/tickets/email";

const DEFAULT_ORIGIN = "https://www.websmithdigital.com";

function normalizeOrigin(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^https?:\/\/[^\s/]+/i.test(raw)) return raw.replace(/\/+$/, "");
  return DEFAULT_ORIGIN;
}

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

  // ------------------------------------------------------------------
  // 1. Template selection (database-backed; default when none specified)
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 2. Client account check (Phase 10: never duplicate / never overwrite)
  // ------------------------------------------------------------------
  let account: any = await db.collection("users").findOne({ email: recipient, role: "client" });
  let accountState: "not_created" | "created" | "existing" = "not_created";
  let temporaryPassword: string | undefined;
  const createAccount = body.createAccount === true;

  if (account) {
    accountState = "existing";
  } else if (createAccount) {
    const created = await createClientAccount(db, { name: clientName, email: recipient });
    account = created;
    temporaryPassword = created.temporaryPassword;
    accountState = "created";
  }

  // ------------------------------------------------------------------
  // 3. Render the selected template with real values
  // ------------------------------------------------------------------
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
    project_name: projectName,
    query_subject: String(ticket.subject ?? ""),
    query_message: String(ticket.description ?? ""),
    resolution_summary: resolution,
    portal_url: portalUrl,
    temporary_password: temporaryPassword ?? "",
    company_name: "Websmith Digital",
    admin_name: String(user.name ?? "Websmith Team"),
    request_id: ticket._id.toString(),
    query_status: String(ticket.status ?? ""),
  };

  const rendered = renderResolutionTemplate(template, data);
  const bodyText = stripAdminMarkers(rendered.body);
  const subject = stripAdminMarkers(rendered.subject) || "Your Websmith Client Portal Access";

  // ------------------------------------------------------------------
  // 4. Send via the existing email provider (honest delivery result)
  // ------------------------------------------------------------------
  const sendResult = await sendEmail(
    db,
    "support_reply",
    { email: recipient, name: clientName },
    data,
    {
      custom: {
        subject,
        html: resolutionHtmlBody(subject, bodyText),
        plainText: bodyText,
      },
    }
  );

  // ------------------------------------------------------------------
  // 5. Persist delivery / action history + account relationship
  // ------------------------------------------------------------------
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
    emailDelivered: sendResult.success,
    emailError: sendResult.success ? undefined : sendResult.error,
    createdAt: now,
  });

  const update: any = {
    resolution: ticket.resolution || resolution,
    history,
    updatedAt: now,
    lastEmailDelivered: sendResult.success,
    lastEmailError: sendResult.success ? null : (sendResult.error || "Email delivery failed"),
  };
  if (account) {
    update.clientId = account._id.toString();
    update.clientAccountSource = accountState === "created" ? "created" : "existing";
    update.clientAccountEmail = recipient;
  }
  await db.collection("tickets").updateOne({ _id: id }, { $set: update });

  const accountResult = {
    accountState,
    createdAccount: accountState === "created",
    clientId: account ? account._id.toString() : null,
    ...(temporaryPassword ? { temporaryPassword } : {}),
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

import { apiHandler, json, forbidden } from "@/lib/server/api";
import { ensureResolutionTemplates } from "@/lib/tickets/email";

export const GET = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();
  const templates = await ensureResolutionTemplates(db);
  const defaultKey = templates.find((template) => template.isDefault)?.key || templates[0]?.key || "";
  return json({
    data: templates.map((template) => ({
      key: template.key,
      name: template.name,
      category: template.category,
      subject: template.subject,
      body: template.body,
      isActive: template.isActive,
      isDefault: template.isDefault,
    })),
    defaultKey,
  });
}, { auth: "required" });

import { apiHandler, jsonBody, json, unauthorized, badRequest } from "@/lib/server/api";
import {
  DEFAULT_SITE_SETTINGS,
  CONTACT_FIELDS,
  SOCIAL_URL_FIELDS,
  normalizeSocialUrls,
  validateContactEmails,
  validateContactPhones,
  type SocialUrlKey,
} from "@/lib/site-settings";

const CONTACT_KEYS = Object.keys(CONTACT_FIELDS) as (keyof typeof CONTACT_FIELDS)[];

export const GET = apiHandler(async ({ db }) => {
  try {
    const settings = db.collection("settings");
    const doc = await settings.findOne({ key: "contact_info" });
    const data = { ...DEFAULT_SITE_SETTINGS, ...(doc?.value ?? {}) };
    return json({ data });
  } catch (error) {
    console.warn("Public contact info read warning (falling back to default site settings):", error instanceof Error ? error.message : error);
    return json({ data: DEFAULT_SITE_SETTINGS });
  }
});

const saveHandler = async ({ db, request, user }: any) => {
  if (!user) throw unauthorized();
  if (user.role !== "admin") throw unauthorized("Insufficient permissions");
  const body = await jsonBody(request);
  const value = body?.value && typeof body.value === "object" ? body.value : body;

  const saved: Record<string, string> = {};
  for (const field of CONTACT_KEYS) {
    saved[field] = String(value[field] ?? "").trim();
  }

  const { value: socials, errors } = normalizeSocialUrls(value);
  const errorFields = Object.keys(errors);
  if (errorFields.length > 0) {
    const details = errorFields
      .map((key) => `${SOCIAL_URL_FIELDS[key as SocialUrlKey]}: ${errors[key as SocialUrlKey]}`)
      .join("; ");
    throw badRequest(`Invalid social media link(s). ${details}`);
  }
  for (const key of Object.keys(socials) as SocialUrlKey[]) {
    saved[key] = socials[key] ?? "";
  }

  const emailErrors = validateContactEmails(value);
  const emailErrorFields = Object.keys(emailErrors);
  if (emailErrorFields.length > 0) {
    const details = emailErrorFields.map((key) => emailErrors[key as keyof typeof emailErrors]).join("; ");
    throw badRequest(`Invalid contact email address(es). ${details}`);
  }

  const phoneErrors = validateContactPhones(value);
  const phoneErrorFields = Object.keys(phoneErrors);
  if (phoneErrorFields.length > 0) {
    const details = phoneErrorFields.map((key) => phoneErrors[key as keyof typeof phoneErrors]).join("; ");
    throw badRequest(`Invalid phone number(s). ${details}`);
  }

  await db.collection("settings").updateOne(
    { key: "contact_info" },
    { $set: { key: "contact_info", value: saved, updatedAt: new Date() } },
    { upsert: true }
  );
  return json({ data: saved });
};

export const PUT = apiHandler(saveHandler, { auth: "required" });
export const PATCH = apiHandler(saveHandler, { auth: "required" });

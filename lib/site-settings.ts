// Public Website Contact & Social Media settings — shared pure helpers.
// Used by the admin Manage Page (client), the public website (client), and the
// /api/settings/public/contact_info route (server). No React dependency here so
// it is safe to import from API route handlers.

export type SocialUrlKey =
  | "whatsapp_url"
  | "facebook_url"
  | "instagram_url"
  | "linkedin_url"
  | "x_url"
  | "youtube_url";

export const CONTACT_FIELDS = {
  headquarters: "",
  email: "",
  sales_email: "",
  no_reply_email: "",
  hr_email: "",
  phone: "",
  mobile_number: "",
  landline_number: "",
} as const;

export const SOCIAL_URL_FIELDS: Record<SocialUrlKey, string> = {
  whatsapp_url: "WhatsApp",
  facebook_url: "Facebook",
  instagram_url: "Instagram",
  linkedin_url: "LinkedIn",
  x_url: "X (Twitter)",
  youtube_url: "YouTube",
};

export const DEFAULT_SOCIAL_URLS: Record<SocialUrlKey, string> = {
  whatsapp_url: "",
  facebook_url: "",
  instagram_url: "",
  linkedin_url: "",
  x_url: "",
  youtube_url: "",
};

export type SiteSettings = typeof CONTACT_FIELDS & typeof DEFAULT_SOCIAL_URLS;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  ...CONTACT_FIELDS,
  ...DEFAULT_SOCIAL_URLS,
};

const ALLOWED_HOSTS: Record<SocialUrlKey, string[]> = {
  whatsapp_url: ["wa.me"],
  facebook_url: ["facebook.com"],
  instagram_url: ["instagram.com"],
  linkedin_url: ["linkedin.com"],
  x_url: ["x.com", "twitter.com"],
  youtube_url: ["youtube.com"],
};

export const PLACEHOLDER_URLS: Record<SocialUrlKey, string> = {
  whatsapp_url: "https://wa.me/919876543210",
  facebook_url: "https://facebook.com/websmith",
  instagram_url: "https://instagram.com/websmith",
  linkedin_url: "https://linkedin.com/company/websmith",
  x_url: "https://x.com/websmith",
  youtube_url: "https://youtube.com/@websmith",
};

const urlError = (key: SocialUrlKey, reason?: string) => {
  const base = `Enter a valid ${SOCIAL_URL_FIELDS[key]} URL (${PLACEHOLDER_URLS[key]})`;
  return reason ? `${base}. ${reason}` : base;
};

export type NormalizeResult = { value: string; error: string | null };

export function normalizeSocialUrl(key: SocialUrlKey, raw: unknown): NormalizeResult {
  const input = String(raw ?? "").trim();
  if (!input) return { value: "", error: null };

  if (key === "whatsapp_url") {
    const waMatch = input.match(/^https?:\/\/wa\.me\/([\d\-\s()+]+)\/?$/i);
    if (waMatch) {
      const digits = waMatch[1].replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 15) {
        return { value: `https://wa.me/${digits}`, error: null };
      }
      return { value: "", error: urlError(key, "The number must be 7-15 digits.") };
    }
    const digits = input.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) {
      return { value: `https://wa.me/${digits}`, error: null };
    }
    return {
      value: "",
      error: urlError(key, "Enter https://wa.me/<number> or just the number (e.g. 919876543210)."),
    };
  }

  let candidate = input;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { value: "", error: urlError(key) };
  }

  if (parsed.protocol !== "https:") {
    return { value: "", error: urlError(key, "The link must use https://.") };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const hosts = ALLOWED_HOSTS[key];
  if (!hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    return { value: "", error: urlError(key) };
  }

  return { value: parsed.toString(), error: null };
}

export function normalizeSocialUrls(
  value: Record<string, unknown>
): { value: Partial<Record<SocialUrlKey, string>>; errors: Partial<Record<SocialUrlKey, string>> } {
  const normalized: Partial<Record<SocialUrlKey, string>> = {};
  const errors: Partial<Record<SocialUrlKey, string>> = {};
  for (const key of Object.keys(SOCIAL_URL_FIELDS) as SocialUrlKey[]) {
    const result = normalizeSocialUrl(key, value[key]);
    normalized[key] = result.value;
    if (result.error) errors[key] = result.error;
  }
  return { value: normalized, errors };
}

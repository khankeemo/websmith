const DEFAULT_SITE_URL = "https://websmithdigital.com";

export function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_SITE_URL;

  return siteUrl.replace(/\/$/, "");
}

const DEV_SSR_FALLBACK = "http://localhost:3000";

export function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const host = typeof window !== 'undefined' ? window.location.origin : '';
  return (siteUrl || host || DEV_SSR_FALLBACK).replace(/\/$/, "");
}
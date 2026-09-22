/**
 * core/constants/routes.ts
 *
 * Centralized public route configuration.
 * Used by:
 * - ClientLayout.tsx
 * - Auth Guards
 * - Middleware
 * - Public Site Navigation
 */

export const PUBLIC_PATHS = [
  "/",

  // Authentication
  "/login",
  "/register",
  "/forgot-password",
  "/forgotpassword",
  "/reset-password",
  "/resetpassword",
  "/auth/callback",
  "/auth/change-password",

  // Public Pages
  "/services",
  "/industries",
  "/portfolio",
  "/lead-form",
  "/success",
  "/about",
  "/careers",
  "/blog",
  "/documentation",
  "/support",
  "/contact",
  "/software-store",
  "/privacy",
  "/terms",
  "/license",
  "/unsubscribe_global",
] as const;

/**
 * Exact route matching
 */
export const PUBLIC_EXACT_ROUTES = [
  "/",

  // Authentication
  "/login",
  "/register",
  "/forgot-password",
  "/forgotpassword",
  "/reset-password",
  "/resetpassword",
  "/auth/callback",
  "/auth/change-password",

  // Public Pages
  "/services",
  "/industries",
  "/portfolio",
  "/lead-form",
  "/success",
  "/about",
  "/careers",
  "/blog",
  "/documentation",
  "/support",
  "/contact",
  "/software-store",
  "/privacy",
  "/terms",
  "/license",
  "/unsubscribe_global",
] as const;

/**
 * Prefix route matching
 *
 * Example:
 * /blog/my-post
 * /blog/nextjs-guide
 */
export const PUBLIC_ROUTE_PREFIXES = [
  "/blog/",
  "/industries/",
  // Standalone checkout — must never render inside the dashboard shell.
  // This covers /software-store/checkout and its /success|/failed|/pending subpages.
  "/software-store/checkout",
  // Focused product details — must never render inside the dashboard shell
  // and must never show the website marketing header. Covers
  // /software-store/product/[id].
  "/software-store/product",
  // Secure Public Client Messenger Chat — a customer opens their OWN
  // conversation directly from their secure link (/chat/<ticketId>?token=…).
  // Public so the session proxy never gates it; every data call is verified
  // against the signed token server-side.
  "/chat",
] as const;

/**
 * Determines whether a route is public.
 */
export function isPublicRoute(pathname: string): boolean {
  if (!pathname) return false;

  // Normalize: lowercase and remove trailing slashes for robust matching
  const normalized = pathname.toLowerCase().replace(/\/+$/, "") || "/";

  return (
    PUBLIC_EXACT_ROUTES.includes(
      normalized as (typeof PUBLIC_EXACT_ROUTES)[number]
    ) ||
    PUBLIC_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

/**
 * Alias for backward compatibility
 * Some files may import isPublicPath instead of isPublicRoute
 */
export const isPublicPath = isPublicRoute;

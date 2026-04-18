export const PUBLIC_EXACT_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/auth/callback",
  "/auth/change-password",
  "/services",
  "/lead-form",
  "/success",
  "/about",
  "/careers",
  "/blog",
  "/documentation",
  "/support",
  "/contact",
  "/privacy",
  "/terms",
] as const;

export const PUBLIC_ROUTE_PREFIXES = [
  "/blog/",
] as const;

export function isPublicRoute(pathname: string) {
  return (
    PUBLIC_EXACT_ROUTES.includes(pathname as (typeof PUBLIC_EXACT_ROUTES)[number]) ||
    PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

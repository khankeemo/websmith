import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isPublicRoute } from "./core/constants/routes";

const PUBLIC_PATHS = [
  // "Please Login First" entry guard — always renderable (links to /login)
  "/internal/api/auth/please-login",
  // Internal API auth pages AFTER a valid website session (login is gated
  // separately below; register/forgot/reset stay public like before)
  "/internal/api/auth/register",
  "/internal/api/auth/forgot-password",
  "/internal/api/auth/reset-password",
  "/internal/backend/api/auth/login",
  "/internal/backend/api/auth/register",
  "/internal/backend/api/auth/logout",
  "/internal/backend/api/auth/verify",
  "/internal/backend/api/auth/verify-otp",
  "/internal/backend/api/auth/forgot-password",
  "/internal/backend/api/auth/reset-password",
  // Universal Buy & Renew Portal — standalone customer pages, NO admin login gate
  "/internal/api/buy",
  "/internal/api/renew",
  // Unsubscribe page — public standalone page reachable from email footer links
  "/unsubscribe_global",
  // Health + public storefront/SDK-facing endpoints
  "/internal/backend/health",
  // QStash-signed system callback: the native inbound receive adapter is
  // invoked ONLY by the QStash cron (signed with Upstash-Signature, verified
  // inside the route via verifySignatureAppRouter) — never by browsers, so it
  // must pass the session proxy but stays cryptographically gated.
  "/internal/backend/communications/native-receive",
  "/internal/backend/store",
  "/internal/backend/store/products",
  "/internal/backend/license/status",
  "/internal/backend/licenses/validate",
  "/internal/backend/licenses/activate",
  "/internal/backend/licenses/deactivate",
  "/internal/backend/licenses/reactivation",
  "/internal/backend/licenses/reactivation/submit",
  "/internal/backend/trials/start",
  "/internal/backend/trials/status",
  "/internal/backend/trials/analyze",
  "/internal/backend/trials/convert",
  "/internal/backend/trials/journey",
  "/internal/backend/trials/register",
  "/internal/backend/trials/suspicious",
];

const isPublicPath = (pathname: string): boolean => {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
};

const getBearerToken = (request: NextRequest): string | null => {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token && token !== "null" && token !== "undefined") return token;
  }
  const cookieToken = request.cookies.get("api_center_token")?.value;
  if (cookieToken) return cookieToken;
  return null;
};

const isBackendApiRequest = (pathname: string): boolean => {
  return pathname.startsWith("/internal/backend");
};

// A valid WEBSITE login session (mirrored into the ws_session cookie by
// lib/auth.ts setAuthSession; verified with JWT_SECRET). The Internal API
// login page is ONLY reachable after this check passes.
const hasValidWebsiteSession = async (request: NextRequest): Promise<boolean> => {
  const cookieValue = request.cookies.get("ws_session")?.value;
  if (!cookieValue) return false;
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    let token = cookieValue;
    try {
      token = decodeURIComponent(cookieValue);
    } catch {
      /* keep raw value */
    }
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return Boolean(payload && (payload.sub || payload.email));
  } catch {
    return false;
  }
};

const pleaseLoginFirstResponse = (request: NextRequest): NextResponse => {
  if (isBackendApiRequest(request.nextUrl.pathname)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Please login" },
      { status: 401 }
    );
  }
  const pleaseUrl = new URL("/internal/api/auth/please-login", request.url);
  pleaseUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(pleaseUrl);
};

// Main-website protected pages (non-internal) reuse the existing website
// login with its established "session expired" message (same redirect the
// apiService 401 interceptor already uses: /login?reason=session-expired).
const sessionExpiredResponse = (request: NextRequest): NextResponse => {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("reason", "session-expired");
  return NextResponse.redirect(loginUrl);
};

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // Backend /api/* routes (website API) enforce their own server-side auth
  // (each route verifies the website JWT). The matcher also excludes them;
  // this guard is defense-in-depth so API calls are never caught by the page
  // session gate below.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Static assets / Next.js internals — also excluded by the matcher; kept as
  // a guard so CSS/JS/images/robots/sitemap can never be redirected to login.
  if (pathname.startsWith("/_next/") || /\.\w+$/.test(pathname)) {
    return NextResponse.next();
  }

  // The Internal API login page is the SECOND step: it must never render
  // without a valid WEBSITE login first. Without one → "Please Login First".
  if (pathname === "/internal/api/auth/login") {
    if (await hasValidWebsiteSession(request)) {
      return NextResponse.next();
    }
    return pleaseLoginFirstResponse(request);
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // The public contact form POSTs sales enquiries to store/enquiries; the
  // GET (admin listing) stays behind the auth gate. Method-split here so the
  // public page keeps working without exposing the admin list.
  if (
    request.method === "POST" &&
    pathname === "/internal/backend/store/enquiries"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/internal/")) {
    const token = getBearerToken(request);

    if (!token) {
      // Step 2 continues: a user with a valid WEBSITE session but no Internal
      // API session is sent to the Internal API login (already gated by the
      // website-session check above). Without a website session → Please
      // Login First so they start at /login.
      if (await hasValidWebsiteSession(request)) {
        const loginUrl = new URL("/internal/api/auth/login", request.url);
        loginUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(loginUrl);
      }
      return pleaseLoginFirstResponse(request);
    }

    const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;
    if (!JWT_SECRET) {
      return pleaseLoginFirstResponse(request);
    }

    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);

      const response = NextResponse.next();
      response.headers.set("x-api-center-user-id", String(payload.id || ""));
      response.headers.set("x-api-center-user-email", String(payload.email || ""));
      response.headers.set("x-api-center-user-role", String(payload.role || "user"));
      response.headers.set("x-api-center-user-name", String(payload.name || ""));

      return response;
    } catch {
      const response = pleaseLoginFirstResponse(request);
      response.cookies.delete("api_center_token");
      return response;
    }
  }

  // Main-website protected pages: anything NOT on the centralized public
  // route allow-list (core/constants/routes.ts isPublicRoute) requires a
  // valid WEBSITE session (ws_session cookie — the mirrored JWT verified
  // against JWT_SECRET). This runs before the page/RSC content is served, so
  // direct URL access never exposes protected pages or their data.
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (await hasValidWebsiteSession(request)) {
    return NextResponse.next();
  }

  return sessionExpiredResponse(request);
}

export const config = {
  matcher: [
    "/internal/:path*",
    // Everything else that is not a static asset or Next.js/API internal
    // (negative-lookahead pattern documented for Next.js proxy/middleware).
    // Public website pages pass through via the allow-list above; protected
    // pages (admin/client/developer/dashboard/...) are gated server-side.
    "/((?!api|_next|images|videos|fonts|favicon|robots|sitemap|.*\\..*).*)",
  ],
};

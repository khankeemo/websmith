import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = [
  "/internal/api/auth/login",
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
  "/internal/backend/health",
  "/internal/backend/store",
  "/internal/backend/store/products",
  "/internal/backend/store/enquiries",
  "/internal/backend/licenses/validate",
  "/internal/backend/licenses/activate",
  "/internal/backend/licenses/deactivate",
  "/internal/backend/trials/start",
  "/internal/backend/trials/status",
  "/internal/backend/trials/analyze",
  "/internal/backend/trials/convert",
  "/internal/backend/trials/journey",
  "/internal/backend/trials/register",
  "/internal/backend/trials/suspicious",
  "/internal/backend/admin/trials",
  "/internal/backend/admin/trials/trial-templates",
  "/internal/backend/test-sms",
  "/internal/backend/admin/cleanup",
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

const isApiRequest = (pathname: string): boolean => {
  return pathname.startsWith("/internal/backend") || pathname.startsWith("/internal/api");
};

const unauthorizedResponse = (request: NextRequest): NextResponse => {
  if (isApiRequest(request.nextUrl.pathname)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Please login" },
      { status: 401 }
    );
  }
  const loginUrl = new URL("/internal/api/auth/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
};

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/internal/")) {
    const token = getBearerToken(request);

    if (!token) {
      return unauthorizedResponse(request);
    }

    const JWT_SECRET = process.env.API_CENTER_JWT_SECRET;
    if (!JWT_SECRET) {
      return unauthorizedResponse(request);
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
      const response = unauthorizedResponse(request);
      response.cookies.delete("api_center_token");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/internal/:path*"],
};

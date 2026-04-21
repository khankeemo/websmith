import axios from "axios";
import { clearAuthSession, getToken, isPublicPath } from "../../lib/auth";

/**
 * Local development should prefer Next.js rewrites so the browser hits the
 * local Express API (`/api/*` -> backendUrl in next.config.ts).
 * Hosted environments can still use NEXT_PUBLIC_API_URL when provided.
 * Server-side: call the API process directly.
 */
const getApiBaseUrl = () => {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
    const isPrivateIpv4 =
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    // In local development, prefer the same-origin Next.js rewrite so browser
    // requests always hit the paired local Express server even over LAN IPs.
    if (process.env.NODE_ENV === "development" || isLocalhost || isPrivateIpv4) {
      return `${origin}/api`;
    }
    return "https://wsdserver.vercel.app/api";
  }

  return process.env.API_URL_INTERNAL || "http://127.0.0.1:5000/api";
};

const API = axios.create();

const isAuthSessionFailure = (error: any) => {
  const status = error.response?.status;
  if (status !== 401) {
    return false;
  }

  const code = error.response?.data?.code;
  const message = String(error.response?.data?.message || "").toLowerCase();
  const sessionFailureCodes = new Set([
    "AUTH_TOKEN_MISSING",
    "AUTH_TOKEN_INVALID",
    "AUTH_TOKEN_EXPIRED",
    "AUTH_USER_NOT_FOUND",
  ]);

  if (typeof code === "string" && sessionFailureCodes.has(code)) {
    return true;
  }

  return (
    message.includes("token") ||
    message.includes("session") ||
    message.includes("authorization denied") ||
    message.includes("please login again")
  );
};

// attach token automatically
API.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAuthSessionFailure(error) && typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      const requestUrl = error.config?.url || "";
      
      // Determine if this is a "public" page or request that should NOT trigger a login redirect
      const isPublicPage = isPublicPath(currentPath);
      const isPublicRequest = 
        requestUrl.includes("/auth/login") || 
        requestUrl.includes("/auth/forgot-password") || 
        requestUrl.includes("/auth/reset-password") ||
        requestUrl.includes("/auth/register");

      if (isPublicPage || isPublicRequest) {
        // Silently bypass for public routes to keep console clean
        return Promise.reject(error);
      }

      // Legitimate session expiration on protected route
      clearAuthSession();
      window.location.replace("/login?reason=session-expired");
    }

    return Promise.reject(error);
  }
);


export default API;


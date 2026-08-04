// FILE: D:\websmith\core\services\apiService.ts
// PURPOSE: Central API Service for ALL Websmith API calls
// ============================================
// CONNECTION STRATEGY:
// ============================================
// 
// 🟢 MAIN WEBSITE API
//    - Handles: Clients, Projects, Invoices, Messages, Tasks, Team, Auth
//    - URL: configured via NEXT_PUBLIC_API_URL
//
// 🔵 LICENSE API
//    - Handles: Licenses, Products, Hardware, Trials, Dashboard
//    - All license endpoints use /internal/api/ prefix
//
// ============================================
// Last Updated: June 4, 2026
// ✅ Main website API: UNCHANGED (still works)
// ✅ License API: NOW CONNECTED to Render
// ============================================

import axios from "axios";
import { clearAuthSession, getToken, isPublicPath } from "../../lib/auth";

// ============================================
// 🟢 MAIN WEBSITE API CONFIGURATION (UNCHANGED)
// ============================================
// This handles ALL non-license API calls (clients, projects, invoices, etc.)
// DO NOT CHANGE THIS - Your main website depends on it
// ============================================
function getRequiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} environment variable is required`);
  return val;
}

const normalizeApiBaseUrl = (value: string) => {
  const trimmed = value.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

const getApiBaseUrl = () => {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return normalizeApiBaseUrl(fromEnv);
  }

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    const isLoopback = hostname === "127.0.0.1" || hostname.endsWith(".local");
    const isPrivateIpv4 =
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    // In local development, prefer the same-origin Next.js rewrite so browser
    // requests always hit the paired local Express server even over LAN IPs.
    if (process.env.NODE_ENV === "development" || isLoopback || isPrivateIpv4) {
      return `${origin}/api`;
    }
    return normalizeApiBaseUrl(getRequiredEnv('NEXT_PUBLIC_API_URL'));
  }

  const internalUrl = process.env.API_URL_INTERNAL?.trim();
  return internalUrl ? normalizeApiBaseUrl(internalUrl) : normalizeApiBaseUrl(getRequiredEnv('NEXT_PUBLIC_API_URL'));
};

// ============================================
// AUTH API RESOLUTION (SINGLE PRODUCTION DEPLOYMENT)
// ============================================
// Public Website authentication endpoints (/api/auth/*) are Next.js API routes
// served by the same deployment as the browser origin. They MUST always resolve
// through the same origin so login, register, change-password, logout and
// forgot-password all hit the same server, the same environment variables and
// the same users collection. They never route through NEXT_PUBLIC_API_URL or any
// preview/temporary deployment URL.
const isAuthPath = (url?: string) => typeof url === "string" && url.startsWith("/auth/");

const getAuthApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  return "/api";
};

// ============================================
// MAIN AXIOS INSTANCE (For Main Website API)
// ============================================
const API = axios.create();

// ============================================
// LICENSE AXIOS INSTANCE (For License API)
// ============================================
export const LicenseAPI = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

LicenseAPI.interceptors.request.use((config) => {
  const url = process.env.LICENSE_API_URL;
  if (!url) throw new Error('LICENSE_API_URL environment variable is required');
  config.baseURL = url;
  return config;
});

// ============================================
// INTERCEPTORS FOR MAIN WEBSITE API (UNCHANGED)
// ============================================
// attach token automatically
API.interceptors.request.use((config) => {
  config.baseURL = isAuthPath(config.url) ? getAuthApiBaseUrl() : getApiBaseUrl();
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

// ============================================
// INTERCEPTORS FOR LICENSE API (RENDER BACKEND)
// ============================================
LicenseAPI.interceptors.request.use((config) => {
  // Add admin API key if available
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";
  if (adminKey) {
    config.headers["X-Admin-Key"] = adminKey;
  }
  return config;
});

LicenseAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("[License API Error]:", error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// ============================================
// HELPER FUNCTIONS
// ============================================
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

export default API;
// FILE: D:\websmith\core\services\apiService.ts
// PURPOSE: Central API Service for ALL Websmith API calls
// ============================================
// CONNECTION STRATEGY:
// ============================================
// 
// 🟢 MAIN WEBSITE API
//    - Handles: Clients, Projects, Invoices, Messages, Tasks, Team, Auth
//    - URL: same-origin /api (served by this Next.js deployment)
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
// 🟢 MAIN WEBSITE API RESOLUTION (SAME-ORIGIN)
// ============================================
// The Public Website API (/api/*) is served by the SAME Next.js deployment as
// the browser origin (Next.js route handlers). It must ALWAYS resolve through
// the current production origin so requests keep working after every future
// deployment without changing any code. It never references NEXT_PUBLIC_API_URL
// or any preview/temporary/generated Vercel deployment URL.
const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }

  // Server-side fallback (the Public Website only calls the API from the
  // browser, so this path is defensive): prefer an explicit internal URL,
  // otherwise fall back to a relative /api path.
  return process.env.API_URL_INTERNAL?.trim() || "/api";
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
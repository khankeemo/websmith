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
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${origin}/api`;
    }
    return "https://wsdserver.vercel.app/api";
  }

  return process.env.API_URL_INTERNAL || "http://127.0.0.1:5000/api";
};

const API = axios.create({
  baseURL: getApiBaseUrl(),
});

// attach token automatically
API.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      clearAuthSession();
      const currentPath = window.location.pathname;
      
      // Only redirect if NOT on a public page (forgot password, login, etc.)
      if (!isPublicPath(currentPath)) {
        console.error(`[AuthInterceptor] 401 on protected route "${currentPath}". Redirecting to login.`);
        window.location.replace("/login?reason=session-expired");
      } else {
        console.error(`[AuthInterceptor] 401 on public route "${currentPath}". Bypass redirect.`);
      }


    }

    return Promise.reject(error);
  }
);

export default API;


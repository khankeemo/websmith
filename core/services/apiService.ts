import axios from "axios";
import { clearAuthSession, getToken } from "../../lib/auth";

/**
 * Browser defaults to the hosted API to avoid local proxy 500s when the local
 * backend isn't running. Opt into local proxy by setting
 * NEXT_PUBLIC_USE_LOCAL_API_PROXY=true.
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
      if (process.env.NEXT_PUBLIC_USE_LOCAL_API_PROXY === "true") {
        return `${origin}/api`;
      }
      return "https://wsdserver.vercel.app/api";
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
    }

    return Promise.reject(error);
  }
);

export default API;

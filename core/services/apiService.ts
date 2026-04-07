import axios from "axios";
import { clearAuthSession, getToken } from "../../lib/auth";

const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return "https://wsdserver.vercel.app/api";
  }

  return "http://localhost:5000/api";
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

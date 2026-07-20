import API from "./apiService";
import { setAuthSession } from "../../lib/auth";

export const login = async (identifier: string, password: string) => {
  const res = await API.post("/auth/login", { identifier, password });

  setAuthSession(res.data.token, res.data.user);

  return res.data;
};

function getFrontendApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  return "/api";
}

async function apiPost(path: string, body: unknown) {
  const baseUrl = getFrontendApiUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    throw { response: { data: { error: `Network error: ${err?.message || err}` } } };
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    const text = await res.text().catch(() => "");
    throw { response: { data: { error: `${res.status}: ${text.slice(0, 500)}` } } };
  }
  if (!res.ok) throw { response: { data } };
  return data;
}

export const requestPasswordResetOtp = async (email: string) =>
  apiPost("/auth/forgot-password/request", { email });

export const verifyPasswordResetOtp = async (email: string, otp: string) =>
  apiPost("/auth/forgot-password/verify", { email, otp }) as Promise<{ success: boolean; message: string }>;

export const resetPasswordWithOtp = async (payload: {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}) =>
  apiPost("/auth/forgot-password/reset", payload);

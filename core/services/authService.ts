import API from "./apiService";
import { setAuthSession } from "../../lib/auth";

export const login = async (identifier: string, password: string) => {
  const res = await API.post("/auth/login", { identifier, password });

  setAuthSession(res.data.token, res.data.user);

  return res.data;
};

export const requestPasswordResetOtp = async (email: string) => {
  const res = await API.post("/auth/forgot-password/request", { email });
  return res.data;
};

export const verifyPasswordResetOtp = async (email: string, otp: string) => {
  const res = await API.post("/auth/forgot-password/verify", { email, otp });
  return res.data as { success: boolean; message: string };
};

export const resetPasswordWithOtp = async (email: string, newPassword: string, confirmPassword: string) => {
  const res = await API.post("/auth/forgot-password/reset", { email, newPassword, confirmPassword });
  return res.data;
};

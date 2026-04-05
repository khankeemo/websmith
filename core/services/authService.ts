import API from "./apiService";
import { setAuthSession } from "../../lib/auth";

export const login = async (email: string, password: string) => {
  const res = await API.post("/auth/login", { email, password });

  setAuthSession(res.data.token, res.data.user);

  return res.data;
};

import API from "./apiService";
import { setAuthSession } from "../../lib/auth";

export const login = async (identifier: string, password: string) => {
  const res = await API.post("/auth/login", { identifier, password });

  setAuthSession(res.data.token, res.data.user);

  return res.data;
};

import API from "./apiService";

export const login = async (email: string, password: string) => {
  const res = await API.post("/auth/login", { email, password });

  // store token
  localStorage.setItem("token", res.data.token);

  return res.data;
};
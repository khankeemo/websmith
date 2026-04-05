import API from "./apiService";

export interface RoleUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "client" | "developer";
  company?: string;
}

export const getUsersByRole = async (role: RoleUser["role"]) => {
  const response = await API.get(`/users/role/${role}`);
  return response.data.data as RoleUser[];
};

import API from "./apiService";

export interface RoleUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "client" | "developer";
  adminLevel?: "super" | "sub" | null;
  phone?: string;
  company?: string;
  customId?: string;
}

export const getUsersByRole = async (role: RoleUser["role"]) => {
  const response = await API.get(`/users/role/${role}`);
  return response.data.data as RoleUser[];
};

export interface ManagedUserPayload {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role: "admin" | "developer";
}

export const createManagedUser = async (payload: ManagedUserPayload) => {
  const response = await API.post("/users/managed", payload);
  return response.data.data as RoleUser;
};

export const deleteManagedUser = async (id: string) => {
  await API.delete(`/users/managed/${id}`);
};

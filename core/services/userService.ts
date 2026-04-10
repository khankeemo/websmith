import API from "./apiService";

export interface RoleUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "client" | "developer";
  company?: string;
  avatar?: string;
  customId?: string;
  phone?: string;
  published?: boolean;
  headline?: string;
  bio?: string;
  skills?: string[];
  status?: "active" | "inactive" | "on-leave";
  experienceYears?: number;
  joinedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const getUsersByRole = async (role: RoleUser["role"]) => {
  const response = await API.get(`/users/role/${role}`);
  return response.data.data as RoleUser[];
};

export const getDevelopers = async () => {
  const response = await API.get("/users/developers");
  return response.data.data as RoleUser[];
};

export const createDeveloper = async (payload: Partial<RoleUser>) => {
  const response = await API.post("/users/developers", payload);
  return response.data as { success: boolean; data: RoleUser; temporaryPassword?: string };
};

export const updateDeveloper = async (id: string, payload: Partial<RoleUser>) => {
  const response = await API.put(`/users/developers/${id}`, payload);
  return response.data.data as RoleUser;
};

export const deleteDeveloper = async (id: string) => {
  await API.delete(`/users/developers/${id}`);
};

export const getPublishedDevelopers = async () => {
  const response = await API.get("/users/public/developers");
  return response.data.data as RoleUser[];
};

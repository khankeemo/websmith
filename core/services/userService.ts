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
  published?: boolean;
  headline?: string;
  bio?: string;
  skills?: string[];
  status?: "active" | "inactive" | "on-leave";
  experienceYears?: number;
  joinedAt?: string | null;
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

export interface DeveloperPayload {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  skills?: string[];
  headline?: string;
  bio?: string;
  experienceYears?: number;
  status?: "active" | "inactive" | "on-leave";
  joinedAt?: string | null;
  published?: boolean;
}

export const getDevelopers = async () => {
  const response = await API.get("/users/developers");
  return response.data.data;
};

export const getPublishedDevelopers = async () => {
  try {
    const response = await API.get("/users/public/developers");
    return response.data.data || [];
  } catch (error) {
    console.warn("Get public developers error:", error);
    return [];
  }
};

export const createDeveloper = async (payload: DeveloperPayload) => {
  const response = await API.post("/users/developers", payload);
  return response.data;
};

export const updateDeveloper = async (id: string, payload: Partial<DeveloperPayload>) => {
  const response = await API.put(`/users/developers/${id}`, payload);
  return response.data.data;
};

export const deleteDeveloper = async (id: string) => {
  await API.delete(`/users/developers/${id}`);
};

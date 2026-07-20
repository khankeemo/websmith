import API from "../../../core/services/apiService";

export interface ManagedService {
  _id?: string;
  name: string;
  description: string;
  price?: number | null;
  isActive: boolean;
  createdAt?: string;
}

export type ManagedServicePayload = Omit<ManagedService, "_id" | "createdAt">;

const getApiErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

export const getManagedServices = async (): Promise<ManagedService[]> => {
  try {
    const response = await API.get("/services/admin");
    return response.data.data || [];
  } catch (error: any) {
    console.error("Get managed services error:", error);
    throw getApiErrorMessage(error, "Failed to fetch services");
  }
};

export const createManagedService = async (service: ManagedServicePayload): Promise<ManagedService> => {
  try {
    const response = await API.post("/services", service);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error("Create managed service error:", error);
    throw getApiErrorMessage(error, "Failed to create service");
  }
};

export const updateManagedService = async (id: string, service: ManagedServicePayload): Promise<ManagedService> => {
  try {
    const response = await API.put(`/services/${id}`, service);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error("Update managed service error:", error);
    throw getApiErrorMessage(error, "Failed to update service");
  }
};

export const deleteManagedService = async (id: string): Promise<void> => {
  try {
    await API.delete(`/services/${id}`);
  } catch (error: any) {
    console.error("Delete managed service error:", error);
    throw getApiErrorMessage(error, "Failed to delete service");
  }
};

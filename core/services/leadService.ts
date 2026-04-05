import API from "./apiService";

export interface PublicService {
  id: string;
  name: string;
  description: string;
  price?: number | null;
}

export interface LeadPayload {
  name: string;
  email: string;
  phone: string;
  company?: string;
  budget?: number | null;
  timeline?: string;
  notes?: string;
  cmsRequirement?: string;
  appPlatform?: "iOS" | "Android" | "Both" | "";
  services: string[];
}

export const getPublicServices = async (): Promise<PublicService[]> => {
  try {
    const response = await API.get("/services", {
      params: { t: Date.now() },
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    return response.data.data || [];
  } catch (error: any) {
    console.error("Get public services error:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch services");
  }
};

export const createLead = async (payload: LeadPayload) => {
  try {
    const response = await API.post("/leads", payload);
    return response.data.data || response.data;
  } catch (error: any) {
    console.error("Create lead error:", error);
    throw new Error(error.response?.data?.message || "Failed to submit lead");
  }
};

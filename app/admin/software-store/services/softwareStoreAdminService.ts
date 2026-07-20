import API from "@/core/services/apiService";

export type SoftwareListingMode = "buy" | "sell" | "both";
export type SoftwareLicenseType = "one_time" | "subscription" | "free" | "open_source";
export type SoftwareInquiryStatus = "new" | "contacted" | "closed";

export interface SoftwareListing {
  _id?: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  licenseType: SoftwareLicenseType;
  listingMode: SoftwareListingMode;
  sellerName: string;
  sellerEmail: string;
  website?: string;
  isActive: boolean;
  isFeatured: boolean;
  createdAt?: string;
}

export interface SoftwareInquiry {
  _id?: string;
  listingId?: string | { _id: string; title: string } | null;
  intent: "buy" | "sell";
  name: string;
  email: string;
  company?: string;
  budget?: number | null;
  message: string;
  status?: SoftwareInquiryStatus;
  createdAt?: string;
}

export type SoftwareListingPayload = Omit<SoftwareListing, "_id" | "createdAt">;
export type SoftwareInquiryPayload = Omit<SoftwareInquiry, "_id" | "createdAt" | "status">;

const getApiErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

export const getAdminSoftwareListings = async (): Promise<SoftwareListing[]> => {
  try {
    const response = await API.get("/software-store/admin/listings");
    return response.data.data || [];
  } catch (error: any) {
    throw getApiErrorMessage(error, "Failed to fetch software listings");
  }
};

export const createAdminSoftwareListing = async (payload: SoftwareListingPayload): Promise<SoftwareListing> => {
  try {
    const response = await API.post("/software-store/admin/listings", payload);
    return response.data.data || response.data;
  } catch (error: any) {
    throw getApiErrorMessage(error, "Failed to create software listing");
  }
};

export const updateAdminSoftwareListing = async (
  id: string,
  payload: SoftwareListingPayload
): Promise<SoftwareListing> => {
  try {
    const response = await API.put(`/software-store/admin/listings/${id}`, payload);
    return response.data.data || response.data;
  } catch (error: any) {
    throw getApiErrorMessage(error, "Failed to update software listing");
  }
};

export const deleteAdminSoftwareListing = async (id: string): Promise<void> => {
  try {
    await API.delete(`/software-store/admin/listings/${id}`);
  } catch (error: any) {
    throw getApiErrorMessage(error, "Failed to delete software listing");
  }
};

export const getAdminSoftwareInquiries = async (): Promise<SoftwareInquiry[]> => {
  try {
    const response = await API.get("/software-store/admin/inquiries");
    return response.data.data || [];
  } catch (error: any) {
    throw getApiErrorMessage(error, "Failed to fetch software inquiries");
  }
};

export const updateAdminSoftwareInquiryStatus = async (
  id: string,
  status: SoftwareInquiryStatus
): Promise<SoftwareInquiry> => {
  try {
    const response = await API.put(`/software-store/admin/inquiries/${id}`, { status });
    return response.data.data || response.data;
  } catch (error: any) {
    throw getApiErrorMessage(error, "Failed to update inquiry");
  }
};

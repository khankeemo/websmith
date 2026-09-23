// FILE: lib/cms/cmsService.ts
// PURPOSE: API Client Service for Industries and Services CMS

import API from "@/core/services/apiService";
import type { CmsIndustry, CmsServiceCategory, CmsServiceItem } from "./types";

const getApiErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

// ============================================================================
// INDUSTRIES
// ============================================================================

export const getPublicIndustries = async (): Promise<CmsIndustry[]> => {
  try {
    const res = await API.get("/cms/industries");
    return res.data?.data || [];
  } catch (error) {
    console.warn("Failed to fetch public industries:", error);
    return [];
  }
};

export const getAdminIndustries = async (): Promise<CmsIndustry[]> => {
  try {
    const res = await API.get("/cms/industries?admin=true");
    return res.data?.data || [];
  } catch (error) {
    console.error("Failed to fetch admin industries:", error);
    throw new Error(getApiErrorMessage(error, "Failed to load industries"));
  }
};

export const createIndustry = async (data: Partial<CmsIndustry>): Promise<CmsIndustry> => {
  try {
    const res = await API.post("/cms/industries", data);
    return res.data?.data;
  } catch (error) {
    console.error("Failed to create industry:", error);
    throw new Error(getApiErrorMessage(error, "Failed to create industry"));
  }
};

export const updateIndustry = async (id: string, data: Partial<CmsIndustry>): Promise<CmsIndustry> => {
  try {
    const res = await API.put(`/cms/industries/${id}`, data);
    return res.data?.data;
  } catch (error) {
    console.error("Failed to update industry:", error);
    throw new Error(getApiErrorMessage(error, "Failed to update industry"));
  }
};

export const deleteIndustry = async (id: string): Promise<void> => {
  try {
    await API.delete(`/cms/industries/${id}`);
  } catch (error) {
    console.error("Failed to delete industry:", error);
    throw new Error(getApiErrorMessage(error, "Failed to delete industry"));
  }
};

// ============================================================================
// SERVICES (CATEGORIES + SUBCATEGORIES)
// ============================================================================

export const getPublicServiceCategories = async (options?: { menuOnly?: boolean }): Promise<CmsServiceCategory[]> => {
  try {
    const query = options?.menuOnly ? "?menuOnly=true" : "";
    const res = await API.get(`/cms/services/categories${query}`);
    return res.data?.data || [];
  } catch (error) {
    console.warn("Failed to fetch public service categories:", error);
    return [];
  }
};

export const getAdminServiceCategories = async (): Promise<CmsServiceCategory[]> => {
  try {
    const res = await API.get("/cms/services/categories?admin=true");
    return res.data?.data || [];
  } catch (error) {
    console.error("Failed to fetch admin service categories:", error);
    throw new Error(getApiErrorMessage(error, "Failed to load service categories"));
  }
};

export const createServiceCategory = async (data: Partial<CmsServiceCategory>): Promise<CmsServiceCategory> => {
  try {
    const res = await API.post("/cms/services/categories", data);
    return res.data?.data;
  } catch (error) {
    console.error("Failed to create service category:", error);
    throw new Error(getApiErrorMessage(error, "Failed to create category"));
  }
};

export const updateServiceCategory = async (id: string, data: Partial<CmsServiceCategory>): Promise<CmsServiceCategory> => {
  try {
    const res = await API.put(`/cms/services/categories/${id}`, data);
    return res.data?.data;
  } catch (error) {
    console.error("Failed to update service category:", error);
    throw new Error(getApiErrorMessage(error, "Failed to update category"));
  }
};

export const deleteServiceCategory = async (id: string): Promise<void> => {
  try {
    await API.delete(`/cms/services/categories/${id}`);
  } catch (error) {
    console.error("Failed to delete service category:", error);
    throw new Error(getApiErrorMessage(error, "Failed to delete category"));
  }
};

export const createServiceItem = async (data: Partial<CmsServiceItem>): Promise<CmsServiceItem> => {
  try {
    const res = await API.post("/cms/services/items", data);
    return res.data?.data;
  } catch (error) {
    console.error("Failed to create service item:", error);
    throw new Error(getApiErrorMessage(error, "Failed to create service item"));
  }
};

export const updateServiceItem = async (id: string, data: Partial<CmsServiceItem>): Promise<CmsServiceItem> => {
  try {
    const res = await API.put(`/cms/services/items/${id}`, data);
    return res.data?.data;
  } catch (error) {
    console.error("Failed to update service item:", error);
    throw new Error(getApiErrorMessage(error, "Failed to update service item"));
  }
};

export const deleteServiceItem = async (id: string): Promise<void> => {
  try {
    await API.delete(`/cms/services/items/${id}`);
  } catch (error) {
    console.error("Failed to delete service item:", error);
    throw new Error(getApiErrorMessage(error, "Failed to delete service item"));
  }
};

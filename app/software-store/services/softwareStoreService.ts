export interface StoreProductPlan {
  id: number;
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  max_devices: number;
  features: string[];
  is_active: boolean;
  is_trial_plan?: boolean;
  trial_days_limit?: number;
  display_order: number;
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  short_description?: string;
  logo_url?: string;
  banner_url?: string;
  platform?: string;
  docs_url?: string;
  support_url?: string;
  featured?: boolean;
  display_order?: number;
  product_type?: string;
  company_name?: string;
  version: string;
  latest_version?: string;
  website?: string;
  price?: number;
  is_active: boolean;
  is_deleted?: boolean;
  category?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  plans: StoreProductPlan[];
  has_trial?: boolean;
}

export const getPublicProducts = async (): Promise<StoreProduct[]> => {
  const response = await fetch("/api/v1/store/products");
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to fetch products');
  }
  return data.products || [];
};

export const getProductById = async (id: string): Promise<StoreProduct | null> => {
  try {
    const response = await fetch(`/api/v1/store/products?id=${encodeURIComponent(id)}`);
    const data = await response.json();
    if (data.success && data.products?.length > 0) return data.products[0];
    return null;
  } catch {
    return null;
  }
};

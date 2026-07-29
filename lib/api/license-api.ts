// FILE: D:\websmith\lib\api\license-api.ts
// PURPOSE: License API client
// ============================================

export interface License {
  license_key: string;
  product_id: string;
  product_name: string;
  customer_name: string;
  customer_email: string;
  plan: string;
  status: "active" | "expired" | "revoked" | "suspended";
  expiry_date: string;
  created_at: string;
  max_devices: number;
  current_devices: number;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  version: string;
  license_type: "perpetual" | "subscription" | "trial";
  default_expiry_days: number;
  default_max_devices: number;
  status: "active" | "archived" | "disabled";
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company?: string;
  created_at: string;
  total_licenses: number;
  active_licenses: number;
}

export interface HardwareDevice {
  hardware_id: string;
  device_name: string;
  license_key: string;
  product_name: string;
  activated_at: string;
  last_seen: string;
  ip_address?: string;
  status: "active" | "inactive" | "blocked";
}

export interface Trial {
  hardware_id: string;
  product_name: string;
  status: "active" | "expired" | "converted";
  days_left: number;
  expiry_date: string;
  started_at: string;
}

export interface LicenseStatusResponse {
  success: boolean;
  status: "licensed" | "trial" | "no_license";
  customer: {
    name: string;
    email: string;
    mobile: string;
  };
  license: {
    license_key: string;
    status: string;
    expiry_date: string;
    days_remaining: number;
  };
  plan: {
    name: string;
    device_limit: number;
  };
  product: {
    name: string;
    product_id?: string;
  };
  devices?: {
    current: number;
    maximum: number;
  };
  hardware?: {
    hardware_id: string;
    device_name?: string;
    is_activated?: boolean;
  };
}

export interface ActivationLog {
  id: string;
  license_key: string;
  product_name: string;
  hardware_id: string;
  device_name: string;
  ip_address: string;
  action: "activate" | "deactivate" | "reset" | "validate";
  result: "success" | "failed";
  timestamp: string;
}

export interface DashboardStats {
  total_licenses: number;
  active_licenses: number;
  expired_licenses: number;
  revoked_licenses: number;
  active_trials: number;
  online_devices: number;
  api_health: "online" | "offline" | "degraded";
  database_status: "connected" | "disconnected";
  latency_ms: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  latency_ms?: number;
}

// ========== PRODUCTION CONFIGURATION ==========
function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
  return url;
}

const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";

class LicenseApiClient {
  private baseUrl: string;
  private adminKey: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
    this.adminKey = ADMIN_API_KEY;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.adminKey) {
      headers["X-Admin-Key"] = this.adminKey;
    }

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const latency_ms = Date.now() - startTime;
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.detail || data.error || `HTTP ${response.status}`,
          latency_ms,
        };
      }

      return {
        success: true,
        data: data as T,
        latency_ms,
      };
    } catch (error) {
      console.error(`[License API] ${method} ${path} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  // ========== HEALTH ==========
  // ✅ Render API path: /internal/backend/health
  async healthCheck(): Promise<ApiResponse<{ status: string; database: string }>> {
    return this.request("GET", "/internal/backend/health");
  }

  // ========== DASHBOARD ==========
  // ✅ Render API path: /internal/backend/dashboard/metrics
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return this.request("GET", "/internal/backend/dashboard/metrics");
  }

  // ========== PRODUCTS ==========
  // ✅ Render API paths: /internal/backend/products
  async getProducts(): Promise<ApiResponse<Product[]>> {
    return this.request("GET", "/internal/backend/products");
  }

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    return this.request("GET", `/internal/backend/products/${id}`);
  }

  async createProduct(data: Omit<Product, "id" | "created_at">): Promise<ApiResponse<Product>> {
    return this.request("POST", "/internal/backend/products", data);
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<ApiResponse<Product>> {
    return this.request("PUT", `/internal/backend/products/${id}`, data);
  }

  async deleteProduct(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request("DELETE", `/internal/backend/products/${id}`);
  }

  // ========== LICENSES ==========
  // ✅ Render API paths: /internal/backend/licenses
  async getLicenses(params?: { product_id?: string; status?: string; email?: string }): Promise<ApiResponse<License[]>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request("GET", `/internal/backend/licenses${query ? `?${query}` : ""}`);
  }

  async getLicense(licenseKey: string): Promise<ApiResponse<License>> {
    return this.request("GET", `/internal/backend/licenses/${licenseKey}`);
  }

  async generateLicense(data: {
    product_id: string;
    customer_name: string;
    customer_email: string;
    plan: string;
    expiry_days: number;
    max_devices: number;
    notes?: string;
    license_key?: string;
  }): Promise<ApiResponse<License>> {
    return this.request("POST", "/internal/backend/licenses/generate", data);
  }

  async renewLicense(licenseKey: string, extraDays: number): Promise<ApiResponse<License>> {
    return this.request("POST", `/internal/backend/licenses/${licenseKey}/renew`, { extra_days: extraDays });
  }

  async revokeLicense(licenseKey: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request("POST", `/internal/backend/licenses/${licenseKey}/revoke`, {});
  }

  async extendLicense(licenseKey: string, extraDays: number): Promise<ApiResponse<License>> {
    return this.request("POST", `/internal/backend/licenses/${licenseKey}/extend`, { extra_days: extraDays });
  }

  async deleteLicense(licenseKey: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request("DELETE", `/internal/backend/licenses/${licenseKey}`);
  }

  async changeLicenseEmail(licenseKey: string, newEmail: string): Promise<ApiResponse<License>> {
    return this.request("PUT", `/internal/backend/licenses/${licenseKey}/email`, { email: newEmail });
  }

  // ========== CUSTOMERS ==========
  // ✅ Render API paths: /internal/backend/customers
  async searchCustomers(query: string): Promise<ApiResponse<Customer[]>> {
    return this.request("GET", `/internal/backend/customers/search?q=${encodeURIComponent(query)}`);
  }

  async getCustomer(id: string): Promise<ApiResponse<Customer & { licenses: License[] }>> {
    return this.request("GET", `/internal/backend/customers/${id}`);
  }

  // ========== LICENSE STATUS (AWS-01) ==========
  async getLicenseStatus(hardwareId: string): Promise<ApiResponse<LicenseStatusResponse>> {
    return this.request("GET", `/internal/backend/license/status?hardware_id=${encodeURIComponent(hardwareId)}`);
  }

  // ========== HARDWARE ==========
  // ✅ Render API paths: /internal/backend/hardware
  async getHardwareDevices(params?: { license_key?: string; status?: string }): Promise<ApiResponse<HardwareDevice[]>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request("GET", `/internal/backend/hardware${query ? `?${query}` : ""}`);
  }

  async resetHardware(licenseKey: string, hardwareId?: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request("POST", "/internal/backend/hardware/reset", { license_key: licenseKey, hardware_id: hardwareId });
  }

  async unbindDevice(licenseKey: string, hardwareId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request("POST", "/internal/backend/hardware/unbind", { license_key: licenseKey, hardware_id: hardwareId });
  }

  // ========== TRIALS ==========
  // ✅ Render API paths: /internal/backend/trials
  async getTrials(params?: { status?: string }): Promise<ApiResponse<Trial[]>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request("GET", `/internal/backend/trials${query ? `?${query}` : ""}`);
  }

  async terminateTrial(hardwareId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request("POST", "/internal/backend/trials/terminate", { hardware_id: hardwareId });
  }

  async convertTrialToLicense(hardwareId: string, customerName: string, customerEmail: string): Promise<ApiResponse<License>> {
    return this.request("POST", "/internal/backend/trials/convert", {
      hardware_id: hardwareId,
      customer_name: customerName,
      customer_email: customerEmail,
    });
  }

  // ========== LOGS ==========
  // ✅ Render API paths: /internal/backend/logs
  async getActivationLogs(limit: number = 100, offset: number = 0): Promise<ApiResponse<ActivationLog[]>> {
    return this.request("GET", `/internal/backend/logs/activations?limit=${limit}&offset=${offset}`);
  }

  async getAuditLogs(limit: number = 100, offset: number = 0): Promise<ApiResponse<ActivationLog[]>> {
    return this.request("GET", `/internal/backend/logs/audit?limit=${limit}&offset=${offset}`);
  }
}

export const licenseApi = new LicenseApiClient();
"use client";

// FILE: app/internal/api/portal/portalClient.ts
// PURPOSE: Thin, typed client ONLY for the Universal Buy & Renew Portal.
//          Talks exclusively to the public portal backend (/api/portal/*) and
//          the public checkout config endpoint. Never touches admin/internal
//          or licensing internals — the browser never sees admin data or IDs.

export interface PortalPlan {
  id: number;
  product_id: string;
  name: string;
  description: string | null;
  max_devices: number;
  duration_days: number;
  price: number;
  is_active: boolean;
  is_trial_plan: boolean;
  features: unknown;
  display_order: number | null;
}

export type StorePlan = PortalPlan;

export interface PortalProduct {
  id: string;
  name: string;
  version?: string;
  description: string | null;
  short_description: string | null;
  logo_url: string | null;
  platform: string | null;
  company_name: string | null;
  latest_version: string | null;
  price: number;
  featured: boolean;
  has_trial: boolean;
  plans: PortalPlan[];
}

export interface CheckoutCountry {
  code: string;
  name: string;
  dial: string;
  flag: string;
  minDigits: number | null;
  maxDigits: number | null;
}
export interface CheckoutState { id: number; country_code: string; name: string; }
export interface CheckoutCity { id: number; state_id: number; name: string; }
export interface CheckoutGateway { name: string; display_name: string; supported_currencies: string[]; }
export interface CheckoutTax { rate: number; name: string; currency: string; }
export interface CheckoutConfigData {
  countries: CheckoutCountry[];
  states: CheckoutState[];
  cities: CheckoutCity[];
  gateways: CheckoutGateway[];
  payment_config?: any;
  tax?: CheckoutTax;
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && data.success === false)) {
    throw new Error(data?.error || data?.message || "Request failed");
  }
  return data as T;
}

export async function fetchPortalProducts(): Promise<PortalProduct[]> {
  const data = await json<{ success: boolean; products: PortalProduct[] }>(
    await fetch("/api/portal/products", { cache: "no-store" })
  );
  return data.products || [];
}

export async function fetchPortalConfig(): Promise<CheckoutConfigData> {
  const data = await json<{ success: boolean; data: CheckoutConfigData }>(
    await fetch("/api/v1/checkout/config")
  );
  return data.data;
}

export async function sendOtp(email: string): Promise<{ expires_in?: number }> {
  const data = await json<{ success: boolean; expires_in?: number }>(
    await fetch("/api/portal/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", email }),
    })
  );
  return { expires_in: data.expires_in };
}

export async function verifyOtp(email: string, otp: string): Promise<{ success: boolean }> {
  return json(await fetch("/api/portal/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "verify", email, otp }),
  }));
}

export interface LicenseInfo {
  license_key: string;
  product_name: string;
  product_id: string;
  product_logo: string | null;
  current_plan: { name: string; price: number };
  expiry_date: string;
  days_left: number;
  customer_email: string;
  customer_name: string;
  max_devices: number;
}

export interface LicenseInfoResult {
  renewable: boolean;
  status: string;
  license: LicenseInfo;
  plans: StorePlan[];
}

export async function fetchLicenseInfo(licenseKey: string): Promise<LicenseInfoResult> {
  const data = await json<{ success: boolean; renewable: boolean; status: string; license: LicenseInfo; plans: StorePlan[] }>(
    await fetch("/api/portal/license/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: licenseKey }),
    })
  );
  return data;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  taxName?: string;
}

export async function createPortalOrder(payload: any): Promise<{ order_number: string; mode: string; totals: OrderTotals }> {
  return json(await fetch("/api/portal/order/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

export async function payPortalOrder(orderNumber: string): Promise<any> {
  return json(await fetch("/api/portal/order/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_number: orderNumber }),
  }));
}
import { HardwareDetector } from './hardware.ts';
import { CacheManager } from './cache.ts';
import { generateTimestamp, generateNonce, signRequest } from './crypto.ts';

export const SDK_VERSION = '${kit_version}';
export const RUNTIME_TYPE = '${runtime}';
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

export class ApiError extends Error {
  statusCode: number;
  data: Record<string, any>;

  constructor(statusCode: number, message: string, data?: Record<string, any>) {
    super(`API Error ${statusCode}: ${message}`);
    this.statusCode = statusCode;
    this.data = data || {};
  }
}

export class ApiClient {
  private config: Record<string, any>;
  private apiConfig: Record<string, any>;
  private baseUrl: string;
  private apiVersion: string;
  private apiKey: string;
  private apiSecret: string;
  private timeout: number;
  private retryCount: number;
  private productId: string;
  private _hardware: HardwareDetector;
  private _cache?: CacheManager;

  constructor(config: Record<string, any>, hardware?: HardwareDetector, cache?: CacheManager) {
    this.config = config;
    this.apiConfig = config.api || {};
    this.baseUrl = (this.apiConfig.url || '').replace(/\/+$/, '');
    this.apiVersion = this.apiConfig.version || 'v1';
    this.apiKey = this.apiConfig.public_key || '';
    this.apiSecret = this.apiConfig.secret || '';
    this.timeout = parseInt(this.apiConfig.timeout || '30000', 10);
    this.retryCount = parseInt(this.apiConfig.retry_count || '3', 10);
    this.productId = (config.product || {}).id || '';
    this._hardware = hardware || new HardwareDetector();
    this._cache = cache;
  }

  private _getHardwareId(): string {
    return this._hardware.getFingerprint();
  }

  private async _signRequest(payload: Record<string, any>, method: string, path: string, query: string): Promise<Record<string, string>> {
    const ts = generateTimestamp();
    const nonce = generateNonce();
    const sig = await signRequest(payload, this.apiSecret, ts, nonce, method, path, query);
    return { 'x-api-key': this.apiKey, 'x-timestamp': ts, 'x-nonce': nonce, 'x-signature': sig };
  }

  private async _request(endpoint: string, payload: Record<string, any>, retries?: number): Promise<Record<string, any>> {
    const url = `${this.baseUrl}/api/${this.apiVersion}/${endpoint}`;
    const maxRetries = retries ?? this.retryCount;
    const requestPayload: Record<string, any> = { ...payload };
    if (this.productId) requestPayload.product_id = requestPayload.product_id || this.productId;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const apiPath = `/api/${this.apiVersion}/${endpoint}`;
        const headers = await this._signRequest(requestPayload, 'POST', apiPath, '');
        headers['Content-Type'] = 'application/json';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        let data: Record<string, any> = {};
        try { data = await response.json(); } catch { if (response.body) data = { message: await response.text() }; }

        if (response.ok) return data;
        if (response.status === 429) {
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, parseInt(response.headers.get('Retry-After') || '5', 10) * 1000));
            continue;
          }
          throw new ApiError(429, 'Rate limit exceeded', data);
        }
        if (RETRYABLE_STATUSES.has(response.status)) {
          if (attempt < maxRetries) { await new Promise(r => setTimeout(r, (attempt + 1) * 2000)); continue; }
          throw new ApiError(response.status, 'Server error', data);
        }
        throw new ApiError(response.status, data.message || data.error || `HTTP ${response.status}`, data);
      } catch (e) {
        if (e instanceof ApiError) throw e;
        if (attempt < maxRetries) { await new Promise(r => setTimeout(r, (attempt + 1) * 2000)); continue; }
        throw new ApiError(503, `Request failed: ${(e as Error).message}`);
      }
    }
    throw new ApiError(500, `Failed after ${maxRetries} retries`);
  }

  async validateLicense(licenseKey: string, hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    if (this._cache && await this._cache.isValid()) {
      const cached = await this._cache.getLicenseStatus();
      if (cached) return cached;
    }
    const r = await this._request('license', { action: 'validate', license_key: licenseKey, hardware_id: hardwareId });
    if (this._cache && r.success && r.data?.valid) await this._cache.setLicenseStatus(r);
    return r;
  }

  async activateLicense(licenseKey: string, hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const r = await this._request('license', { action: 'activate', license_key: licenseKey, hardware_id: hardwareId });
    if (this._cache) await this._cache.invalidateLicenseStatus();
    return r;
  }

  async deactivateLicense(licenseKey: string, hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const r = await this._request('license', { action: 'deactivate', license_key: licenseKey, hardware_id: hardwareId });
    if (this._cache) await this._cache.invalidateLicenseStatus();
    return r;
  }

  async renewLicense(licenseKey: string, extraDays?: number): Promise<Record<string, any>> {
    const p: Record<string, any> = { action: 'renew', license_key: licenseKey };
    if (extraDays !== undefined) p.extra_days = extraDays;
    const r = await this._request('license', p);
    if (this._cache) await this._cache.invalidateLicenseStatus();
    return r;
  }

  async startTrial(email: string, customerName?: string, customerData?: Record<string, any>): Promise<Record<string, any>> {
    const hid = this._getHardwareId();
    const p: Record<string, any> = { action: 'start', customer_email: email, customer_name: customerName || '', hardware_id: hid };
    if (customerData) p.customer_data = customerData;
    return this._request('trial', p);
  }

  async getTrialStatus(hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    return this._request('trial', { action: 'status', hardware_id: hardwareId });
  }

  async convertTrial(hardwareId?: string, plan?: string, customerName?: string, customerEmail?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const p: Record<string, any> = { action: 'convert', hardware_id: hardwareId };
    if (plan) p.plan = plan;
    if (customerName) p.customer_name = customerName;
    if (customerEmail) p.customer_email = customerEmail;
    const r = await this._request('trial', p);
    if (this._cache) await this._cache.invalidateLicenseStatus();
    return r;
  }

  async bindDevice(licenseKey: string, hardwareId?: string, deviceName?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const p: Record<string, any> = { action: 'bind', license_key: licenseKey, hardware_id: hardwareId };
    if (deviceName) p.device_name = deviceName;
    return this._request('device', p);
  }

  async replaceDevice(licenseKey: string, newHardwareId?: string, oldHardwareId?: string): Promise<Record<string, any>> {
    if (!newHardwareId) newHardwareId = this._getHardwareId();
    if (!oldHardwareId) throw new Error('old_hardware_id is required for device replacement');
    const r = await this._request('device', { action: 'replace', license_key: licenseKey, old_hardware_id: oldHardwareId, new_hardware_id: newHardwareId });
    if (this._cache) await this._cache.invalidateLicenseStatus();
    return r;
  }

  async getProducts(): Promise<Record<string, any>> {
    const payload: Record<string, any> = { action: 'list' };
    if (this.productId) payload.product_id = this.productId;
    try {
      return await this._request('store/products', payload);
    } catch {
      return { success: false, products: [] };
    }
  }

  async updateCustomer(name: string, email: string, phone: string, hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload: Record<string, any> = { action: 'update', name, email, mobile: phone, hardware_id: hardwareId };
    try {
      const result = await this._request('customer/register', payload);
      if (result.success && this._cache) await this._cache.invalidateLicenseStatus();
      return result;
    } catch (e) { return { success: false, error: (e as Error).message }; }
  }
}

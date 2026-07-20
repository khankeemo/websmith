import * as http from 'http';
import * as https from 'https';
import { generateTimestamp, generateNonce, signRequest } from './crypto';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';

export const SDK_VERSION = '${kit_version}';
export const RUNTIME_TYPE = '${runtime}';
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

export class ApiError extends Error {
  statusCode: number;
  message: string;
  data: Record<string, any>;

  constructor(statusCode: number, message: string, data?: Record<string, any>) {
    super(`API Error ${statusCode}: ${message}`);
    this.statusCode = statusCode;
    this.message = message;
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
  private _cache: CacheManager | undefined;

  constructor(
    config: Record<string, any>,
    hardware?: HardwareDetector,
    cache?: CacheManager,
  ) {
    this.config = config;
    this.apiConfig = config.api || {};
    this.baseUrl = (this.apiConfig.url || '').replace(/\/+$/, '');
    this.apiVersion = this.apiConfig.version || 'v1';
    this.apiKey = this.apiConfig.public_key || '';
    this.apiSecret = this.apiConfig.secret || '';
    this.timeout = Math.floor(parseInt(this.apiConfig.timeout || '30000', 10) / 1000);
    this.retryCount = parseInt(this.apiConfig.retry_count || '3', 10);
    this.productId = (config.product || {}).id || '';
    this._hardware = hardware || new HardwareDetector();
    this._cache = cache;
  }

  private _getHardwareId(): string {
    return this._hardware.getFingerprint();
  }

  private _signRequest(
    payload: Record<string, any>,
    method: string,
    path: string,
    query: string,
  ): Record<string, string> {
    const timestamp = generateTimestamp();
    const nonce = generateNonce();
    const signature = signRequest(payload, this.apiSecret, timestamp, nonce, method, path, query);
    return {
      'x-api-key': this.apiKey,
      'x-timestamp': timestamp,
      'x-nonce': nonce,
      'x-signature': signature,
    };
  }

  private _request(
    endpoint: string,
    payload: Record<string, any>,
    retries?: number,
  ): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/api/${this.apiVersion}/${endpoint}`;
      const maxRetries = retries !== undefined ? retries : this.retryCount;
      const requestPayload: Record<string, any> = { ...payload };
      if (this.productId) {
        requestPayload.product_id = requestPayload.product_id || this.productId;
      }

      const attemptRequest = (attempt: number) => {
        const apiPath = `/api/${this.apiVersion}/${endpoint}`;
        const headers = this._signRequest(requestPayload, 'POST', apiPath, '');
        headers['Content-Type'] = 'application/json';

        const body = JSON.stringify(requestPayload);
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const transport = isHttps ? https : http;

        const options: http.RequestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers,
          timeout: this.timeout * 1000,
        };

        const req = transport.request(options, (res) => {
          let responseData = '';
          res.on('data', (chunk: string) => { responseData += chunk; });
          res.on('end', () => {
            let data: Record<string, any> = {};
            try {
              data = JSON.parse(responseData);
            } catch (_) {
              if (responseData) data = { message: responseData };
            }
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
              return;
            }
            if (res.statusCode === 429) {
              if (attempt < maxRetries) {
                const retryAfter = parseInt(res.headers['retry-after'] as string || '5', 10);
                setTimeout(() => attemptRequest(attempt + 1), retryAfter * 1000);
                return;
              }
              reject(new ApiError(429, 'Rate limit exceeded', data));
              return;
            }
            if (res.statusCode && RETRYABLE_STATUSES.has(res.statusCode)) {
              if (attempt < maxRetries) {
                setTimeout(() => attemptRequest(attempt + 1), (attempt + 1) * 2000);
                return;
              }
              reject(new ApiError(res.statusCode, 'Server error', data));
              return;
            }
            const message = data.message || data.error || `HTTP ${res.statusCode}`;
            reject(new ApiError(res.statusCode || 500, message, data));
          });
        });

        req.on('error', (err: Error) => {
          if (attempt < maxRetries) {
            setTimeout(() => attemptRequest(attempt + 1), (attempt + 1) * 2000);
            return;
          }
          reject(new ApiError(503, `Connection error: ${err.message}`));
        });

        req.on('timeout', () => {
          req.destroy();
          if (attempt < maxRetries) {
            setTimeout(() => attemptRequest(attempt + 1), (attempt + 1) * 2000);
            return;
          }
          reject(new ApiError(504, `Request timeout after ${this.timeout}s`));
        });

        req.write(body);
        req.end();
      };

      attemptRequest(0);
    });
  }

  async validateLicense(licenseKey: string, hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload = { action: 'validate', license_key: licenseKey, hardware_id: hardwareId };
    if (this._cache && this._cache.isValid()) {
      const cached = this._cache.getLicenseStatus();
      if (cached) return cached;
    }
    const response = await this._request('license', payload);
    if (this._cache && response.success && response.data?.valid) {
      this._cache.setLicenseStatus(response);
    }
    return response;
  }

  async activateLicense(licenseKey: string, hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload = { action: 'activate', license_key: licenseKey, hardware_id: hardwareId };
    const response = await this._request('license', payload);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return response;
  }

  async deactivateLicense(licenseKey: string, hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload = { action: 'deactivate', license_key: licenseKey, hardware_id: hardwareId };
    const response = await this._request('license', payload);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return response;
  }

  async renewLicense(licenseKey: string, extraDays?: number): Promise<Record<string, any>> {
    const payload: Record<string, any> = { action: 'renew', license_key: licenseKey };
    if (extraDays !== undefined) payload.extra_days = extraDays;
    const response = await this._request('license', payload);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return response;
  }

  async startTrial(email: string, customerName?: string, customerData?: Record<string, any>): Promise<Record<string, any>> {
    const hardwareId = this._getHardwareId();
    const payload: Record<string, any> = { action: 'start', customer_email: email, customer_name: customerName || '', hardware_id: hardwareId };
    if (customerData) payload.customer_data = customerData;
    return this._request('trial', payload);
  }

  async getTrialStatus(hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    return this._request('trial', { action: 'status', hardware_id: hardwareId });
  }

  async convertTrial(hardwareId?: string, plan?: string, customerName?: string, customerEmail?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload: Record<string, any> = { action: 'convert', hardware_id: hardwareId };
    if (plan) payload.plan = plan;
    if (customerName) payload.customer_name = customerName;
    if (customerEmail) payload.customer_email = customerEmail;
    const response = await this._request('trial', payload);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return response;
  }

  async bindDevice(licenseKey: string, hardwareId?: string, deviceName?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload: Record<string, any> = { action: 'bind', license_key: licenseKey, hardware_id: hardwareId };
    if (deviceName) payload.device_name = deviceName;
    return this._request('device', payload);
  }

  async replaceDevice(licenseKey: string, newHardwareId?: string, oldHardwareId?: string): Promise<Record<string, any>> {
    if (!newHardwareId) newHardwareId = this._getHardwareId();
    if (!oldHardwareId) throw new Error('old_hardware_id is required for device replacement');
    const payload = { action: 'replace', license_key: licenseKey, old_hardware_id: oldHardwareId, new_hardware_id: newHardwareId };
    const response = await this._request('device', payload);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return response;
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
      if (result.success && this._cache) this._cache.invalidateLicenseStatus();
      return result;
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}

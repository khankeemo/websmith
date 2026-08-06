import * as http from 'http';
import * as https from 'https';
import { generateTimestamp, generateNonce, signRequest } from './crypto';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';

export const SDK_VERSION = '{{SDK_VERSION}}';
export const RUNTIME_TYPE = '{{RUNTIME_TYPE}}';

// ====================================================================
// LiveLog — Runtime Event Logging
// ====================================================================

export class LiveLog {
  private static _log: Array<{ timestamp: string; event: string; detail: string }> = [];

  static log(event: string, detail: string = ''): void {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0];
    const entry = `${timestamp} [${event}] ${detail}`;
    this._log.push({ timestamp, event, detail });
    console.log(entry);
  }

  static getLog(): Array<{ timestamp: string; event: string; detail: string }> {
    return [...this._log];
  }

  static clear(): void {
    this._log = [];
  }
}

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

  async sendOtp(email: string, purpose?: string): Promise<Record<string, any>> {
    return this._request('auth/otp/send', {
      email,
      purpose: purpose || 'trial_activation',
      product_id: this.productId,
      hardware_id: this._getHardwareId(),
    });
  }

  async verifyOtp(email: string, otp: string, purpose?: string): Promise<Record<string, any>> {
    return this._request('auth/otp/verify', {
      email,
      otp,
      purpose: purpose || 'trial_activation',
      product_id: this.productId,
      hardware_id: this._getHardwareId(),
    });
  }

  async validateLicense(licenseKey: string, hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload = { action: 'validate', license_key: licenseKey, hardware_id: hardwareId };
    const response = await this._request('license', payload);
    return response;
  }

  async validateLicenseByHardware(hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload = { action: 'validate', hardware_id: hardwareId };
    return this._request('license', payload);
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

  async getLicenseStatus(hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const url = `${this.baseUrl}/internal/backend/license/status?hardware_id=${encodeURIComponent(hardwareId)}`;
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const transport = isHttps ? https : http;
      const options: http.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: this.timeout * 1000,
      };
      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve({ success: false, status: 'no_license' }); }
        });
      });
      req.on('error', () => resolve({ success: false, status: 'no_license' }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, status: 'no_license' }); });
      req.end();
    });
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

  async getSupportConversation(requestId: string, hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    return this._request(`support/${requestId}/messages`, { hardware_id: hardwareId });
  }

  async replyToSupportRequest(requestId: string, message: string, customerName?: string, customerEmail?: string, hardwareId?: string): Promise<Record<string, any>> {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload: Record<string, any> = { message };
    if (customerName) payload.customer_name = customerName;
    if (customerEmail) payload.customer_email = customerEmail;
    if (hardwareId) payload.hardware_id = hardwareId;
    return this._request(`support/${requestId}/reply`, payload);
  }

  // ====================================================================
  // Universal Communication Engine
  // ====================================================================

  async createCommunication(params: Record<string, any>): Promise<Record<string, any>> {
    return this._request('communication/create', {
      category: params.category,
      customer_email: params.customer_email,
      customer_name: params.customer_name,
      subject: params.subject || '',
      message: params.message,
      product_id: params.product_id || this.productId,
      license_key: params.license_key || '',
      hardware_id: params.hardware_id || this._getHardwareId(),
      sdk_version: params.sdk_version || SDK_VERSION,
      runtime_type: params.runtime_type || RUNTIME_TYPE,
    });
  }

  async getConversation(conversationId: string): Promise<Record<string, any>> {
    return this._request(`communication/${conversationId}`, {
      hardware_id: this._getHardwareId(),
    });
  }

  async replyToConversation(conversationId: string, message: string, customerName?: string, customerEmail?: string): Promise<Record<string, any>> {
    const payload: Record<string, any> = { message };
    if (customerName) payload.customer_name = customerName;
    if (customerEmail) payload.customer_email = customerEmail;
    payload.hardware_id = this._getHardwareId();
    return this._request(`communication/${conversationId}/reply`, payload);
  }

  async listConversations(email: string): Promise<Record<string, any>> {
    return this._request('communication/list', {
      customer_email: email,
      hardware_id: this._getHardwareId(),
    });
  }

  async uploadAttachment(conversationId: string, filePath: string, fileContent?: string): Promise<Record<string, any>> {
    return this._request(`communication/${conversationId}/attach`, {
      file_path: filePath,
      file_content: fileContent || '',
      hardware_id: this._getHardwareId(),
    });
  }

  // ====================================================================
  // Notifications
  // ====================================================================

  async getNotifications(email: string): Promise<Record<string, any>> {
    return this._request('notifications', {
      customer_email: email,
      hardware_id: this._getHardwareId(),
    });
  }

  async markNotificationRead(notificationId: string): Promise<Record<string, any>> {
    return this._request('notifications/read', {
      notification_id: notificationId,
      hardware_id: this._getHardwareId(),
    });
  }

  async getUnreadNotificationCount(email: string): Promise<Record<string, any>> {
    return this._request('notifications/unread-count', {
      customer_email: email,
      hardware_id: this._getHardwareId(),
    });
  }

  // ====================================================================
  // Registration
  // ====================================================================

  async registerCustomer(params: Record<string, any>): Promise<Record<string, any>> {
    return this._request('customer/register', {
      name: params.name,
      email: params.email,
      mobile: params.mobile,
      country_code: params.country_code || '',
      company: params.company || '',
      hardware_id: params.hardware_id || this._getHardwareId(),
    });
  }

  // ====================================================================
  // Available Plans
  // ====================================================================

  async getAvailablePlans(licenseKey: string): Promise<Record<string, any>> {
    return this._request('license/available-plans', {
      license_key: licenseKey,
      hardware_id: this._getHardwareId(),
    });
  }

  // ====================================================================
  // Reactivation
  // ====================================================================

  async sendReactivationRequest(params: Record<string, any>): Promise<Record<string, any>> {
    return this._request('reactivations', {
      license_key: params.license_key,
      customer_name: params.customer_name,
      customer_email: params.customer_email,
      hardware_id: this._getHardwareId(),
    });
  }

  // ====================================================================
  // Request History
  // ====================================================================

  async getRequestHistory(email: string): Promise<Record<string, any>> {
    return this._request('request', {
      customer_email: email,
      hardware_id: this._getHardwareId(),
    });
  }

  // ====================================================================
  // Store Products
  // ====================================================================

  async getProducts(): Promise<Record<string, any>> {
    return this._request('store/products', { action: 'list' });
  }
}

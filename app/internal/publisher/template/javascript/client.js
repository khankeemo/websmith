import { HardwareDetector } from './hardware.js';
import { CacheManager } from './cache.js';
import { generateTimestamp, generateNonce, signRequest } from './crypto.js';

export const SDK_VERSION = '${kit_version}';
export const RUNTIME_TYPE = '${runtime}';
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

export class ApiError extends Error {
  constructor(statusCode, message, data) {
    super(`API Error ${statusCode}: ${message}`);
    this.statusCode = statusCode;
    this.data = data || {};
  }
}

function getTransport() {
  return typeof fetch !== 'undefined' ? 'fetch' :
         typeof XMLHttpRequest !== 'undefined' ? 'xhr' : null;
}

export class ApiClient {
  constructor(config, hardware, cache) {
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

  async _getHardwareId() {
    return await this._hardware.getFingerprint();
  }

  async _signRequest(payload, method, path, query) {
    const ts = generateTimestamp();
    const nonce = generateNonce();
    const sig = await signRequest(payload, this.apiSecret, ts, nonce, method, path, query);
    return { 'x-api-key': this.apiKey, 'x-timestamp': ts, 'x-nonce': nonce, 'x-signature': sig };
  }

  async _request(endpoint, payload, retries) {
    const url = `${this.baseUrl}/api/${this.apiVersion}/${endpoint}`;
    const maxRetries = retries ?? this.retryCount;
    const requestPayload = { ...payload };
    if (this.productId) requestPayload.product_id = requestPayload.product_id || this.productId;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const apiPath = `/api/${this.apiVersion}/${endpoint}`;
        const headers = await this._signRequest(requestPayload, 'POST', apiPath, '');
        headers['Content-Type'] = 'application/json';

        const transport = getTransport();
        let data;

        if (transport === 'fetch') {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeout);
          const response = await fetch(url, {
            method: 'POST', headers, body: JSON.stringify(requestPayload), signal: controller.signal,
          });
          clearTimeout(timeoutId);
          data = await response.json().catch(() => ({}));
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
        } else if (transport === 'xhr') {
          data = await this._xhrRequest(url, headers, JSON.stringify(requestPayload));
          if (data._status >= 200 && data._status < 300) {
            const { _status, ...clean } = data;
            return clean;
          }
          if (data._status === 429) {
            if (attempt < maxRetries) { await new Promise(r => setTimeout(r, (attempt + 1) * 2000)); continue; }
            throw new ApiError(429, 'Rate limit exceeded', data);
          }
          if (RETRYABLE_STATUSES.has(data._status)) {
            if (attempt < maxRetries) { await new Promise(r => setTimeout(r, (attempt + 1) * 2000)); continue; }
            throw new ApiError(data._status, 'Server error', data);
          }
          throw new ApiError(data._status, data.message || data.error || `HTTP ${data._status}`, data);
        } else {
          throw new ApiError(0, 'No available HTTP transport');
        }
      } catch (e) {
        if (e instanceof ApiError) throw e;
        if (attempt < maxRetries) { await new Promise(r => setTimeout(r, (attempt + 1) * 2000)); continue; }
        throw new ApiError(503, `Request failed: ${e.message}`);
      }
    }
    throw new ApiError(500, `Failed after ${maxRetries} retries`);
  }

  _xhrRequest(url, headers, body) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.timeout = this.timeout;
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText) || {};
          data._status = xhr.status;
          resolve(data);
        } catch {
          resolve({ _status: xhr.status, message: xhr.responseText });
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.ontimeout = () => reject(new Error('Timeout'));
      xhr.send(body);
    });
  }

  async validateLicense(licenseKey, hardwareId) {
    if (!hardwareId) hardwareId = await this._getHardwareId();
    if (this._cache && this._cache.isValid()) {
      const cached = this._cache.getLicenseStatus();
      if (cached) return cached;
    }
    const r = await this._request('license', { action: 'validate', license_key: licenseKey, hardware_id: hardwareId });
    if (this._cache && r.success && r.data?.valid) this._cache.setLicenseStatus(r);
    return r;
  }

  async activateLicense(licenseKey, hardwareId) {
    if (!hardwareId) hardwareId = await this._getHardwareId();
    const r = await this._request('license', { action: 'activate', license_key: licenseKey, hardware_id: hardwareId });
    if (this._cache) this._cache.invalidateLicenseStatus();
    return r;
  }

  async deactivateLicense(licenseKey, hardwareId) {
    if (!hardwareId) hardwareId = await this._getHardwareId();
    const r = await this._request('license', { action: 'deactivate', license_key: licenseKey, hardware_id: hardwareId });
    if (this._cache) this._cache.invalidateLicenseStatus();
    return r;
  }

  async renewLicense(licenseKey, extraDays) {
    const p = { action: 'renew', license_key: licenseKey };
    if (extraDays !== undefined) p.extra_days = extraDays;
    const r = await this._request('license', p);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return r;
  }

  async startTrial(email, customerName, customerData) {
    const hid = await this._getHardwareId();
    const p = { action: 'start', customer_email: email, customer_name: customerName || '', hardware_id: hid };
    if (customerData) p.customer_data = customerData;
    return this._request('trial', p);
  }

  async getTrialStatus(hardwareId) {
    if (!hardwareId) hardwareId = await this._getHardwareId();
    return this._request('trial', { action: 'status', hardware_id: hardwareId });
  }

  async convertTrial(hardwareId, plan, customerName, customerEmail) {
    if (!hardwareId) hardwareId = await this._getHardwareId();
    const p = { action: 'convert', hardware_id: hardwareId };
    if (plan) p.plan = plan;
    if (customerName) p.customer_name = customerName;
    if (customerEmail) p.customer_email = customerEmail;
    const r = await this._request('trial', p);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return r;
  }

  async bindDevice(licenseKey, hardwareId, deviceName) {
    if (!hardwareId) hardwareId = await this._getHardwareId();
    const p = { action: 'bind', license_key: licenseKey, hardware_id: hardwareId };
    if (deviceName) p.device_name = deviceName;
    return this._request('device', p);
  }

  async replaceDevice(licenseKey, newHardwareId, oldHardwareId) {
    if (!newHardwareId) newHardwareId = await this._getHardwareId();
    if (!oldHardwareId) throw new Error('old_hardware_id is required for device replacement');
    const r = await this._request('device', { action: 'replace', license_key: licenseKey, old_hardware_id: oldHardwareId, new_hardware_id: newHardwareId });
    if (this._cache) this._cache.invalidateLicenseStatus();
    return r;
  }

  async getProducts() {
    const payload = { action: 'list' };
    if (this.productId) payload.product_id = this.productId;
    try {
      return await this._request('store/products', payload);
    } catch {
      return { success: false, products: [] };
    }
  }

  async updateCustomer(name, email, phone, hardwareId) {
    if (!hardwareId) hardwareId = await this._getHardwareId();
    const payload = { action: 'update', name, email, mobile: phone, hardware_id: hardwareId };
    try {
      const result = await this._request('customer/register', payload);
      if (result.success && this._cache) this._cache.invalidateLicenseStatus();
      return result;
    } catch (e) { return { success: false, error: e.message }; }
  }
}

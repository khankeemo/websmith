const http = require('http');
const https = require('https');
const { generateTimestamp, generateNonce, signRequest } = require('./crypto');
const { HardwareDetector } = require('./hardware');

const SDK_VERSION = '${kit_version}';
const RUNTIME_TYPE = '${runtime}';
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

class ApiError extends Error {
  constructor(statusCode, message, data) {
    super(`API Error ${statusCode}: ${message}`);
    this.statusCode = statusCode;
    this.message = message;
    this.data = data || {};
  }
}

class ApiClient {
  constructor(config, hardware, cache) {
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

  _getHardwareId() {
    return this._hardware.getFingerprint();
  }

  _signRequest(payload, method, path, query) {
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

  _request(endpoint, payload, retries) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/api/${this.apiVersion}/${endpoint}`;
      const maxRetries = retries !== undefined ? retries : this.retryCount;
      const requestPayload = { ...payload };
      if (this.productId) {
        requestPayload.product_id = requestPayload.product_id || this.productId;
      }

      const attemptRequest = (attempt) => {
        const apiPath = `/api/${this.apiVersion}/${endpoint}`;
        const headers = this._signRequest(requestPayload, 'POST', apiPath, '');
        headers['Content-Type'] = 'application/json';

        const body = JSON.stringify(requestPayload);
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const transport = isHttps ? https : http;

        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers,
          timeout: this.timeout * 1000,
        };

        const req = transport.request(options, (res) => {
          let responseData = '';
          res.on('data', (chunk) => { responseData += chunk; });
          res.on('end', () => {
            let data = {};
            try {
              data = JSON.parse(responseData);
            } catch (_) {
              if (responseData) data = { message: responseData };
            }
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
              return;
            }
            if (res.statusCode === 429) {
              if (attempt < maxRetries) {
                const retryAfter = parseInt(res.headers['retry-after'] || '5', 10);
                setTimeout(() => attemptRequest(attempt + 1), retryAfter * 1000);
                return;
              }
              reject(new ApiError(429, 'Rate limit exceeded', data));
              return;
            }
            if (RETRYABLE_STATUSES.has(res.statusCode)) {
              if (attempt < maxRetries) {
                setTimeout(() => attemptRequest(attempt + 1), (attempt + 1) * 2000);
                return;
              }
              reject(new ApiError(res.statusCode, 'Server error', data));
              return;
            }
            const message = data.message || data.error || `HTTP ${res.statusCode}`;
            reject(new ApiError(res.statusCode, message, data));
          });
        });

        req.on('error', (err) => {
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

  async validateLicense(licenseKey, hardwareId) {
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

  async activateLicense(licenseKey, hardwareId) {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload = { action: 'activate', license_key: licenseKey, hardware_id: hardwareId };
    const response = await this._request('license', payload);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return response;
  }

  async deactivateLicense(licenseKey, hardwareId) {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload = { action: 'deactivate', license_key: licenseKey, hardware_id: hardwareId };
    const response = await this._request('license', payload);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return response;
  }

  async renewLicense(licenseKey, extraDays) {
    const payload = { action: 'renew', license_key: licenseKey };
    if (extraDays !== undefined) payload.extra_days = extraDays;
    const response = await this._request('license', payload);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return response;
  }

  async startTrial(email, customerName, customerData) {
    const hardwareId = this._getHardwareId();
    const payload = { action: 'start', customer_email: email, customer_name: customerName || '', hardware_id: hardwareId };
    if (customerData) payload.customer_data = customerData;
    return this._request('trial', payload);
  }

  async getTrialStatus(hardwareId) {
    if (!hardwareId) hardwareId = this._getHardwareId();
    return this._request('trial', { action: 'status', hardware_id: hardwareId });
  }

  async convertTrial(hardwareId, plan, customerName, customerEmail) {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload = { action: 'convert', hardware_id: hardwareId };
    if (plan) payload.plan = plan;
    if (customerName) payload.customer_name = customerName;
    if (customerEmail) payload.customer_email = customerEmail;
    const response = await this._request('trial', payload);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return response;
  }

  async bindDevice(licenseKey, hardwareId, deviceName) {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload = { action: 'bind', license_key: licenseKey, hardware_id: hardwareId };
    if (deviceName) payload.device_name = deviceName;
    return this._request('device', payload);
  }

  async replaceDevice(licenseKey, newHardwareId, oldHardwareId) {
    if (!newHardwareId) newHardwareId = this._getHardwareId();
    if (!oldHardwareId) throw new Error('old_hardware_id is required for device replacement');
    const payload = { action: 'replace', license_key: licenseKey, old_hardware_id: oldHardwareId, new_hardware_id: newHardwareId };
    const response = await this._request('device', payload);
    if (this._cache) this._cache.invalidateLicenseStatus();
    return response;
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

  async getLicenseStatus(hardwareId) {
    if (!hardwareId) hardwareId = this._getHardwareId();
    return new Promise((resolve, reject) => {
      const apiPath = '/internal/backend/license/status';
      const query = `hardware_id=${encodeURIComponent(hardwareId)}`;
      const url = `${this.baseUrl}${apiPath}?${query}`;
      const headers = this._signRequest({}, 'GET', apiPath, query);
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const transport = isHttps ? https : http;
      const req = transport.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers,
        timeout: this.timeout * 1000,
      }, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          let data = {};
          try {
            data = JSON.parse(responseData);
          } catch (_) {
            if (responseData) data = { message: responseData };
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
            return;
          }
          const message = data.message || data.error || `HTTP ${res.statusCode}`;
          reject(new ApiError(res.statusCode, message, data));
        });
      });
      req.on('error', (err) => {
        reject(new ApiError(503, `Connection error: ${err.message}`));
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new ApiError(504, 'Request timeout'));
      });
      req.end();
    });
  }

  async updateCustomer(name, email, phone, hardwareId) {
    if (!hardwareId) hardwareId = this._getHardwareId();
    const payload = { action: 'update', name, email, mobile: phone, hardware_id: hardwareId };
    try {
      const result = await this._request('customer/register', payload);
      if (result.success && this._cache) this._cache.invalidateLicenseStatus();
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = { ApiClient, ApiError, SDK_VERSION, RUNTIME_TYPE };

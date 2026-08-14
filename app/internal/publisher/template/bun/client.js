import os from 'os';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const API_URL = process.env['WEBSMITH_API_URL'] || '${api_url}';
const VERSION = '${kit_version}';

// ── HMAC-SHA256 ──────────────────────────────────────────────────────
async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── ApiError ─────────────────────────────────────────────────────────
class ApiError extends Error {
  constructor(status, body, headers) {
    super(`API Error: ${status} — ${body}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

// ── Client ───────────────────────────────────────────────────────────
class Client {
  constructor(apiKey, apiUrl = API_URL) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl.replace(/\/+$/, '');
  }

  async request(method, endpoint, data = undefined, retries = 3) {
    const url = `${this.apiUrl}${endpoint}`;
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
    const bodyStr = data ? JSON.stringify(data) : '';
    const signStr = `${timestamp}${nonce}${method}${endpoint}${bodyStr}`;
    const signature = await hmacSha256(this.apiKey, signStr);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'x-timestamp': timestamp,
            'x-nonce': nonce,
            'x-signature': signature,
          },
          body: bodyStr || undefined,
        });
        if (!response.ok) {
          const errBody = await response.text();
          throw new ApiError(response.status, errBody, response.headers);
        }
        return await response.json();
      } catch (err) {
        if (attempt < retries) {
          if (err instanceof ApiError && err.status < 500) throw err;
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        throw err;
      }
    }
  }

  validateLicense(licenseKey, hardwareId) {
    return this.request('POST', '/api/v1/license', { action: 'validate', license_key: licenseKey, hardware_id: hardwareId });
  }

  activateLicense(licenseKey, hardwareId, deviceName) {
    return this.request('POST', '/api/v1/license', { action: 'activate', license_key: licenseKey, hardware_id: hardwareId, device_name: deviceName });
  }

  deactivateLicense(licenseKey, hardwareId) {
    return this.request('POST', '/api/v1/license', { action: 'deactivate', license_key: licenseKey, hardware_id: hardwareId });
  }

  renewLicense(licenseKey) {
    return this.request('POST', '/api/v1/license', { action: 'renew', license_key: licenseKey });
  }

  bindDevice(licenseKey, hardwareId, deviceName) {
    return this.request('POST', '/api/v1/license', { action: 'bind_device', license_key: licenseKey, hardware_id: hardwareId, device_name: deviceName });
  }

  startTrial(email, customerName = '', customerData = null) {
    const payload = { action: 'start', customer_email: email, customer_name: customerName };
    if (customerData) Object.assign(payload, customerData);
    return this.request('POST', '/api/v1/trial', payload);
  }

  checkTrial(hardwareId) {
    return this.request('POST', '/api/v1/trial', { action: 'status', hardware_id: hardwareId });
  }

  convertTrial(hardwareId, plan, name, email) {
    return this.request('POST', '/api/v1/trial', { action: 'convert', hardware_id: hardwareId, plan, customer_name: name, customer_email: email });
  }

  getTrialStatus(hardwareId) {
    return this.request('POST', '/api/v1/trial', { action: 'status', hardware_id: hardwareId });
  }

  getProducts() {
    return this.request('POST', '/api/v1/store/products', { action: 'list' });
  }

  static async loadConfig(configPath = 'config/api-config.json') {
    const file = Bun.file(configPath);
    try {
      const exists = await file.exists();
      if (!exists) return {};
      return await file.json();
    } catch {
      return {};
    }
  }
}

// ── HardwareFingerprint ──────────────────────────────────────────────
class HardwareFingerprint {
  static async generate() {
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || '';
    const motherboard = os.machine();
    const interfaces = os.networkInterfaces();
    const macs = [];
    for (const name of Object.keys(interfaces ?? {})) {
      for (const iface of (interfaces[name] || [])) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          macs.push(iface.mac);
        }
      }
    }
    const combined = [cpuModel, motherboard, ...macs.slice(0, 3), os.platform(), os.release()].join('|');
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined));
    const fingerprint = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return { fingerprint, macAddresses: macs.slice(0, 3), cpu: cpuModel, motherboard, os: os.platform(), release: os.release() };
  }
}

// ── CacheManager ─────────────────────────────────────────────────────
class CacheManager {
  constructor(cacheDir = './cache', ttl = 0) {
    this.cacheDir = cacheDir;
    this.ttl = ttl;
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async get(key) {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();
      if (!exists) return null;
      const data = await file.json();
      if (Date.now() - data.cachedAt > this.ttl) {
        await this.delete(key);
        return null;
      }
      return data.value;
    } catch {
      return null;
    }
  }

  async set(key, value) {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    const tmpPath = filePath + '.tmp';
    const payload = { value, cachedAt: Date.now() };
    await Bun.write(tmpPath, JSON.stringify(payload));
    try {
      fs.renameSync(tmpPath, filePath);
    } catch {
      await Bun.write(filePath, JSON.stringify(payload));
      try { fs.unlinkSync(tmpPath); } catch { /* ok */ }
    }
  }

  async delete(key) {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    try { fs.unlinkSync(filePath); } catch { /* ok */ }
  }
}

// ── LicenseEngine ────────────────────────────────────────────────────
class LicenseEngine {
  constructor() {
    this.client = null;
    this.cache = null;
    this._licenseData = null;
    this._fingerprintPromise = null;
  }

  async initialize(configPath = 'config/api-config.json') {
    const configFile = Bun.file(configPath);
    let config = {};
    try {
      const exists = await configFile.exists();
      if (exists) config = await configFile.json();
    } catch { /* ok */ }
    const apiKey = config.apiKey || config.api_key || '';
    const baseUrl = config.apiUrl || config.api_url || API_URL;
    this.client = new Client(apiKey, baseUrl);
    this.cache = new CacheManager(
      config.cacheDir || './cache',
      config.cacheTtl ?? 0
    );
    this._fingerprintPromise = HardwareFingerprint.generate();

    const cached = await this.cache.get('license');
    if (cached) this._licenseData = cached;

    return { apiKey, baseUrl };
  }

  async validate(licenseKey) {
    const fp = await this._fingerprintPromise;
    const result = await this.client.validateLicense(licenseKey, fp.fingerprint);
    if (result.license) {
      this._licenseData = result.license;
      await this.cache.set('license', result.license);
    }
    return result;
  }

  async activate(licenseKey, deviceName) {
    const fp = await this._fingerprintPromise;
    const result = await this.client.activateLicense(licenseKey, fp.fingerprint, deviceName);
    if (result.license) {
      this._licenseData = result.license;
      await this.cache.set('license', result.license);
      await this.cache.set('licenseKey', licenseKey);
    }
    return result;
  }

  async deactivate(licenseKey) {
    const fp = await this._fingerprintPromise;
    const result = await this.client.deactivateLicense(licenseKey, fp.fingerprint);
    this._licenseData = null;
    await this.cache.delete('license');
    return result;
  }

  async renew(licenseKey) {
    const result = await this.client.renewLicense(licenseKey);
    if (result.license) {
      this._licenseData = result.license;
      await this.cache.set('license', result.license);
    }
    return result;
  }

  async startTrial(email, customerName = '', customerData = null) {
    return this.client.startTrial(email, customerName, customerData);
  }

  async checkTrial(hardwareId) {
    const fp = await this._fingerprintPromise;
    return this.client.checkTrial(hardwareId || fp.fingerprint);
  }

  async convertTrial(plan, name, email) {
    const fp = await this._fingerprintPromise;
    return this.client.convertTrial(fp.fingerprint, plan, name, email);
  }

  async viewHardwareStatus() {
    const fp = await this._fingerprintPromise;
    const currentHwId = fp.fingerprint;
    let registeredHwId = '';
    if (this._licenseData?.license_key) {
      const status = await this.validate(this._licenseData.license_key);
      registeredHwId = status?.license?.hardware_id || '';
    }
    return { matched: currentHwId === registeredHwId, current_hardware_id: currentHwId, registered_hardware_id: registeredHwId };
  }

  async bindDevice(licenseKey, deviceName) {
    const fp = await this._fingerprintPromise;
    return this.client.bindDevice(licenseKey, fp.fingerprint, deviceName);
  }

  hasLicenseKey() {
    return this._licenseData && !!this._licenseData.license_key;
  }

  isValid() {
    if (!this._licenseData || this._licenseData.status !== 'active') return false;
    if (this._licenseData.expires_at) {
      try {
        if (new Date(this._licenseData.expires_at) < new Date()) return false;
      } catch {
        return false;
      }
    }
    return true;
  }

  getLicenseInfo() {
    return this._licenseData ? { ...this._licenseData } : null;
  }
}

export { Client, ApiError, LicenseEngine, HardwareFingerprint, CacheManager };

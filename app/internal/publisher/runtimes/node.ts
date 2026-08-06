import type { PublisherContext } from '../index';

export function getNodeTemplates(context: PublisherContext): Record<string, string> {
  const apiUrl = process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  const prodId = context.productId;
  const prodName = context.productName;
  const kitVer = context.kitVersion;
  const maxDev = context.maxDevices ?? 1;
  const trialDays = context.trialDays ?? 7;
  const supportEmail = context.supportEmail || 'support@websmithdigital.com';
  const defKey = context.apiKey || '';

  return {
    'index.js': `"use strict";
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const readline = require('readline');

// ─── Config ──────────────────────────────────────────────
let _config = null;
function loadConfig() {
  if (_config) return _config;
  const cfgPath = path.join(__dirname, 'config', 'api-config.json');
  try {
    _config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    return _config;
  } catch (_) {
    _config = {
      api: {
        url: '${apiUrl}',
        public_key: '${defKey}',
        secret: '',
        version: 'v1',
        timeout: 30000,
        retry_count: 3,
      },
      product: { id: '${prodId}', name: '${prodName}' },
      license: {
        cache_ttl_days: 0,
        max_devices: ${maxDev},
        trial_days: ${trialDays},
        trial_enabled: true,
      },
      support: { email: '${supportEmail}' },
    };
    return _config;
  }
}

function getApi() { return loadConfig().api || {}; }
function getProduct() { return loadConfig().product || {}; }

// ─── ApiError ────────────────────────────────────────────
class ApiError extends Error {
  constructor(statusCode, message, data) {
    super(message);
    this.statusCode = statusCode;
    this.status_code = statusCode;
    this.data = data || {};
    this.name = 'ApiError';
  }
}

// ─── Crypto helpers ─────────────────────────────────────
function _timestamp() {
  return new Date().toISOString();
}

function _nonce() {
  return crypto.randomUUID();
}

function _sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf-8').digest('hex');
}

function _hmacSign(body, secret, ts, nonce, method, pathStr, query) {
  const bodyHash = _sha256(JSON.stringify(body));
  const sep = String.fromCharCode(92, 110);
  const msg = method + sep + pathStr + sep + query + sep + bodyHash + sep + ts + sep + nonce;
  const h = crypto.createHmac('sha256', secret);
  h.update(msg, 'utf-8');
  return h.digest('base64');
}

// ─── Hardware Fingerprint ───────────────────────────────
// CPU → machine type → primary MAC (per ADR-001)
class HardwareFingerprint {
  static generate() {
    const parts = [];
    const cpus = os.cpus();
    let cpuModel = '';
    if (cpus && cpus.length > 0 && cpus[0].model) {
      cpuModel = cpus[0].model;
      parts.push(cpuModel);
    }
    let machineType = '';
    try {
      machineType = os.machine();
    } catch (_) {
      machineType = os.arch() + '-' + os.platform();
    }
    parts.push(machineType);
    let primaryMac = '';
    const ifaces = os.networkInterfaces();
    if (ifaces) {
      const names = Object.keys(ifaces).sort();
      for (const name of names) {
        const list = ifaces[name];
        if (!list) continue;
        for (const iface of list) {
          if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
            primaryMac = iface.mac;
            break;
          }
        }
        if (primaryMac) break;
      }
    }
    if (primaryMac) parts.push(primaryMac);
    const fingerprint = _sha256(parts.join('|'));
    return { fingerprint, cpu: cpuModel, os: os.platform() + ' ' + os.release(), mac: primaryMac };
  }
}

// ─── CacheManager ───────────────────────────────────────
class CacheManager {
  constructor() {
    const cfg = loadConfig();
    const prod = cfg.product || {};
    this.productId = prod.id || 'unknown';
    const safe = this.productId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
    this._dir = path.join(home, '.websmith', safe);
    this._file = path.join(this._dir, 'cache.json');
    this._tmp = path.join(this._dir, 'cache.tmp');
    this._corrupt = path.join(this._dir, 'cache.corrupt');
    this._ttlDays = (cfg.license || {}).cache_ttl_days ?? 0;
    this._cache = null;
  }

  _ensure() {
    if (!fs.existsSync(this._dir)) fs.mkdirSync(this._dir, { recursive: true });
  }

  _load() {
    if (this._cache !== null) return this._cache;
    this._ensure();
    try {
      if (fs.existsSync(this._file)) {
        this._cache = JSON.parse(fs.readFileSync(this._file, 'utf-8'));
        return this._cache;
      }
    } catch (_) { this._preserveCorrupt(); }
    this._cache = {};
    return this._cache;
  }

  _save() {
    if (this._cache === null) return;
    this._ensure();
    try {
      fs.writeFileSync(this._tmp, JSON.stringify(this._cache, null, 2), 'utf-8');
      fs.renameSync(this._tmp, this._file);
    } catch (_) {
      try { if (fs.existsSync(this._tmp)) fs.unlinkSync(this._tmp); } catch (_) {}
    }
  }

  _preserveCorrupt() {
    try {
      if (fs.existsSync(this._file)) {
        if (fs.existsSync(this._corrupt)) fs.unlinkSync(this._corrupt);
        fs.renameSync(this._file, this._corrupt);
      }
    } catch (_) {
      try { if (fs.existsSync(this._file)) fs.unlinkSync(this._file); } catch (_) {}
    }
  }

  _expired(entry) {
    if (!entry || !entry.cached_at) return true;
    return (Date.now() / 1000 - entry.cached_at) > this._ttlDays * 86400;
  }

  get(key) {
    const c = this._load();
    const e = c[key];
    if (!e) return null;
    if (this._expired(e)) { this.delete(key); return null; }
    return e.value;
  }

  set(key, value) {
    const c = this._load();
    c[key] = { value: value, cached_at: Date.now() / 1000 };
    this._save();
  }

  delete(key) {
    const c = this._load();
    if (key in c) { delete c[key]; this._save(); }
  }

  clear() { this._cache = {}; this._save(); }

  isCacheValid() {
    const e = this._load().license_status;
    return !!e && !this._expired(e);
  }

  getLicenseStatus() { return this.get('license_status'); }
  setLicenseStatus(s) { this.set('license_status', s); }
  invalidateLicenseStatus() { this.delete('license_status'); }
}

// ─── Client ─────────────────────────────────────────────
class Client {
  constructor() {
    const cfg = loadConfig();
    const api = cfg.api || {};
    this.baseUrl = (api.url || '').replace(/\\/+$/, '');
    this.apiVersion = api.version || 'v1';
    this.apiKey = api.public_key || '';
    this.apiSecret = api.secret || '';
    this.timeout = api.timeout || 30000;
    this.retryCount = api.retry_count || 3;
    this.productId = (cfg.product || {}).id || '';
    this._cache = new CacheManager();
  }

  _hwId() { return HardwareFingerprint.generate().fingerprint; }

  _sign(body, method, p, q) {
    const ts = _timestamp();
    const nonce = _nonce();
    return {
      'x-api-key': this.apiKey,
      'x-timestamp': ts,
      'x-nonce': nonce,
      'x-signature': _hmacSign(body, this.apiSecret, ts, nonce, method, p, q),
    };
  }

  _request(endpoint, payload) {
    return new Promise((resolve, reject) => {
      const urlPath = '/api/' + this.apiVersion + '/' + endpoint;
      const url = this.baseUrl + urlPath;
      const parsed = new URL(url);
      const body = Object.assign({}, payload);
      if (this.productId && !body.product_id) body.product_id = this.productId;
      const attempt = (n) => {
        const headers = this._sign(body, 'POST', urlPath, '');
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body), 'utf-8');
        const opts = {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname,
          method: 'POST',
          headers: headers,
          timeout: this.timeout,
        };
        const mod = parsed.protocol === 'https:' ? https : http;
        const req = mod.request(opts, (res) => {
          let raw = '';
          res.on('data', (c) => raw += c);
          res.on('end', () => {
            let data = {};
            try { data = JSON.parse(raw); } catch (_) { if (raw) data = { message: raw }; }
            if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data);
            if (res.statusCode === 429) {
              if (n < this.retryCount) {
                const wait = parseInt(res.headers['retry-after'] || '5', 10);
                return setTimeout(() => attempt(n + 1), wait * 1000);
              }
              return reject(new ApiError(429, 'Rate limit exceeded', data));
            }
            if (res.statusCode >= 500) {
              if (n < this.retryCount) {
                return setTimeout(() => attempt(n + 1), Math.pow(2, n) * 1000);
              }
              return reject(new ApiError(res.statusCode, 'Server error', data));
            }
            const msg = data.message || data.error || 'HTTP ' + res.statusCode;
            reject(new ApiError(res.statusCode, msg, data));
          });
        });
        req.on('error', (err) => {
          if (n < this.retryCount) return setTimeout(() => attempt(n + 1), Math.pow(2, n) * 1000);
          reject(new ApiError(503, 'Connection error: ' + err.message));
        });
        req.on('timeout', () => {
          req.destroy();
          if (n < this.retryCount) return setTimeout(() => attempt(n + 1), Math.pow(2, n) * 1000);
          reject(new ApiError(504, 'Request timeout'));
        });
        req.write(JSON.stringify(body));
        req.end();
      };
      attempt(0);
    });
  }

  validateLicense(licenseKey, hardwareId) {
    const payload = { action: 'validate', license_key: licenseKey, hardware_id: hardwareId };
    if (this._cache.isCacheValid()) {
      const cached = this._cache.getLicenseStatus();
      if (cached) return Promise.resolve(cached);
    }
    return this._request('license', payload).then((res) => {
      if (res.valid || res.status === 'active') this._cache.setLicenseStatus(res);
      return res;
    });
  }

  activateLicense(licenseKey, hardwareId) {
    return this._request('license', { action: 'activate', license_key: licenseKey, hardware_id: hardwareId })
      .then((r) => { this._cache.invalidateLicenseStatus(); return r; });
  }

  deactivateLicense(licenseKey, hardwareId) {
    return this._request('license', { action: 'deactivate', license_key: licenseKey, hardware_id: hardwareId })
      .then((r) => { this._cache.invalidateLicenseStatus(); return r; });
  }

  renewLicense(licenseKey, extraDays) {
    const p = { action: 'renew', license_key: licenseKey };
    if (extraDays != null) p.extra_days = extraDays;
    return this._request('license', p)
      .then((r) => { this._cache.invalidateLicenseStatus(); return r; });
  }

  startTrial(email, customerName, customerData) {
    const p = { action: 'start', customer_email: email, customer_name: customerName || '', hardware_id: this._hwId() };
    if (customerData) p.customer_data = customerData;
    return this._request('trial', p);
  }

  checkTrial(hardwareId) {
    return this._request('trial', { action: 'status', hardware_id: hardwareId || this._hwId() });
  }

  convertTrial(hardwareId, plan, name, email) {
    const p = { action: 'convert', hardware_id: hardwareId || this._hwId() };
    if (plan) p.plan = plan;
    if (name) p.customer_name = name;
    if (email) p.customer_email = email;
    return this._request('trial', p)
      .then((r) => { this._cache.invalidateLicenseStatus(); return r; });
  }

  bindDevice(licenseKey, hardwareId, deviceName) {
    const p = { action: 'bind', license_key: licenseKey, hardware_id: hardwareId || this._hwId() };
    if (deviceName) p.device_name = deviceName;
    return this._request('device', p)
      .then((r) => { this._cache.invalidateLicenseStatus(); return r; });
  }

  getTrialStatus(hardwareId) {
    return this._request('trial', { action: 'status', hardware_id: hardwareId || this._hwId() });
  }

  getProducts() {
    return this._request('store/products', { action: 'list', product_id: this.productId });
  }
}

// ─── LicenseEngine ──────────────────────────────────────
class LicenseEngine {
  constructor() {
    this._client = new Client();
    this._cache = new CacheManager();
    this._fp = null;
    this._data = null;
    this._key = null;
  }

  _hw() {
    if (!this._fp) this._fp = HardwareFingerprint.generate().fingerprint;
    return this._fp;
  }

  async initialize() {
    if (this._cache.isCacheValid()) {
      const cached = this._cache.getLicenseStatus();
      if (cached) { this._data = cached; return cached; }
    }
    try {
      const result = await this._client.validateLicense(this._hw());
      this._data = result;
      this._cache.setLicenseStatus(result);
      return result;
    } catch (err) {
      const cached = this._cache.getLicenseStatus();
      if (cached) { this._data = cached; return cached; }
      throw err;
    }
  }

  async activate(key, deviceName) {
    const result = await this._client.activateLicense(key, this._hw());
    if (result.success || result.status === 'active') {
      this._key = key;
      await this.initialize();
    }
    return result;
  }

  async validate(key) {
    const result = await this._client.validateLicense(key, this._hw());
    this._data = result;
    if (key) this._key = key;
    return result;
  }

  async deactivate(key) {
    const k = key || this._key;
    if (!k) throw new Error('License key unavailable');
    const result = await this._client.deactivateLicense(k, this._hw());
    if (result.success) {
      this._cache.invalidateLicenseStatus();
      this._data = null;
      if (!key) this._key = null;
    }
    return result;
  }

  async renew(key) {
    const k = key || this._key;
    if (!k) throw new Error('License key unavailable');
    const result = await this._client.renewLicense(k);
    if (result.success) await this.initialize();
    return result;
  }

  async startTrial(email, name) {
    const result = await this._client.startTrial(email, name || '');
    if (result.success) await this.initialize();
    return result;
  }

  async checkTrial(hardwareId) {
    return this._client.checkTrial(hardwareId || this._hw());
  }

  async convertTrial(hardwareId, plan, name, email) {
    const result = await this._client.convertTrial(hardwareId || this._hw(), plan, name, email);
    if (result.success) {
      if (result.license_key) this._key = result.license_key;
      await this.initialize();
    }
    return result;
  }

  async bindDevice(licenseKey, deviceName) {
    const k = licenseKey || this._key;
    if (!k) throw new Error('License key unavailable');
    const result = await this._client.bindDevice(k, this._hw(), deviceName || '');
    if (result.success) await this.initialize();
    return result;
  }

  async viewHardwareStatus() {
    const currentHwId = this._hw();
    const status = await this.validate();
    const registeredHwId = status?.data?.hardware_id || '';
    return { matched: currentHwId === registeredHwId, current_hardware_id: currentHwId, registered_hardware_id: registeredHwId };
  }

  hasLicenseKey() { return this._key != null; }

  isValid() {
    if (!this._data) return false;
    const st = this._data.status || this._data.license_status;
    if (st !== 'active' && st !== 'trial') return false;
    if (this._data.expires_at && new Date(this._data.expires_at) < new Date()) return false;
    return true;
  }

  getLicenseInfo() { return this._data ? Object.assign({}, this._data) : null; }
}

module.exports = { Client, ApiError, LicenseEngine, HardwareFingerprint, CacheManager };
`,
    'package.json': `{
  "name": "wsd-${prodId}-sdk",
  "version": "${kitVer}",
  "description": "SDK for ${prodName}",
  "main": "index.js",
  "type": "commonjs",
  "license": "MIT"
}`,
    'README.md': `# ${prodName} SDK (Node.js)

## Installation
\`\`\`bash
npm install wsd-${prodId}-sdk
\`\`\`

## Configuration
Place \`api-config.json\` in \`./config/\` next to \`index.js\`:

\`\`\`json
{
  "api": {
    "url": "${apiUrl}",
    "public_key": "your_public_key",
    "secret": "your_hmac_secret",
    "version": "v1",
    "timeout": 30000,
    "retry_count": 3
  },
  "product": {
    "id": "${prodId}",
    "name": "${prodName}"
  },
  "license": {
    "cache_ttl_days": 0,
    "max_devices": ${maxDev},
    "trial_days": ${trialDays},
    "trial_enabled": true
  },
  "support": {
    "email": "${supportEmail}"
  }
}
\`\`\`

## Quick Start
\`\`\`javascript
const { Client, LicenseEngine } = require('wsd-${prodId}-sdk');

async function main() {
  const engine = new LicenseEngine();
  const info = await engine.initialize();
  console.log('Status:', info.status || info.license_status);
}
main().catch(console.error);
\`\`\`

## Initialize & Validate
\`\`\`javascript
const { LicenseEngine } = require('wsd-${prodId}-sdk');
const engine = new LicenseEngine();

async function check() {
  const result = await engine.initialize();
  if (engine.isValid()) console.log('License is valid');
  else console.log('License is not valid');
}
\`\`\`

## Start Trial
\`\`\`javascript
const { LicenseEngine } = require('wsd-${prodId}-sdk');
const engine = new LicenseEngine();

async function trial() {
  const result = await engine.startTrial('user@example.com', 'John Doe');
  console.log('Trial started:', result);
}
\`\`\`

## Convert Trial to License
\`\`\`javascript
const { LicenseEngine } = require('wsd-${prodId}-sdk');
const engine = new LicenseEngine();

async function convert() {
  const result = await engine.convertTrial(null, 'premium', 'John Doe', 'user@example.com');
  console.log('Converted:', result);
}
\`\`\`

## Activate License
\`\`\`javascript
const { LicenseEngine } = require('wsd-${prodId}-sdk');
const engine = new LicenseEngine();

async function activate() {
  const result = await engine.activate('XXXX-XXXX-XXXX-XXXX', 'My Workstation');
  console.log('Activated:', result);
}
\`\`\`

## Renew License
\`\`\`javascript
const { LicenseEngine } = require('wsd-${prodId}-sdk');
const engine = new LicenseEngine();

async function renewLicense() {
  await engine.activate('XXXX-XXXX-XXXX-XXXX');
  const result = await engine.renew();
  console.log('Renewed:', result);
}
\`\`\`

## View Hardware Status
\`\`\`javascript
const { LicenseEngine } = require('wsd-${prodId}-sdk');
const engine = new LicenseEngine();

async function viewHw() {
  await engine.activate('XXXX-XXXX-XXXX-XXXX');
  const result = await engine.viewHardwareStatus();
  console.log('Hardware status:', result);
}
\`\`\`
## Deactivate License
\`\`\`javascript
const { LicenseEngine } = require('wsd-${prodId}-sdk');
const engine = new LicenseEngine();

async function deactivate() {
  await engine.activate('XXXX-XXXX-XXXX-XXXX');
  const result = await engine.deactivate();
  console.log('Deactivated:', result);
}
\`\`\`

## Bind Device
\`\`\`javascript
const { LicenseEngine } = require('wsd-${prodId}-sdk');
const engine = new LicenseEngine();

async function bind() {
  const result = await engine.bindDevice('XXXX-XXXX-XXXX-XXXX', 'My Laptop');
  console.log('Bound:', result);
}
\`\`\`

## HMAC Request Signing
All requests are signed with HMAC-SHA256:

\`\`\`
{method}\\n{path}\\n{query}\\n{sha256(body)}\\n{timestamp}\\n{nonce}
\`\`\`

Headers:
- \`x-api-key\` — Public API key
- \`x-timestamp\` — ISO 8601 UTC timestamp
- \`x-nonce\` — UUID v4
- \`x-signature\` — Base64 HMAC-SHA256

## API Endpoints
| Action | Method | Endpoint |
|--------|--------|----------|
| Validate | POST | \`/api/v1/license\` |
| Activate | POST | \`/api/v1/license\` |
| Deactivate | POST | \`/api/v1/license\` |
| Renew | POST | \`/api/v1/license\` |
| Start Trial | POST | \`/api/v1/trial\` |
| Check Trial | POST | \`/api/v1/trial\` |
| Convert Trial | POST | \`/api/v1/trial\` |
| View Hardware Status | POST | \`/api/v1/license\` |
| Bind Device | POST | \`/api/v1/device\` |
`,
  };
}

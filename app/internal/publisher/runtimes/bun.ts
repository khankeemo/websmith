import { PublisherContext } from '../index';

export function getBunTemplates(context: PublisherContext): Record<string, string> {
  const apiUrl = process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  return {
    'client.js': `import os from 'os';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const API_URL = process.env['WEBSMITH_API_URL'] || '${apiUrl}';
const VERSION = '${context.kitVersion}';

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
    super(\`API Error: \${status} — \${body}\`);
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
    this.apiUrl = apiUrl.replace(/\\/+$/, '');
  }

  async request(method, endpoint, data = undefined, retries = 3) {
    const url = \`\${this.apiUrl}\${endpoint}\`;
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
    const bodyStr = data ? JSON.stringify(data) : '';
    const signStr = \`\${timestamp}\${nonce}\${method}\${endpoint}\${bodyStr}\`;
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

  replaceHardware(licenseKey, newHardwareId, reason) {
    return this.request('POST', '/api/v1/license', { action: 'replace_hardware', license_key: licenseKey, new_hardware_id: newHardwareId, reason: reason || 'manual' });
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
    const filePath = path.join(this.cacheDir, \`\${key}.json\`);
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
    const filePath = path.join(this.cacheDir, \`\${key}.json\`);
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
    const filePath = path.join(this.cacheDir, \`\${key}.json\`);
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

  async replaceHardware(licenseKey, newHwId, reason) {
    return this.client.replaceHardware(licenseKey, newHwId, reason);
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

// ── WelcomeDialog ────────────────────────────────────────────────────
class WelcomeDialog {
  static show(message) {
    console.log(message);
  }

  static async confirm(message) {
    process.stdout.write(message + ' (yes/no): ');
    const answer = await WelcomeDialog._readLine();
    return /^y(?:es)?$/i.test(answer.trim());
  }

  static async prompt(question) {
    process.stdout.write(question + ': ');
    return await WelcomeDialog._readLine();
  }

  static async _readLine() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
      rl.once('line', line => { rl.close(); resolve(line); });
    });
  }
}

export { Client, ApiError, LicenseEngine, HardwareFingerprint, CacheManager, WelcomeDialog };
`,
    'package.json': `{
  "name": "${context.productName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-sdk",
  "version": "${context.kitVersion}",
  "description": "SDK for ${context.productName} — Bun runtime",
  "module": "client.js",
  "type": "module",
  "license": "MIT",
  "keywords": ["websmith", "license", "sdk", "bun"]
}`,
    'README.md': `# ${context.productName} SDK (Bun)

Full-featured Bun SDK for license validation, trial management, hardware binding, and device activation.

## Installation

\`\`\`bash
bun add ${context.productName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-sdk
\`\`\`

Or copy \`client.js\` directly into your project.

## Configuration

Create \`config/api-config.json\`:

\`\`\`json
{
  "apiKey": "your_api_key",
  "apiUrl": "${apiUrl}",
  "cacheDir": "./cache",
  "cacheTtl": 0
}
\`\`\`

All fields are optional. The API URL falls back to \`process.env['WEBSMITH_API_URL']\` then the build-time URL.

## Lifecycle

### Initialize

\`\`\`javascript
import { LicenseEngine } from './client.js';

const engine = new LicenseEngine();
const { apiKey, baseUrl } = await engine.initialize();
console.log('SDK ready:', baseUrl);
\`\`\`

### Start Trial

\`\`\`javascript
const result = await engine.startTrial('user@example.com', 'Jane Doe');
console.log('Trial started:', result);
\`\`\`

### Check Trial

\`\`\`javascript
const status = await engine.checkTrial();
console.log('Trial status:', status);
\`\`\`

### Convert Trial

\`\`\`javascript
const result = await engine.convertTrial('premium', 'Jane Doe', 'user@example.com');
console.log('Converted:', result);
\`\`\`

### Activate License

\`\`\`javascript
const result = await engine.activate('LICENSE-KEY-HERE', 'My Machine');
console.log('Activated:', result);
\`\`\`

### Validate License

\`\`\`javascript
const result = await engine.validate('LICENSE-KEY-HERE');
console.log('Valid:', engine.isValid());
\`\`\`

### Renew License

\`\`\`javascript
const result = await engine.renew('LICENSE-KEY-HERE');
console.log('Renewed:', result);
\`\`\`

### Replace Hardware

\`\`\`javascript
const result = await engine.replaceHardware('LICENSE-KEY-HERE', 'new-hardware-id');
console.log('Hardware replaced:', result);
\`\`\`

### Bind Device

\`\`\`javascript
const result = await engine.bindDevice('LICENSE-KEY-HERE', 'Work Laptop');
console.log('Device bound:', result);
\`\`\`

### Deactivate License

\`\`\`javascript
const result = await engine.deactivate('LICENSE-KEY-HERE');
console.log('Deactivated:', result);
\`\`\`

### Check License Status

\`\`\`javascript
engine.hasLicenseKey();   // true / false
engine.isValid();         // true / false
engine.getLicenseInfo();  // { license_key, status, expires_at, ... }
\`\`\`

## Low-Level Client

\`\`\`javascript
import { Client, ApiError } from './client.js';

const client = new Client('your_api_key');
const res = await client.validateLicense('LICENSE-KEY', 'hardware-id');
\`\`\`

All requests are HMAC-SHA256 signed and retried with exponential backoff (3 retries).

## Hardware Fingerprint

\`\`\`javascript
import { HardwareFingerprint } from './client.js';

const fp = await HardwareFingerprint.generate();
console.log(fp.fingerprint); // SHA-256 of cpu|motherboard|macs|platform|release
\`\`\`

## Cache

\`\`\`javascript
import { CacheManager } from './client.js';

const cache = new CacheManager('./cache', 0);
await cache.set('license', { status: 'active' });
const data = await cache.get('license');
\`\`\`

Writes are atomic (temp file + rename).

## Welcome Dialog

\`\`\`javascript
import { WelcomeDialog } from './client.js';

WelcomeDialog.show('Welcome to ${context.productName}!');
const agreed = await WelcomeDialog.confirm('Accept terms?');
const name = await WelcomeDialog.prompt('Enter your name');
\`\`\`

## Error Handling

\`\`\`javascript
import { Client, ApiError } from './client.js';

const client = new Client('key');
try {
  await client.validateLicense('bad-key', 'hwid');
} catch (err) {
  if (err instanceof ApiError) {
    console.error(err.status, err.body);
  }
}
\`\`\`

## License

MIT — ${context.productName}
`
  };
}

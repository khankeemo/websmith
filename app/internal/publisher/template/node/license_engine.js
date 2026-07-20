const fs = require('fs');
const path = require('path');
const { ApiClient } = require('./client');
const { HardwareDetector } = require('./hardware');
const { CacheManager } = require('./cache');

class LicenseStatus {
  constructor(valid, status, kwargs) {
    this.valid = valid;
    this.status = status;
    this.expires_at = kwargs?.expires_at || null;
    this.days_remaining = kwargs?.days_remaining || 0;
    this.plan = kwargs?.plan || null;
    this.hardware_id = kwargs?.hardware_id || null;
    this.message = kwargs?.message || null;
    this.license_key = kwargs?.license_key || null;
    this.trial_active = kwargs?.trial_active || status === 'trial';
  }

  toDict() {
    return {
      valid: this.valid,
      status: this.status,
      expires_at: this.expires_at,
      days_remaining: this.days_remaining,
      plan: this.plan,
      hardware_id: this.hardware_id,
      message: this.message,
      license_key: this.license_key,
      trial_active: this.trial_active,
    };
  }

  static fromDict(data) {
    return new LicenseStatus(
      data.valid || false,
      data.status || 'unlicensed',
      {
        expires_at: data.expires_at,
        days_remaining: data.days_remaining || 0,
        plan: data.plan,
        hardware_id: data.hardware_id,
        message: data.message,
        license_key: data.license_key,
        trial_active: data.trial_active || data.status === 'trial',
      }
    );
  }
}

class LicenseEngine {
  constructor(configPath) {
    this.config = this._loadConfig(configPath);
    this._hardware = new HardwareDetector();
    this._cache = new CacheManager(this.config);
    this._client = new ApiClient(this.config, this._hardware, this._cache);
    this._status = null;
    this._licenseKey = null;
  }

  _loadConfig(configPath) {
    if (!configPath) {
      const dir = __dirname;
      configPath = path.join(dir, 'config', 'api-config.json');
      if (!fs.existsSync(configPath)) {
        configPath = path.join(process.cwd(), 'config', 'api-config.json');
      }
    }
    if (!fs.existsSync(configPath)) {
      throw new Error(`api-config.json not found at: ${configPath}`);
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  async initialize() {
    if (this._cache.isValid()) {
      const cached = this._cache.getLicenseStatus();
      if (cached) {
        this._status = LicenseStatus.fromDict(cached);
        return this._status;
      }
    }
    try {
      const hardwareId = this._hardware.getFingerprint();
      const trialResponse = await this._client.getTrialStatus(hardwareId);
      const trialData = trialResponse.data || {};
      if (trialData.has_trial) {
        const statusStr = trialData.status || 'trial';
        this._status = new LicenseStatus(
          statusStr === 'active',
          statusStr,
          {
            expires_at: trialData.expiry_date,
            days_remaining: trialData.days_left || 0,
            plan: trialData.plan,
            hardware_id: hardwareId,
            message: `Trial is ${statusStr}`,
          }
        );
        if (this._status.valid) {
          this._cache.setLicenseStatus(this._status.toDict());
        }
        return this._status;
      }
      this._status = new LicenseStatus(false, 'unlicensed', {
        hardware_id: hardwareId,
        message: 'No license or trial found',
      });
      return this._status;
    } catch (e) {
      const cached = this._cache.getLicenseStatus();
      if (cached) return LicenseStatus.fromDict(cached);
      this._status = new LicenseStatus(false, 'error', {
        message: `Unexpected error: ${e.message}`,
      });
      return this._status;
    }
  }

  getHardwareId() {
    return this._hardware.getFingerprint();
  }

  getStatus() {
    return this._status;
  }

  getLicenseKey() {
    return this._licenseKey;
  }

  hasLicenseKey() {
    return this._licenseKey !== null;
  }

  async validate(licenseKey) {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable. Please activate first.');
    const hardwareId = this._hardware.getFingerprint();
    const result = await this._client.validateLicense(key, hardwareId);
    const data = result.data || result;
    if (data.valid) {
      if (data.license_key) this._licenseKey = data.license_key;
      await this.initialize();
    }
    return result;
  }

  async activate(licenseKey) {
    const result = await this._client.activateLicense(licenseKey);
    if (result.success) {
      this._licenseKey = licenseKey;
      await this.initialize();
    }
    return result;
  }

  async startTrial(email, customerName, customerData) {
    const result = await this._client.startTrial(email, customerName, customerData);
    if (result.success) await this.initialize();
    return result;
  }

  async convertTrial(plan, customerName, customerEmail) {
    const status = await this.initialize();
    if (!status || status.status !== 'trial') {
      throw new Error('No active trial to convert.');
    }
    const hardwareId = this._hardware.getFingerprint();
    const result = await this._client.convertTrial(hardwareId, plan, customerName, customerEmail);
    if (result.success) {
      if (result.license_key) this._licenseKey = result.license_key;
      await this.initialize();
    }
    return result;
  }

  async renew(extraDays) {
    if (!this._licenseKey) throw new Error('License key unavailable. Please activate first.');
    const result = await this._client.renewLicense(this._licenseKey, extraDays);
    if (result.success) await this.initialize();
    return result;
  }

  async deactivate(licenseKey) {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable. Please provide a key.');
    const result = await this._client.deactivateLicense(key);
    if (result.success) {
      this._cache.invalidateLicenseStatus();
      this._status = null;
      if (!licenseKey) this._licenseKey = null;
    }
    return result;
  }

  async replaceHardware() {
    if (!this._licenseKey) throw new Error('License key unavailable. Please activate first.');
    const newHardwareId = this._hardware.getFingerprint();
    let oldHardwareId = this._status?.hardware_id || null;
    if (!oldHardwareId) {
      const cached = this._cache.getLicenseStatus();
      if (cached?.hardware_id) oldHardwareId = cached.hardware_id;
    }
    if (!oldHardwareId) throw new Error('Current hardware_id unavailable. Cannot replace device.');
    if (oldHardwareId === newHardwareId) {
      return { success: false, message: 'Old and new hardware IDs are identical.' };
    }
    const result = await this._client.replaceDevice(this._licenseKey, newHardwareId, oldHardwareId);
    if (result.success) {
      this._cache.invalidateLicenseStatus();
      this._status = null;
      await this.initialize();
    }
    return result;
  }

  async bindDevice(licenseKey, deviceName) {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable.');
    const result = await this._client.bindDevice(key, null, deviceName);
    if (result.success) await this.initialize();
    return result;
  }
}

module.exports = { LicenseEngine, LicenseStatus };

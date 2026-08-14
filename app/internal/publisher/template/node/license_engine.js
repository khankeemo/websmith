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
    this.product_name = kwargs?.product_name || null;
    this.customer_name = kwargs?.customer_name || null;
    this.customer_email = kwargs?.customer_email || null;
    this.customer_mobile = kwargs?.customer_mobile || null;
    this.max_devices = kwargs?.max_devices ?? 0;
    this.device_count = kwargs?.device_count ?? 0;
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
      product_name: this.product_name,
      customer_name: this.customer_name,
      customer_email: this.customer_email,
      customer_mobile: this.customer_mobile,
      max_devices: this.max_devices,
      device_count: this.device_count,
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
        product_name: data.product_name,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_mobile: data.customer_mobile,
        max_devices: data.max_devices || 0,
        device_count: data.device_count || 0,
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
        if (this._status.status !== 'trial' && this._status.valid) {
          this._cache.markHasEverActivatedPaidLicense();
        }
        return this._status;
      }
    }
    try {
      const hardwareId = this._hardware.getFingerprint();
      const statusResponse = await this._client.getLicenseStatus(hardwareId);
      const apiStatus = (statusResponse && statusResponse.status) || 'NO_CUSTOMER';
      const valid = (apiStatus === 'ACTIVE' || apiStatus === 'TRIAL_ACTIVE');
      if (valid) {
        const cust = statusResponse.customer || {};
        const lic = statusResponse.license || {};
        const plan = statusResponse.plan || {};
        const product = statusResponse.product || {};
        const devices = statusResponse.devices || {};
        const displayStatus = apiStatus === 'ACTIVE' ? 'licensed' : 'trial';
        this._status = new LicenseStatus(true, displayStatus, {
          expires_at: lic.expiry_date,
          days_remaining: lic.days_remaining || lic.days_left || 0,
          plan: plan.name || lic.plan || (displayStatus === 'trial' ? 'Trial' : null),
          hardware_id: hardwareId,
          license_key: lic.license_key,
          message: statusResponse.message || statusResponse.reason || (displayStatus === 'licensed' ? 'License active' : 'Trial active'),
          product_name: product.name,
          customer_name: cust.name,
          customer_email: cust.email,
          customer_mobile: cust.mobile,
          max_devices: devices.maximum ?? 0,
          device_count: devices.current ?? 0,
        });
        if (this._status.valid) {
          this._cache.setLicenseStatus(this._status.toDict());
          if (displayStatus === 'licensed') this._cache.markHasEverActivatedPaidLicense();
        }
        return this._status;
      }
      if (this._cache.hasEverActivatedPaidLicense()) {
        this._status = new LicenseStatus(false, 'force_reactivation', {
          hardware_id: hardwareId,
          message: 'License inactive. Please reactivate.',
        });
        return this._status;
      }
      const displayStatus = {
        TRIAL_EXPIRED: 'trial_consumed',
        NO_CUSTOMER: 'no_license',
        INACTIVE: 'inactive',
        REVOKED: 'revoked',
        EXPIRED: 'expired',
      }[apiStatus] || 'no_license';
      this._status = new LicenseStatus(false, displayStatus, {
        hardware_id: hardwareId,
        message: (statusResponse && (statusResponse.message || statusResponse.reason)) || 'No license or trial found',
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
      this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async activate(licenseKey) {
    const result = await this._client.activateLicense(licenseKey);
    if (result.success) {
      this._licenseKey = licenseKey;
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
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
      this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async renew(extraDays) {
    if (!this._licenseKey) throw new Error('License key unavailable. Please activate first.');
    const result = await this._client.renewLicense(this._licenseKey, extraDays);
    if (result.success) {
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
    }
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
      this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async bindDevice(licenseKey, deviceName) {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable.');
    const result = await this._client.bindDevice(key, null, deviceName);
    if (result.success) {
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }
}

module.exports = { LicenseEngine, LicenseStatus };

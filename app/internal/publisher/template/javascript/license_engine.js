import { ApiClient } from './client.js';
import { HardwareDetector } from './hardware.js';
import { CacheManager } from './cache.js';

export class LicenseStatus {
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
    return { ...this };
  }

  static fromDict(data) {
    return new LicenseStatus(data.valid || false, data.status || 'unlicensed', data);
  }
}

export class LicenseEngine {
  constructor(config) {
    this.config = config;
    this._hardware = new HardwareDetector();
    this._cache = new CacheManager(this.config);
    this._client = new ApiClient(this.config, this._hardware, this._cache);
    this._status = null;
    this._licenseKey = null;
  }

  async initialize() {
    const cachedStatus = this._cache.getLicenseStatus();
    
    if (this._cache.isValid()) {
      // Check if cached status is still valid
      if (cachedStatus && cachedStatus.valid && (cachedStatus.status === 'active' || cachedStatus.status === 'trial')) {
        this._status = LicenseStatus.fromDict(cachedStatus);
        if (this._status.status !== 'trial' && this._status.valid) {
          this._cache.markHasEverActivatedPaidLicense();
        }
        return this._status;
      }
    }
    
    // Cache is invalid or status is not valid - clear all cached data and force activation
    this._cache.clearAllLicenseData();
    
    try {
      const hid = await this._hardware.getFingerprint();
      const statusResponse = await this._client.getLicenseStatus(hid);
      if (statusResponse.success) {
        const apiStatus = statusResponse.status || 'no_license';
        if (apiStatus === 'licensed') {
          const cust = statusResponse.customer || {};
          const lic = statusResponse.license || {};
          const plan = statusResponse.plan || {};
          const devices = statusResponse.devices || {};
          this._status = new LicenseStatus(true, 'licensed', {
            expires_at: lic.expiry_date, days_remaining: lic.days_remaining || 0,
            plan: plan.name, hardware_id: hid, license_key: lic.license_key,
            message: 'License active',
          });
          if (this._status.valid) {
            this._cache.setLicenseStatus(this._status.toDict());
            this._cache.markHasEverActivatedPaidLicense();
          }
          return this._status;
        } else if (apiStatus === 'trial') {
          const cust = statusResponse.customer || {};
          const lic = statusResponse.license || {};
          const plan = statusResponse.plan || {};
          this._status = new LicenseStatus(true, 'trial', {
            expires_at: lic.expiry_date, days_remaining: lic.days_remaining || 0,
            plan: plan.name || 'Trial', hardware_id: hid, message: 'Trial active',
          });
          if (this._status.valid) this._cache.setLicenseStatus(this._status.toDict());
          return this._status;
        }
      }
      if (this._cache.hasEverActivatedPaidLicense()) {
        this._status = new LicenseStatus(false, 'force_reactivation', {
          hardware_id: hid, message: 'License inactive. Please reactivate.',
        });
        return this._status;
      }
      this._status = new LicenseStatus(false, 'unlicensed', { hardware_id: hid, message: 'No license or trial found' });
      return this._status;
    } catch (e) {
      const cached = this._cache.getLicenseStatus();
      if (cached) return LicenseStatus.fromDict(cached);
      this._status = new LicenseStatus(false, 'error', { message: `Unexpected error: ${e.message}` });
      return this._status;
    }
  }

  async getHardwareId() { return await this._hardware.getFingerprint(); }
  getStatus() { return this._status; }
  getLicenseKey() { return this._licenseKey; }
  hasLicenseKey() { return this._licenseKey !== null; }

  async validate(licenseKey) {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable. Please activate first.');
    const r = await this._client.validateLicense(key, await this._hardware.getFingerprint());
    const data = r.data || r;
    if (data && !data.valid) {
      // Validation failed - clear all cached data
      this._cache.clearAllLicenseData();
      this._status = null;
      this._licenseKey = null;
    } else if (data.valid) {
      if (r.data?.license_key) this._licenseKey = r.data.license_key;
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
    }
    return r;
  }

  async activate(licenseKey) {
    // Clear any stale cached data before attempting activation
    this._cache.clearAllLicenseData();
    
    const r = await this._client.activateLicense(licenseKey);
    if (r.success) {
      this._licenseKey = licenseKey;
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
    }
    return r;
  }

  async startTrial(email, customerName, customerData) {
    const r = await this._client.startTrial(email, customerName, customerData);
    if (r.success) await this.initialize();
    return r;
  }

  async convertTrial(plan, customerName, customerEmail) {
    const s = await this.initialize();
    if (!s || s.status !== 'trial') throw new Error('No active trial to convert.');
    const r = await this._client.convertTrial(await this._hardware.getFingerprint(), plan, customerName, customerEmail);
    if (r.success) {
      if (r.license_key) this._licenseKey = r.license_key;
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
    }
    return r;
  }

  async renew(extraDays) {
    if (!this._licenseKey) throw new Error('License key unavailable. Please activate first.');
    const r = await this._client.renewLicense(this._licenseKey, extraDays);
    if (r.success) {
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
    }
    return r;
  }

  async deactivate(licenseKey) {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable. Please provide a key.');
    const r = await this._client.deactivateLicense(key);
    if (r.success) { this._cache.clearAllLicenseData(); this._status = null; if (!licenseKey) this._licenseKey = null; }
    return r;
  }

  async replaceHardware() {
    if (!this._licenseKey) throw new Error('License key unavailable. Please activate first.');
    const newHw = await this._hardware.getFingerprint();
    let oldHw = this._status?.hardware_id;
    if (!oldHw) { const c = this._cache.getLicenseStatus(); if (c?.hardware_id) oldHw = c.hardware_id; }
    if (!oldHw) throw new Error('Current hardware_id unavailable.');
    if (oldHw === newHw) return { success: false, message: 'Old and new hardware IDs are identical.' };
    const r = await this._client.replaceDevice(this._licenseKey, newHw, oldHw);
    if (r.success) {
      this._cache.invalidateLicenseStatus();
      this._status = null;
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
    }
    return r;
  }

  async bindDevice(licenseKey, deviceName) {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable.');
    const r = await this._client.bindDevice(key, undefined, deviceName);
    if (r.success) {
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
    }
    return r;
  }
}

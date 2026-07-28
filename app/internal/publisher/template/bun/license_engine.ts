import path from 'path';
import { ApiClient } from './client';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';

export class LicenseStatus {
  valid: boolean;
  status: string;
  expires_at: string | null = null;
  days_remaining: number = 0;
  plan: string | null = null;
  hardware_id: string | null = null;
  message: string | null = null;
  license_key: string | null = null;
  trial_active: boolean;

  constructor(valid: boolean, status: string, kwargs?: Record<string, any>) {
    this.valid = valid;
    this.status = status;
    this.trial_active = kwargs?.trial_active || status === 'trial';
    Object.assign(this, kwargs || {});
  }

  toDict(): Record<string, any> {
    return { ...this };
  }

  static fromDict(data: Record<string, any>): LicenseStatus {
    return new LicenseStatus(data.valid || false, data.status || 'unlicensed', data);
  }
}

export class LicenseEngine {
  config: Record<string, any>;
  _hardware: HardwareDetector;
  _cache: CacheManager;
  _client: ApiClient;
  private _status: LicenseStatus | null = null;
  _licenseKey: string | null = null;

  constructor(configPath?: string) {
    this.config = await this._loadConfig(configPath);
    this._hardware = new HardwareDetector();
    this._cache = new CacheManager(this.config);
    this._client = new ApiClient(this.config, this._hardware, this._cache);
  }

  private async _loadConfig(configPath?: string): Promise<Record<string, any>> {
    if (!configPath) {
      const dir = (import.meta as any).dir;
      configPath = path.join(dir, 'config', 'api-config.json');
      if (!await Bun.file(configPath).exists()) {
        configPath = path.join(process.cwd(), 'config', 'api-config.json');
      }
    }
    if (!await Bun.file(configPath).exists()) {
      throw new Error(`api-config.json not found at: ${configPath}`);
    }
    return JSON.parse(await Bun.file(configPath).text());
  }

  async initialize(): Promise<LicenseStatus> {
    if (await this._cache.isValid()) {
      const cached = await this._cache.getLicenseStatus();
      if (cached) {
        // Check if cached license is still valid (active or trial)
        if (cached.valid && (cached.status === 'active' || cached.status === 'trial')) {
          this._status = LicenseStatus.fromDict(cached);
          this._licenseKey = cached.license_key || null;
          if (this._status.status !== 'trial' && this._status.valid) {
            await this._cache.markHasEverActivatedPaidLicense();
          }
          return this._status;
        }
        // Cached license is invalid - clear all data
        await this._cache.clearAllLicenseData();
      }
    }
    try {
      const hardwareId = this._hardware.getFingerprint();
      const statusResponse = await this._client.getLicenseStatus(hardwareId);
      if (statusResponse.success) {
        const apiStatus = statusResponse.status || 'no_license';
        if (apiStatus === 'licensed') {
          const cust = statusResponse.customer || {};
          const lic = statusResponse.license || {};
          const plan = statusResponse.plan || {};
          const devices = statusResponse.devices || {};
          this._status = new LicenseStatus(true, 'licensed', {
            expires_at: lic.expiry_date, days_remaining: lic.days_remaining || 0,
            plan: plan.name, hardware_id: hardwareId, license_key: lic.license_key,
            message: 'License active',
          });
          if (this._status.valid) {
            await this._cache.setLicenseStatus(this._status.toDict());
            await this._cache.markHasEverActivatedPaidLicense();
          }
          return this._status;
        } else if (apiStatus === 'trial') {
          const cust = statusResponse.customer || {};
          const lic = statusResponse.license || {};
          const plan = statusResponse.plan || {};
          this._status = new LicenseStatus(true, 'trial', {
            expires_at: lic.expiry_date, days_remaining: lic.days_remaining || 0,
            plan: plan.name || 'Trial', hardware_id: hardwareId, message: 'Trial active',
          });
          if (this._status.valid) await this._cache.setLicenseStatus(this._status.toDict());
          return this._status;
        }
      }
      if (await this._cache.hasEverActivatedPaidLicense()) {
        this._status = new LicenseStatus(false, 'force_reactivation', {
          hardware_id: hardwareId, message: 'License inactive. Please reactivate.',
        });
        return this._status;
      }
      this._status = new LicenseStatus(false, 'unlicensed', { hardware_id: hardwareId, message: 'No license or trial found' });
      return this._status;
    } catch (e) {
      const cached = await this._cache.getLicenseStatus();
      if (cached) return LicenseStatus.fromDict(cached);
      this._status = new LicenseStatus(false, 'error', { message: `Unexpected error: ${(e as Error).message}` });
      return this._status;
    }
  }

  getHardwareId(): string { return this._hardware.getFingerprint(); }
  getStatus(): LicenseStatus | null { return this._status; }
  getLicenseKey(): string | null { return this._licenseKey; }
  hasLicenseKey(): boolean { return this._licenseKey !== null; }

  async validate(licenseKey?: string): Promise<Record<string, any>> {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable. Please activate first.');
    const result = await this._client.validateLicense(key, this._hardware.getFingerprint());
    const data = result.data || result;
    if (data && !data.valid) {
      // If validation fails (license expired, revoked, inactive, etc.), clear all cached data
      await this._cache.clearAllLicenseData();
      this._status = null;
      this._licenseKey = null;
    } else if (data.valid) {
      if (data.license_key) this._licenseKey = data.license_key;
      await this.initialize();
      await this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async activate(licenseKey: string): Promise<Record<string, any>> {
    // Clear any stale cached data before attempting activation
    await this._cache.clearAllLicenseData();
    
    const result = await this._client.activateLicense(licenseKey);
    if (result.success) {
      this._licenseKey = licenseKey;
      await this.initialize();
      await this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async startTrial(email: string, customerName?: string, customerData?: Record<string, any>): Promise<Record<string, any>> {
    const result = await this._client.startTrial(email, customerName, customerData);
    if (result.success) await this.initialize();
    return result;
  }

  async convertTrial(plan?: string, customerName?: string, customerEmail?: string): Promise<Record<string, any>> {
    const status = await this.initialize();
    if (!status || status.status !== 'trial') throw new Error('No active trial to convert.');
    const result = await this._client.convertTrial(this._hardware.getFingerprint(), plan, customerName, customerEmail);
    if (result.success) {
      if (result.license_key) this._licenseKey = result.license_key;
      await this.initialize();
      await this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async renew(extraDays?: number): Promise<Record<string, any>> {
    if (!this._licenseKey) throw new Error('License key unavailable. Please activate first.');
    const result = await this._client.renewLicense(this._licenseKey, extraDays);
    if (result.success) {
      await this.initialize();
      await this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async deactivate(licenseKey?: string): Promise<Record<string, any>> {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable. Please provide a key.');
    const result = await this._client.deactivateLicense(key);
    if (result.success) { 
      await this._cache.clearAllLicenseData();
      this._status = null; 
      if (!licenseKey) this._licenseKey = null; 
    }
    return result;
  }

  async replaceHardware(): Promise<Record<string, any>> {
    if (!this._licenseKey) throw new Error('License key unavailable. Please activate first.');
    const newHw = this._hardware.getFingerprint();
    let oldHw = this._status?.hardware_id;
    if (!oldHw) { const c = await this._cache.getLicenseStatus(); if (c?.hardware_id) oldHw = c.hardware_id; }
    if (!oldHw) throw new Error('Current hardware_id unavailable.');
    if (oldHw === newHw) return { success: false, message: 'Old and new hardware IDs are identical.' };
    const result = await this._client.replaceDevice(this._licenseKey, newHw, oldHw);
    if (result.success) {
      await this._cache.invalidateLicenseStatus();
      this._status = null;
      await this.initialize();
      await this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async bindDevice(licenseKey?: string, deviceName?: string): Promise<Record<string, any>> {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable.');
    const result = await this._client.bindDevice(key, undefined, deviceName);
    if (result.success) {
      await this.initialize();
      await this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }
}

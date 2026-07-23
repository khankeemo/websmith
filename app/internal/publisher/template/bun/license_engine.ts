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
        this._status = LicenseStatus.fromDict(cached);
        if (this._status.status !== 'trial' && this._status.valid) {
          await this._cache.markHasEverActivatedPaidLicense();
        }
        return this._status;
      }
    }
    try {
      const hardwareId = this._hardware.getFingerprint();
      // Priority 1: Validate active paid license from server
      if (this._licenseKey) {
        try {
          const result = await this._client.validateLicense(this._licenseKey, hardwareId);
          const data = result.data || result;
          if (data.valid) {
            this._status = new LicenseStatus(true, data.status || 'active', {
              expires_at: data.expiry_date, days_remaining: data.days_left || 0,
              plan: data.plan, hardware_id: hardwareId, license_key: this._licenseKey,
              message: 'License active',
            });
            if (this._status.valid) {
              await this._cache.setLicenseStatus(this._status.toDict());
              await this._cache.markHasEverActivatedPaidLicense();
            }
            return this._status;
          } else {
            // Paid license is invalid/inactive - check if user ever had one
            if (await this._cache.hasEverActivatedPaidLicense()) {
              this._status = new LicenseStatus(false, 'force_reactivation', {
                hardware_id: hardwareId, license_key: this._licenseKey,
                message: 'License inactive. Please reactivate.',
              });
              return this._status;
            }
          }
        } catch {
          // Server error - check if user ever had a paid license
          if (await this._cache.hasEverActivatedPaidLicense()) {
            this._status = new LicenseStatus(false, 'force_reactivation', {
              hardware_id: hardwareId, license_key: this._licenseKey,
              message: 'License validation failed. Please reactivate.',
            });
            return this._status;
          }
        }
      } else {
        // No license key but check if user ever had one
        if (await this._cache.hasEverActivatedPaidLicense()) {
          this._status = new LicenseStatus(false, 'force_reactivation', {
            hardware_id: hardwareId, message: 'License inactive. Please reactivate.',
          });
          return this._status;
        }
      }
      // Priority 2: Check for active trial (only if user never had a paid license)
      if (!(await this._cache.hasEverActivatedPaidLicense())) {
        const trialResponse = await this._client.getTrialStatus(hardwareId);
        const trialData = trialResponse.data || {};
        if (trialData.has_trial) {
          const statusStr = trialData.status || 'trial';
          this._status = new LicenseStatus(statusStr === 'active', statusStr, {
            expires_at: trialData.expiry_date, days_remaining: trialData.days_left || 0,
            plan: trialData.plan, hardware_id: hardwareId, message: `Trial is ${statusStr}`,
          });
          if (this._status.valid) await this._cache.setLicenseStatus(this._status.toDict());
          return this._status;
        }
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
    if ((result.data || result).valid) {
      if (result.data?.license_key) this._licenseKey = result.data.license_key;
      await this.initialize();
      await this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async activate(licenseKey: string): Promise<Record<string, any>> {
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
    if (result.success) { await this._cache.invalidateLicenseStatus(); this._status = null; if (!licenseKey) this._licenseKey = null; }
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

import * as fs from 'fs';
import * as path from 'path';
import { ApiClient } from './client';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';

export class LicenseStatus {
  valid: boolean;
  status: string;
  expires_at: string | null;
  days_remaining: number;
  plan: string | null;
  hardware_id: string | null;
  message: string | null;
  license_key: string | null;
  trial_active: boolean;

  constructor(valid: boolean, status: string, kwargs?: Record<string, any>) {
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

  toDict(): Record<string, any> {
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

  static fromDict(data: Record<string, any>): LicenseStatus {
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
      },
    );
  }
}

export class LicenseEngine {
  config: Record<string, any>;
  _hardware: HardwareDetector;
  _cache: CacheManager;
  _client: ApiClient;
  private _status: LicenseStatus | null = null;
  _licenseKey: string | null = null;
  onLicenseReady: ((valid: boolean) => void) | null = null;

  constructor(configPath?: string) {
    this.config = this._loadConfig(configPath);
    this._hardware = new HardwareDetector();
    this._cache = new CacheManager(this.config);
    this._client = new ApiClient(this.config, this._hardware, this._cache);
  }

  private _notifyReady(valid: boolean): void {
    if (this.onLicenseReady) {
      try { this.onLicenseReady(valid); } catch { /* callback error ignored */ }
    }
  }

  isValidStatus(status: LicenseStatus | null): boolean {
    if (!status) return false;
    return status.status === 'active' || status.status === 'trial';
  }

  private _loadConfig(configPath?: string): Record<string, any> {
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

  async initialize(): Promise<LicenseStatus> {
    const hardwareId = this._hardware.getFingerprint();
    this._cache.invalidateIfHardwareMismatch(hardwareId);
    await this._processMessageQueue();
    if (this._cache.isValid()) {
      const cached = this._cache.getLicenseStatus();
      if (cached) {
        this._status = LicenseStatus.fromDict(cached);
        if (!this._licenseKey && this._status.license_key) {
          this._licenseKey = this._status.license_key;
        }
        if (this._status.status !== 'trial' && this._status.valid) {
          this._cache.markHasEverActivatedPaidLicense();
        }
        this._notifyReady(this.isValidStatus(this._status));
        return this._status;
      }
    }
    try {
      // Priority 1: Validate active paid license from server
      if (this._licenseKey) {
        try {
          const result = await this._client.validateLicense(this._licenseKey, hardwareId);
          const data = result.data || result;
          if (data.valid) {
            const statusStr = data.status || 'active';
            if (statusStr === 'expired') {
              this._status = new LicenseStatus(false, 'expired', {
                expires_at: data.expiry_date,
                days_remaining: 0,
                plan: data.plan,
                hardware_id: hardwareId,
                license_key: this._licenseKey,
                message: 'License has expired. Please renew.',
              });
              this._notifyReady(false);
              return this._status;
            }
            this._status = new LicenseStatus(
              true,
              statusStr,
              {
                expires_at: data.expiry_date,
                days_remaining: data.days_left || 0,
                plan: data.plan,
                hardware_id: hardwareId,
                license_key: this._licenseKey,
                message: 'License active',
              },
            );
            this._cache.setLicenseStatus(this._status.toDict());
            this._cache.markHasEverActivatedPaidLicense();
            this._notifyReady(true);
            return this._status;
          } else {
            // License is invalid/inactive
            const serverStatus = data.status || '';
            if (serverStatus === 'expired') {
              this._status = new LicenseStatus(false, 'expired', {
                expires_at: data.expiry_date,
                days_remaining: 0,
                plan: data.plan,
                hardware_id: hardwareId,
                license_key: this._licenseKey,
                message: 'License has expired. Please renew.',
              });
              this._notifyReady(false);
              return this._status;
            }
            if (this._cache.hasEverActivatedPaidLicense()) {
              this._status = new LicenseStatus(false, 'force_reactivation', {
                hardware_id: hardwareId,
                license_key: this._licenseKey,
                message: 'License inactive. Please reactivate.',
              });
              this._notifyReady(false);
              return this._status;
            }
            this._status = new LicenseStatus(false, 'force_activation', {
              hardware_id: hardwareId,
              license_key: this._licenseKey,
              message: 'License key invalid. Please activate.',
            });
            this._notifyReady(false);
            return this._status;
          }
        } catch {
          if (this._cache.hasEverActivatedPaidLicense()) {
            this._status = new LicenseStatus(false, 'force_reactivation', {
              hardware_id: hardwareId,
              license_key: this._licenseKey,
              message: 'License validation failed. Please reactivate.',
            });
            this._notifyReady(false);
            return this._status;
          }
          this._status = new LicenseStatus(false, 'force_activation', {
            hardware_id: hardwareId,
            license_key: this._licenseKey,
            message: 'License validation failed. Please activate.',
          });
          this._notifyReady(false);
          return this._status;
        }
      } else {
        if (this._cache.hasEverActivatedPaidLicense()) {
          this._status = new LicenseStatus(false, 'force_reactivation', {
            hardware_id: hardwareId,
            message: 'License key missing. Please reactivate.',
          });
          this._notifyReady(false);
          return this._status;
        }
      }
      // Priority 2: Check for active trial (only if user never had a paid license)
      if (!this._cache.hasEverActivatedPaidLicense()) {
        const trialResponse = await this._client.getTrialStatus(hardwareId);
        const trialData = trialResponse.data || {};
        if (trialData.has_trial) {
          const statusStr = trialData.status || 'trial';
          if (statusStr === 'expired') {
            this._status = new LicenseStatus(false, 'expired', {
              expires_at: trialData.expiry_date,
              days_remaining: 0,
              plan: trialData.plan,
              hardware_id: hardwareId,
              message: 'Trial has expired. Please renew.',
            });
            this._notifyReady(false);
            return this._status;
          }
          this._status = new LicenseStatus(
            statusStr === 'active',
            statusStr,
            {
              expires_at: trialData.expiry_date,
              days_remaining: trialData.days_left || 0,
              plan: trialData.plan,
              hardware_id: hardwareId,
              message: `Trial is ${statusStr}`,
            },
          );
          if (this._status.valid) {
            this._cache.setLicenseStatus(this._status.toDict());
          }
          this._notifyReady(this.isValidStatus(this._status));
          return this._status;
        }
      }
      // Priority 3: Determine if new customer or force activation
      if (this._cache.isOnboardingComplete()) {
        this._status = new LicenseStatus(false, 'force_activation', {
          hardware_id: hardwareId,
          message: 'No active license found. Please activate.',
        });
      } else {
        this._status = new LicenseStatus(false, 'unlicensed', {
          hardware_id: hardwareId,
          message: 'No license or trial found',
        });
      }
      this._notifyReady(false);
      return this._status;
    } catch (e) {
      const cached = this._cache.getLicenseStatus();
      if (cached) {
        this._status = LicenseStatus.fromDict(cached);
        this._notifyReady(this.isValidStatus(this._status));
        return this._status;
      }
      this._status = new LicenseStatus(false, 'error', {
        message: `Unexpected error: ${(e as Error).message}`,
      });
      this._notifyReady(false);
      return this._status;
    }
  }

  getHardwareId(): string {
    return this._hardware.getFingerprint();
  }

  getStatus(): LicenseStatus | null {
    return this._status;
  }

  getLicenseKey(): string | null {
    return this._licenseKey;
  }

  hasLicenseKey(): boolean {
    return this._licenseKey !== null;
  }

  async validate(licenseKey?: string): Promise<Record<string, any>> {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable.');
    const hardwareId = this._hardware.getFingerprint();
    const result = await this._client.validateLicense(key, hardwareId);
    return result;
  }

  async activate(licenseKey: string): Promise<Record<string, any>> {
    const result = await this._client.activateLicense(licenseKey);
    if (result.success) {
      this._licenseKey = licenseKey;
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
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

  async renew(extraDays?: number): Promise<Record<string, any>> {
    if (!this._licenseKey) throw new Error('License key unavailable. Please activate first.');
    const result = await this._client.renewLicense(this._licenseKey, extraDays);
    if (result.success) {
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async deactivate(licenseKey?: string): Promise<Record<string, any>> {
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

  async bindDevice(licenseKey?: string, deviceName?: string): Promise<Record<string, any>> {
    const key = licenseKey || this._licenseKey;
    if (!key) throw new Error('License key unavailable.');
    const result = await this._client.bindDevice(key, undefined, deviceName);
    if (result.success) {
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
    }
    return result;
  }

  async getSupportConversation(requestId: string): Promise<Record<string, any>> {
    const hardwareId = this._hardware.getFingerprint();
    return this._client.getSupportConversation(requestId, hardwareId);
  }

  async replyToSupportRequest(requestId: string, message: string, customerName?: string, customerEmail?: string): Promise<Record<string, any>> {
    const hardwareId = this._hardware.getFingerprint();
    return this._client.replyToSupportRequest(requestId, message, customerName, customerEmail, hardwareId);
  }

  // ====================================================================
  // Message Queue Processing
  // ====================================================================

  private async _processMessageQueue(): Promise<void> {
    const queue = this._cache.getMessageQueue();
    let changed = false;
    for (const msg of queue) {
      if (msg.status === 'sent') continue;
      const now = Math.floor(Date.now() / 1000);
      if (now < (msg.next_retry_at || 0)) continue;
      if (msg.retry_count >= msg.max_retries) continue;
      msg.status = 'sending';
      try {
        await this._client.createCommunication(msg);
        msg.status = 'sent';
        changed = true;
      } catch (e) {
        msg.retry_count = (msg.retry_count || 0) + 1;
        msg.last_error = (e as Error).message;
        const expBackoff = Math.pow(2, msg.retry_count) * 60;
        msg.next_retry_at = now + expBackoff;
        msg.status = 'failed';
        changed = true;
      }
    }
    if (changed) {
      this._cache.saveMessageQueue(queue);
      this._cache.cleanupSentMessages();
    }
  }

  // ====================================================================
  // Universal Communication Engine
  // ====================================================================

  async createCommunication(params: Record<string, any>): Promise<Record<string, any>> {
    try {
      return await this._client.createCommunication(params);
    } catch (e) {
      this._cache.queueMessage(params);
      return {
        success: false,
        message: 'Message queued for delivery when online.',
        queued: true,
      };
    }
  }

  async getConversation(conversationId: string): Promise<Record<string, any>> {
    return this._client.getConversation(conversationId);
  }

  async replyToConversation(conversationId: string, message: string, customerName?: string, customerEmail?: string): Promise<Record<string, any>> {
    try {
      return await this._client.replyToConversation(conversationId, message, customerName, customerEmail);
    } catch (e) {
      const cached = this._cache.getLicenseStatus();
      this._cache.queueMessage({
        category: 'general',
        customer_email: customerEmail || cached?.customer_email || '',
        customer_name: customerName || cached?.customer_name || '',
        subject: `Reply to conversation ${conversationId}`,
        message,
      });
      return {
        success: false,
        message: 'Reply queued for delivery when online.',
        queued: true,
      };
    }
  }

  async listConversations(email: string): Promise<Record<string, any>> {
    return this._client.listConversations(email);
  }

  async getNotifications(email: string): Promise<Record<string, any>> {
    return this._client.getNotifications(email);
  }

  async markNotificationRead(notificationId: string): Promise<Record<string, any>> {
    return this._client.markNotificationRead(notificationId);
  }

  async getUnreadNotificationCount(email: string): Promise<Record<string, any>> {
    return this._client.getUnreadNotificationCount(email);
  }
}

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

  customer_name: string | null;
  customer_email: string | null;
  max_devices: number;
  device_count: number;

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
    this.customer_name = kwargs?.customer_name || null;
    this.customer_email = kwargs?.customer_email || null;
    this.max_devices = kwargs?.max_devices || 999;
    this.device_count = kwargs?.device_count || 0;
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
      customer_name: this.customer_name,
      customer_email: this.customer_email,
      max_devices: this.max_devices,
      device_count: this.device_count,
    };
  }

  static fromDict(data: Record<string, any>): LicenseStatus {
    return new LicenseStatus(
      data.valid || false,
      data.status || 'no_license',
      {
        expires_at: data.expires_at,
        days_remaining: data.days_remaining || 0,
        plan: data.plan,
        hardware_id: data.hardware_id,
        message: data.message,
        license_key: data.license_key,
        trial_active: data.trial_active || data.status === 'trial',
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        max_devices: data.max_devices || 999,
        device_count: data.device_count || 0,
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

    const cachedStatus = this._cache.getLicenseStatus();
    const onboardingComplete = this._cache.isOnboardingComplete() || this._cache.peekOnboardingComplete();
    const hasEverActivated = this._cache.hasEverActivatedPaidLicense();
    const hasEverConsumedTrial = this._cache.hasEverConsumedTrial();
    const customerState = this._cache.getCustomerState();

    // Check for active cached license — validate with server to confirm
    if (cachedStatus && cachedStatus.valid && (cachedStatus.status === 'active' || cachedStatus.status === 'trial')) {
      if (cachedStatus.hardware_id === hardwareId) {
        this._status = LicenseStatus.fromDict(cachedStatus);
        this._licenseKey = cachedStatus.license_key || null;
        console.log(`[LiveLog] Decision — cache hit (status: ${cachedStatus.status}), validating with server`);
        try {
          const licenseKey = this._licenseKey || '';
          if (licenseKey) {
            const serverResult = await this._client.validateLicense(licenseKey, hardwareId);
            const serverData = serverResult.data || serverResult;
            if (serverData.valid) {
              this._cache.setLicenseStatus(cachedStatus);
              this._cache.setActiveBinding(true);
              console.log(`[LiveLog] Decision — server confirmed (status: ${cachedStatus.status})`);
              this._notifyReady(true);
              return this._status;
            }
            console.log(`[LiveLog] Decision — server returned invalid, falling through`);
          } else {
            const hwResult = await this._client.validateLicenseByHardware(hardwareId);
            const hwData = hwResult.data || hwResult;
            if (hwData.valid || hwData.status === 'active' || hwData.status === 'trial') {
              this._cache.setLicenseStatus(cachedStatus);
              this._cache.setActiveBinding(true);
              console.log(`[LiveLog] Decision — server confirmed (status: ${cachedStatus.status})`);
              this._notifyReady(true);
              return this._status;
            }
            console.log(`[LiveLog] Decision — server returned invalid, falling through`);
          }
        } catch {
          console.log(`[LiveLog] Decision — server unreachable, using cached state`);
          this._cache.setLicenseStatus(cachedStatus);
          console.log(`[LiveLog] Decision — cache fallback (status: ${cachedStatus.status})`);
          this._notifyReady(true);
          return this._status;
        }
        this._cache.invalidateLicenseStatus();
      } else {
        this._cache.invalidateLicenseStatus();
      }
    }

    // Peek fallback — restore from expired cache if state is still valid
    if (!cachedStatus || !cachedStatus.valid) {
      const peeked = this._cache.peekLicenseStatus();
      if (peeked && (peeked.status === 'active' || peeked.status === 'trial')) {
        this._status = LicenseStatus.fromDict(peeked);
        this._licenseKey = peeked.license_key || null;
        console.log(`[LiveLog] Decision — restored saved state, cache TTL expired (status: ${peeked.status}), validating with server`);
        try {
          const licenseKey = this._licenseKey || '';
          if (licenseKey) {
            const serverResult = await this._client.validateLicense(licenseKey, hardwareId);
            const serverData = serverResult.data || serverResult;
            if (serverData.valid) {
              this._cache.setLicenseStatus(peeked);
              this._cache.setActiveBinding(true);
              console.log(`[LiveLog] Decision — server confirmed (status: ${peeked.status})`);
              this._notifyReady(true);
              return this._status;
            }
          } else {
            const hwResult = await this._client.validateLicenseByHardware(hardwareId);
            const hwData = hwResult.data || hwResult;
            if (hwData.valid || hwData.status === 'active' || hwData.status === 'trial') {
              this._cache.setLicenseStatus(peeked);
              this._cache.setActiveBinding(true);
              console.log(`[LiveLog] Decision — server confirmed (status: ${peeked.status})`);
              this._notifyReady(true);
              return this._status;
            }
          }
        } catch {
          console.log(`[LiveLog] Decision — server unreachable, using cached state`);
          this._cache.setLicenseStatus(peeked);
          console.log(`[LiveLog] Decision — cache fallback (status: ${peeked.status})`);
          this._notifyReady(true);
          return this._status;
        }
        console.log(`[LiveLog] Decision — server did not confirm, falling through`);
      }
    }

    console.log('[LiveLog] Decision — cache miss, using cache-based state detection');

    // Cache-based customer state detection (Rule 0A-6)
    if (onboardingComplete) {
      if (hasEverActivated) {
        console.log(`[LiveLog] Decision — inactive (existing customer with paid history)`);
        this._cache.setCustomerState('inactive');
        this._status = new LicenseStatus(false, 'inactive', {
          hardware_id: hardwareId,
          message: 'You are an existing customer, but your license is inactive. If you have a new or reactivated license, activate it now. Otherwise, please contact support.',
        });
      } else if (hasEverConsumedTrial) {
        console.log(`[LiveLog] Decision — trial_consumed (onboarding complete, trial history)`);
        this._cache.setCustomerState('trial_consumed');
        this._status = new LicenseStatus(false, 'trial_consumed', {
          hardware_id: hardwareId,
          message: 'This email has already consumed its lifetime trial. Please activate a paid license or renew an existing license.',
        });
      } else {
        console.log(`[LiveLog] Decision — no_license (onboarding complete, no paid history, no trial)`);
        this._cache.setCustomerState('no_license');
        this._status = new LicenseStatus(false, 'no_license', {
          hardware_id: hardwareId,
          message: 'No active license or trial was found. Start a Free Trial or activate your license.',
        });
      }
    } else {
      console.log(`[LiveLog] Decision — no_license (new customer)`);
      this._cache.setCustomerState('no_license');
      this._status = new LicenseStatus(false, 'no_license', {
        hardware_id: hardwareId,
        message: 'No license or trial was found. Start a Free Trial or activate your license.',
      });
    }

    this._cache.setActiveBinding(false);
    this._notifyReady(false);
    return this._status;
  }

  async validateHardware(): Promise<Record<string, any>> {
    const hardwareId = this._hardware.getFingerprint();
    return this._client.validateLicenseByHardware(hardwareId);
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
    
    const data = result.data || result;
    if (data && !data.valid) {
      this._cache.invalidateLicenseStatus();
      this._status = null;
      this._licenseKey = null;
    }
    
    return result;
  }

  async activate(licenseKey: string): Promise<Record<string, any>> {
    this._cache.invalidateLicenseStatus();
    
    const result = await this._client.activateLicense(licenseKey);
    if (result.success) {
      this._licenseKey = licenseKey;
      await this.initialize();
      this._cache.markHasEverActivatedPaidLicense();
      this._cache.setOnboardingComplete();
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

  async sendReactivationRequest(params: Record<string, any>): Promise<Record<string, any>> {
    return this._client.sendReactivationRequest(params);
  }

  async getRequestHistory(email: string): Promise<Record<string, any>> {
    return this._client.getRequestHistory(email);
  }
}

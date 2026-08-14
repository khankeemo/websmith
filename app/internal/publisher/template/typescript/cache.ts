import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface CacheEntry {
  value: unknown;
  cached_at: number;
}

interface CacheData {
  [key: string]: CacheEntry;
}

export class CacheManager {
  private config: Record<string, any>;
  private productId: string;
  private _cacheDir: string;
  private _cacheFile: string;
  private _tmpFile: string;
  private _corruptFile: string;
  private _ttlDays: number;
  private _cache: CacheData | null = null;

  constructor(config: Record<string, any>) {
    this.config = config;
    this.productId = config.product?.id || 'unknown';
    const safeName = this.productId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    this._cacheDir = path.join(os.homedir(), '.websmith', safeName);
    this._cacheFile = path.join(this._cacheDir, 'cache.json');
    this._tmpFile = path.join(this._cacheDir, 'cache.tmp');
    this._corruptFile = path.join(this._cacheDir, 'cache.corrupt');
    this._ttlDays = this._getTtl();
  }

  private _getTtl(): number {
    return this.config.offline?.cache_days || 0;
  }

  isHardwareConsistent(currentHardwareId: string): boolean {
    const status = this.getLicenseStatus();
    if (!status) return true;
    if (!status.hardware_id) return true;
    return status.hardware_id === currentHardwareId;
  }

  invalidateIfHardwareMismatch(currentHardwareId: string): void {
    if (!this.isHardwareConsistent(currentHardwareId)) {
      this.invalidateLicenseStatus();
    }
  }

  private _ensureCacheDir(): void {
    fs.mkdirSync(this._cacheDir, { recursive: true });
  }

  private _loadCache(): CacheData {
    if (this._cache !== null) return this._cache;
    this._ensureCacheDir();
    try {
      if (fs.existsSync(this._cacheFile)) {
        const data = fs.readFileSync(this._cacheFile, 'utf-8');
        this._cache = JSON.parse(data) as CacheData;
        return this._cache;
      }
    } catch (_) {
      this._preserveCorruptCache();
    }
    this._cache = {};
    return this._cache;
  }

  private _preserveCorruptCache(): void {
    try {
      if (fs.existsSync(this._cacheFile)) {
        if (fs.existsSync(this._corruptFile)) fs.unlinkSync(this._corruptFile);
        fs.renameSync(this._cacheFile, this._corruptFile);
      }
    } catch (_) {
      try { if (fs.existsSync(this._cacheFile)) fs.unlinkSync(this._cacheFile); } catch (_) {}
    }
  }

  private _saveCache(): void {
    if (this._cache === null) return;
    this._ensureCacheDir();
    try {
      fs.writeFileSync(this._tmpFile, JSON.stringify(this._cache, null, 2), 'utf-8');
      fs.renameSync(this._tmpFile, this._cacheFile);
    } catch (_) {
      try { if (fs.existsSync(this._tmpFile)) fs.unlinkSync(this._tmpFile); } catch (_) {}
    }
  }

  get<T = unknown>(key: string): T | null {
    const cache = this._loadCache();
    const entry = cache[key];
    if (entry === undefined) return null;
    if (this._isExpired(entry)) {
      this.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown): void {
    const cache = this._loadCache();
    cache[key] = { value, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  delete(key: string): void {
    const cache = this._loadCache();
    if (key in cache) {
      delete cache[key];
      this._saveCache();
    }
  }

  clear(): void {
    this._cache = {};
    this._saveCache();
  }

  private _isExpired(entry: CacheEntry): boolean {
    const cachedAt = entry.cached_at || 0;
    const ttlSeconds = this._ttlDays * 86400;
    return (Date.now() / 1000 - cachedAt) > ttlSeconds;
  }

  isValid(): boolean {
    const cache = this._loadCache();
    const entry = cache.license_status;
    if (!entry) return false;
    return !this._isExpired(entry);
  }

  exists(): boolean {
    return fs.existsSync(this._cacheFile);
  }

  getLicenseStatus(): Record<string, any> | null {
    return this.get<Record<string, any>>('license_status');
  }

  peekLicenseStatus(): Record<string, any> | null {
    const cache = this._loadCache();
    const entry = cache.license_status;
    if (!entry) return null;
    return entry.value as Record<string, any> || null;
  }

  peekOnboardingComplete(): boolean {
    const cache = this._loadCache();
    const entry = cache.onboarding_complete;
    return entry !== undefined && entry.value === true;
  }

  setLicenseStatus(status: Record<string, any>): void {
    this.set('license_status', status);
  }

  invalidateLicenseStatus(): void {
    this.delete('license_status');
  }

  clearAllLicenseData(): void {
    this.delete('license_status');
    this.delete('customer_name');
    this.delete('customer_email');
    this.delete('customer_phone');
    this.delete('customer_mobile');
    this.delete('plan');
    this.delete('product_name');
    this.delete('expiry_date');
    this.delete('days_remaining');
    this.delete('license_key');
    this.delete('hardware_id');
    this.delete('trial_active');
  }

  setOnboardingComplete(): void {
    const cache = this._loadCache();
    cache.onboarding_complete = { value: true, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  isOnboardingComplete(): boolean {
    return this.get<boolean>('onboarding_complete') === true;
  }

  markHasEverActivatedPaidLicense(): void {
    const cache = this._loadCache();
    cache.has_ever_activated_paid_license = { value: true, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  hasEverActivatedPaidLicense(): boolean {
    const cache = this._loadCache();
    const entry = cache.has_ever_activated_paid_license;
    return entry !== undefined && entry.value === true;
  }

  markHasEverConsumedTrial(): void {
    const cache = this._loadCache();
    cache.has_ever_consumed_trial = { value: true, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  hasEverConsumedTrial(): boolean {
    const cache = this._loadCache();
    const entry = cache.has_ever_consumed_trial;
    return entry !== undefined && entry.value === true;
  }

  setCustomerState(state: string): void {
    const cache = this._loadCache();
    cache.customer_state = { value: state, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  getCustomerState(): string | null {
    return this.get<string>('customer_state');
  }

  setActiveBinding(bound: boolean): void {
    const cache = this._loadCache();
    cache.active_binding = { value: bound, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  getActiveBinding(): boolean {
    return this.get<boolean>('active_binding') === true;
  }

  setNotificationPrefs(prefs: Record<string, any>): void {
    const cache = this._loadCache();
    cache.notification_prefs = { value: prefs, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  getNotificationPrefs(): Record<string, any> | null {
    return this.get<Record<string, any>>('notification_prefs');
  }

  clearLicenseKey(): void {
    this.delete('license_key');
  }

  // ====================================================================
  // Message Queue (Offline Retry)
  // ====================================================================

  queueMessage(msg: Record<string, any>): void {
    const cache = this._loadCache();
    const queue: Record<string, any>[] = (cache.message_queue?.value as Record<string, any>[] | undefined) || [];
    msg.id = msg.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    msg.status = msg.status || 'pending';
    msg.retry_count = msg.retry_count || 0;
    msg.max_retries = msg.max_retries || 5;
    msg.created_at = msg.created_at || Math.floor(Date.now() / 1000);
    msg.next_retry_at = msg.next_retry_at || Math.floor(Date.now() / 1000) + 60;
    queue.push(msg);
    cache.message_queue = { value: queue, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  getMessageQueue(): Record<string, any>[] {
    const cache = this._loadCache();
    const entry = cache.message_queue;
    if (!entry) return [];
    return entry.value as Record<string, any>[];
  }

  saveMessageQueue(queue: Record<string, any>[]): void {
    const cache = this._loadCache();
    cache.message_queue = { value: queue, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  cleanupSentMessages(): void {
    const queue = this.getMessageQueue().filter(m => m.status !== 'sent');
    this.saveMessageQueue(queue);
  }

  getPendingCount(): number {
    return this.getMessageQueue().filter(m => m.status === 'pending' || m.status === 'failed').length;
  }

  resetAll(): void {
    this.clear();
    this.clearLicenseKey();
  }
}

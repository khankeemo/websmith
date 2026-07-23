import path from 'path';
import os from 'os';

interface CacheEntry {
  value: unknown;
  cached_at: number;
}

export class CacheManager {
  private config: Record<string, any>;
  private productId: string;
  private _cacheDir: string;
  private _cacheFile: string;
  private _tmpFile: string;
  private _corruptFile: string;
  private _ttlDays: number;
  private _cache: Record<string, CacheEntry> | null = null;

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

  private _ensureCacheDir(): void {
    Bun.mkdirSync(this._cacheDir, { recursive: true });
  }

  private async _loadCache(): Promise<Record<string, CacheEntry>> {
    if (this._cache !== null) return this._cache;
    this._ensureCacheDir();
    try {
      const file = Bun.file(this._cacheFile);
      if (await file.exists()) {
        const data = await file.text();
        this._cache = JSON.parse(data);
        return this._cache;
      }
    } catch (_) {
      await this._preserveCorruptCache();
    }
    this._cache = {};
    return this._cache;
  }

  private async _preserveCorruptCache(): Promise<void> {
    try {
      const file = Bun.file(this._cacheFile);
      if (await file.exists()) {
        const corrupt = Bun.file(this._corruptFile);
        if (await corrupt.exists()) await Bun.write(this._corruptFile, ''); // clear
        await Bun.write(this._corruptFile, await file.text());
        await Bun.write(this._cacheFile, '');
      }
    } catch (_) {}
  }

  private async _saveCache(): Promise<void> {
    if (this._cache === null) return;
    this._ensureCacheDir();
    try {
      const data = JSON.stringify(this._cache, null, 2);
      await Bun.write(this._tmpFile, data);
      await Bun.write(this._cacheFile, data);
    } catch (_) {}
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const cache = await this._loadCache();
    const entry = cache[key];
    if (entry === undefined) return null;
    if (this._isExpired(entry)) {
      await this.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    const cache = await this._loadCache();
    cache[key] = { value, cached_at: Date.now() / 1000 };
    await this._saveCache();
  }

  async delete(key: string): Promise<void> {
    const cache = await this._loadCache();
    if (key in cache) {
      delete cache[key];
      await this._saveCache();
    }
  }

  async clear(): Promise<void> {
    this._cache = {};
    await this._saveCache();
  }

  private _isExpired(entry: CacheEntry): boolean {
    const cachedAt = entry.cached_at || 0;
    const ttlSeconds = this._ttlDays * 86400;
    return (Date.now() / 1000 - cachedAt) > ttlSeconds;
  }

  async isValid(): Promise<boolean> {
    const cache = await this._loadCache();
    const entry = cache.license_status;
    if (!entry) return false;
    return !this._isExpired(entry);
  }

  async exists(): Promise<boolean> {
    return await Bun.file(this._cacheFile).exists();
  }

  async getLicenseStatus(): Promise<Record<string, any> | null> {
    return this.get<Record<string, any>>('license_status');
  }

  async setLicenseStatus(status: Record<string, any>): Promise<void> {
    await this.set('license_status', status);
  }

  async invalidateLicenseStatus(): Promise<void> {
    await this.delete('license_status');
  }

  async setOnboardingComplete(): Promise<void> {
    const cache = await this._loadCache();
    cache.onboarding_complete = { value: true, cached_at: Date.now() / 1000 };
    await this._saveCache();
  }

  async isOnboardingComplete(): Promise<boolean> {
    return (await this.get<boolean>('onboarding_complete')) === true;
  }

  async markHasEverActivatedPaidLicense(): Promise<void> {
    const cache = await this._loadCache();
    cache.has_ever_activated_paid_license = { value: true, cached_at: Date.now() / 1000 };
    await this._saveCache();
  }

  async hasEverActivatedPaidLicense(): Promise<boolean> {
    return (await this.get<boolean>('has_ever_activated_paid_license')) === true;
  }
}

import * as path from 'https://deno.land/std@0.208.0/path/mod.ts';

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
    this._cacheDir = path.join(Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '.', '.websmith', safeName);
    this._cacheFile = path.join(this._cacheDir, 'cache.json');
    this._tmpFile = path.join(this._cacheDir, 'cache.tmp');
    this._corruptFile = path.join(this._cacheDir, 'cache.corrupt');
    this._ttlDays = this._getTtl();
  }

  private _getTtl(): number {
    return this.config.offline?.cache_days || 0;
  }

  private async _ensureCacheDir(): Promise<void> {
    await Deno.mkdir(this._cacheDir, { recursive: true });
  }

  private async _loadCache(): Promise<Record<string, CacheEntry>> {
    if (this._cache !== null) return this._cache;
    await this._ensureCacheDir();
    try {
      const fileInfo = await Deno.stat(this._cacheFile).catch(() => null);
      if (fileInfo) {
        const data = await Deno.readTextFile(this._cacheFile);
        this._cache = JSON.parse(data);
        return this._cache;
      }
    } catch {
      await this._preserveCorruptCache();
    }
    this._cache = {};
    return this._cache;
  }

  private async _preserveCorruptCache(): Promise<void> {
    try {
      const fileInfo = await Deno.stat(this._cacheFile).catch(() => null);
      if (fileInfo) {
        const data = await Deno.readTextFile(this._cacheFile);
        await Deno.writeTextFile(this._corruptFile, data);
        await Deno.remove(this._cacheFile);
      }
    } catch {}
  }

  private async _saveCache(): Promise<void> {
    if (this._cache === null) return;
    await this._ensureCacheDir();
    try {
      await Deno.writeTextFile(this._tmpFile, JSON.stringify(this._cache, null, 2));
      await Deno.rename(this._tmpFile, this._cacheFile);
    } catch {
      try { await Deno.remove(this._tmpFile); } catch {}
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const cache = await this._loadCache();
    const entry = cache[key];
    if (!entry) return null;
    if (this._isExpired(entry)) { await this.delete(key); return null; }
    return entry.value as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    const cache = await this._loadCache();
    cache[key] = { value, cached_at: Date.now() / 1000 };
    await this._saveCache();
  }

  async delete(key: string): Promise<void> {
    const cache = await this._loadCache();
    if (key in cache) { delete cache[key]; await this._saveCache(); }
  }

  async clear(): Promise<void> {
    this._cache = {};
    await this._saveCache();
  }

  private _isExpired(entry: CacheEntry): boolean {
    return (Date.now() / 1000 - (entry.cached_at || 0)) > this._ttlDays * 86400;
  }

  async isValid(): Promise<boolean> {
    const cache = await this._loadCache();
    const entry = cache.license_status;
    return entry ? !this._isExpired(entry) : false;
  }

  async exists(): Promise<boolean> {
    return (await Deno.stat(this._cacheFile).catch(() => null)) !== null;
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
}

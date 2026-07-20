export class CacheManager {
  constructor(config) {
    this.config = config;
    this.productId = config.product?.id || 'unknown';
    this._storageKey = `ws_cache_${this.productId}`;
    this._ttlDays = this._getTtl();
    this._cache = null;
  }

  _getTtl() {
    return this.config.offline?.cache_days || 0;
  }

  _loadCache() {
    if (this._cache !== null) return this._cache;
    try {
      const data = localStorage.getItem(this._storageKey);
      if (data) {
        this._cache = JSON.parse(data);
        return this._cache;
      }
    } catch {
      this._cache = {};
    }
    this._cache = {};
    return this._cache;
  }

  _saveCache() {
    if (this._cache === null) return;
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(this._cache));
    } catch {}
  }

  get(key) {
    const cache = this._loadCache();
    const entry = cache[key];
    if (!entry) return null;
    if (this._isExpired(entry)) {
      this.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    const cache = this._loadCache();
    cache[key] = { value, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  delete(key) {
    const cache = this._loadCache();
    if (key in cache) {
      delete cache[key];
      this._saveCache();
    }
  }

  clear() {
    this._cache = {};
    this._saveCache();
  }

  _isExpired(entry) {
    return (Date.now() / 1000 - (entry.cached_at || 0)) > this._ttlDays * 86400;
  }

  isValid() {
    const cache = this._loadCache();
    const entry = cache.license_status;
    return entry ? !this._isExpired(entry) : false;
  }

  exists() {
    return localStorage.getItem(this._storageKey) !== null;
  }

  getLicenseStatus() {
    return this.get('license_status');
  }

  setLicenseStatus(status) {
    this.set('license_status', status);
  }

  invalidateLicenseStatus() {
    this.delete('license_status');
  }

  setOnboardingComplete() {
    const cache = this._loadCache();
    cache.onboarding_complete = { value: true, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  isOnboardingComplete() {
    return this.get('onboarding_complete') === true;
  }
}

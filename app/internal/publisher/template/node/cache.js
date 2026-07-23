const fs = require('fs');
const path = require('path');
const os = require('os');

class CacheManager {
  constructor(config) {
    this.config = config;
    this.productId = config.product?.id || 'unknown';
    const safeName = this.productId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    this._cacheDir = path.join(os.homedir(), '.websmith', safeName);
    this._cacheFile = path.join(this._cacheDir, 'cache.json');
    this._tmpFile = path.join(this._cacheDir, 'cache.tmp');
    this._corruptFile = path.join(this._cacheDir, 'cache.corrupt');
    this._ttlDays = this._getTtl();
    this._cache = null;
  }

  _getTtl() {
    return this.config.offline?.cache_days || 0;
  }

  _ensureCacheDir() {
    fs.mkdirSync(this._cacheDir, { recursive: true });
  }

  _loadCache() {
    if (this._cache !== null) return this._cache;
    this._ensureCacheDir();
    try {
      if (fs.existsSync(this._cacheFile)) {
        const data = fs.readFileSync(this._cacheFile, 'utf-8');
        this._cache = JSON.parse(data);
        return this._cache;
      }
    } catch (_) {
      this._preserveCorruptCache();
    }
    this._cache = {};
    return this._cache;
  }

  _preserveCorruptCache() {
    try {
      if (fs.existsSync(this._cacheFile)) {
        if (fs.existsSync(this._corruptFile)) fs.unlinkSync(this._corruptFile);
        fs.renameSync(this._cacheFile, this._corruptFile);
      }
    } catch (_) {
      try { if (fs.existsSync(this._cacheFile)) fs.unlinkSync(this._cacheFile); } catch (_) {}
    }
  }

  _saveCache() {
    if (this._cache === null) return;
    this._ensureCacheDir();
    try {
      fs.writeFileSync(this._tmpFile, JSON.stringify(this._cache, null, 2), 'utf-8');
      fs.renameSync(this._tmpFile, this._cacheFile);
    } catch (_) {
      try { if (fs.existsSync(this._tmpFile)) fs.unlinkSync(this._tmpFile); } catch (_) {}
    }
  }

  get(key) {
    const cache = this._loadCache();
    const entry = cache[key];
    if (entry === undefined) return null;
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
    const cachedAt = entry.cached_at || 0;
    const ttlSeconds = this._ttlDays * 86400;
    return (Date.now() / 1000 - cachedAt) > ttlSeconds;
  }

  isValid() {
    const cache = this._loadCache();
    const entry = cache.license_status;
    if (!entry) return false;
    return !this._isExpired(entry);
  }

  exists() {
    return fs.existsSync(this._cacheFile);
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

  markHasEverActivatedPaidLicense() {
    const cache = this._loadCache();
    cache.has_ever_activated_paid_license = { value: true, cached_at: Date.now() / 1000 };
    this._saveCache();
  }

  hasEverActivatedPaidLicense() {
    return this.get('has_ever_activated_paid_license') === true;
  }
}

module.exports = { CacheManager };

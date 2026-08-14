(function(global) {
    'use strict';

    var CONFIG = global.__WEBSMITH_CONFIG__ || {};
    var API_URL = (global.WEBSMITH_API_URL || CONFIG.apiUrl || '').replace(/\/+$/, '');
    var API_KEY = CONFIG.apiKey || '';
    var API_SECRET = CONFIG.apiSecret || '';
    var PRODUCT_ID = CONFIG.productId || '';
    var TIMEOUT = CONFIG.timeout || 30000;
    var MAX_RETRIES = CONFIG.maxRetries || 3;
    var CACHE_PREFIX = CONFIG.cachePrefix || 'websmith_';
    var CACHE_TTL = CONFIG.cacheTTL ?? 0;

    // ─── Utilities ──────────────────────────────────────────────

    function generateUUID() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    function generateTimestamp() {
        return new Date().toISOString();
    }

    function sha256(data) {
        if (typeof crypto === 'undefined' || !crypto.subtle || !crypto.subtle.digest) {
            return Promise.reject(new Error('Web Crypto API (crypto.subtle) is not available. Ensure the page is served over HTTPS or localhost.'));
        }
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
            .then(function(hash) {
                return Array.from(new Uint8Array(hash)).map(function(b) {
                    return b.toString(16).padStart(2, '0');
                }).join('');
            });
    }

    function hmacSha256(secret, message) {
        if (typeof crypto === 'undefined' || !crypto.subtle || !crypto.subtle.importKey) {
            return Promise.reject(new Error('Web Crypto API (crypto.subtle) is not available. Ensure the page is served over HTTPS or localhost.'));
        }
        return crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(function(key) {
            return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
        }).then(function(sig) {
            var bytes = new Uint8Array(sig);
            var binary = '';
            for (var i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        });
    }

    // ─── HardwareFingerprint ────────────────────────────────────

    function HardwareFingerprint() {}

    HardwareFingerprint.generate = function() {
        var parts = [];

        parts.push(navigator.userAgent || '');
        parts.push(String(screen.width) + 'x' + String(screen.height));
        parts.push(String(screen.colorDepth || 24));
        parts.push(navigator.language || '');
        parts.push(navigator.platform || '');
        parts.push(String(navigator.hardwareConcurrency || ''));
        parts.push(String(navigator.deviceMemory || ''));
        parts.push(Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : '');

        try {
            var canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            var ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.textBaseline = 'alphabetic';
                ctx.fillStyle = '#f60';
                ctx.fillRect(0, 0, 256, 64);
                ctx.fillStyle = '#069';
                ctx.font = '16px Arial';
                ctx.fillText('Websmith\u00aeBrowserSDK', 8, 24);
                ctx.fillStyle = '#906';
                ctx.font = '12px Courier';
                ctx.fillText(navigator.userAgent || '', 8, 48);
                parts.push(canvas.toDataURL());
            }
        } catch (e) {
            parts.push('canvas_error');
        }

        return sha256(parts.join('|||')).then(function(hash) {
            return {
                fingerprint: hash,
                userAgent: navigator.userAgent,
                screen: screen.width + 'x' + screen.height,
                timezone: Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : '',
                canvasSupported: true
            };
        });
    };

    // ─── CacheManager ───────────────────────────────────────────

    function CacheManager(prefix, defaultTTL) {
        this.prefix = prefix || CACHE_PREFIX;
        this.defaultTTL = defaultTTL || CACHE_TTL;
    }

    CacheManager.prototype.set = function(key, value, ttl) {
        try {
            var item = JSON.stringify({
                value: value,
                expires: Date.now() + (ttl || this.defaultTTL)
            });
            localStorage.setItem(this.prefix + key, item);
            return true;
        } catch (e) {
            return false;
        }
    };

    CacheManager.prototype.get = function(key) {
        try {
            var raw = localStorage.getItem(this.prefix + key);
            if (!raw) return null;
            var item = JSON.parse(raw);
            if (item.expires && Date.now() > item.expires) {
                localStorage.removeItem(this.prefix + key);
                return null;
            }
            return item.value;
        } catch (e) {
            return null;
        }
    };

    CacheManager.prototype.remove = function(key) {
        try {
            localStorage.removeItem(this.prefix + key);
        } catch (e) {}
    };

    CacheManager.prototype.clear = function() {
        try {
            var toRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(this.prefix) === 0) {
                    toRemove.push(k);
                }
            }
            for (var j = 0; j < toRemove.length; j++) {
                localStorage.removeItem(toRemove[j]);
            }
        } catch (e) {}
    };

    // ─── WebsmithClient (API Client) ────────────────────────────

    function WebsmithClient(config) {
        config = config || {};
        this.apiUrl = (config.apiUrl || API_URL).replace(/\/+$/, '');
        this.apiKey = config.apiKey || API_KEY;
        this.apiSecret = config.apiSecret || API_SECRET;
        this.productId = config.productId || PRODUCT_ID;
        this.timeout = config.timeout || TIMEOUT;
        this.maxRetries = config.maxRetries || MAX_RETRIES;
    }

    WebsmithClient.prototype._signRequest = function(payload, endpoint, timestamp, nonce) {
        var self = this;
        var payloadJson = JSON.stringify(payload, Object.keys(payload).sort());
        return sha256(payloadJson).then(function(bodyHash) {
            var message = 'POST\n/api/v1/' + endpoint + '\n\n' + bodyHash + '\n' + timestamp + '\n' + nonce;
            return hmacSha256(self.apiSecret, message);
        });
    };

    WebsmithClient.prototype._request = function(endpoint, payload) {
        var self = this;
        var url = this.apiUrl + '/api/v1/' + endpoint;
        var attempt = 0;

        function doRequest() {
            var timestamp = generateTimestamp();
            var nonce = generateUUID();
            var requestPayload = {};
            for (var k in payload) {
                if (payload.hasOwnProperty(k)) requestPayload[k] = payload[k];
            }
            if (self.productId && !requestPayload.product_id) {
                requestPayload.product_id = self.productId;
            }

            return self._signRequest(requestPayload, endpoint, timestamp, nonce).then(function(signature) {
                var headers = {
                    'Content-Type': 'application/json',
                    'x-api-key': self.apiKey,
                    'x-timestamp': timestamp,
                    'x-nonce': nonce,
                    'x-signature': signature
                };

                var controller = new AbortController();
                var timeoutId = setTimeout(function() { controller.abort(); }, self.timeout);

                return fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(requestPayload),
                    signal: controller.signal
                }).then(function(response) {
                    clearTimeout(timeoutId);
                    return response.text().then(function(text) {
                        var data;
                        try {
                            data = JSON.parse(text);
                        } catch (e) {
                            data = { message: text };
                        }
                        if (!response.ok) {
                            var err = new Error(data.message || 'HTTP ' + response.status);
                            err.status = response.status;
                            err.data = data;
                            throw err;
                        }
                        return data;
                    });
                }).catch(function(err) {
                    clearTimeout(timeoutId);
                    attempt++;
                    if (attempt <= self.maxRetries && (!err.status || err.status >= 500)) {
                        var delay = Math.pow(2, attempt - 1) * 1000;
                        return new Promise(function(resolve) {
                            setTimeout(function() { resolve(doRequest()); }, delay);
                        });
                    }
                    throw err;
                });
            });
        }

        return doRequest();
    };

    WebsmithClient.prototype.validateLicense = function(licenseKey, hardwareId) {
        return this._request('license', {
            action: 'validate', license_key: licenseKey, hardware_id: hardwareId
        });
    };

    WebsmithClient.prototype.activateLicense = function(licenseKey, hardwareId, deviceName) {
        return this._request('license', {
            action: 'activate', license_key: licenseKey, hardware_id: hardwareId, device_name: deviceName || ''
        });
    };

    WebsmithClient.prototype.deactivateLicense = function(licenseKey, hardwareId) {
        return this._request('license', {
            action: 'deactivate', license_key: licenseKey, hardware_id: hardwareId
        });
    };

    WebsmithClient.prototype.renewLicense = function(licenseKey, hardwareId) {
        return this._request('license', {
            action: 'renew', license_key: licenseKey, hardware_id: hardwareId
        });
    };

    WebsmithClient.prototype.bindDevice = function(licenseKey, hardwareId, deviceName) {
        return this._request('device', {
            action: 'bind', license_key: licenseKey, hardware_id: hardwareId, device_name: deviceName || ''
        });
    };

    WebsmithClient.prototype.startTrial = function(email, customerName, customerData) {
        var payload = { action: 'start', customer_email: email, customer_name: customerName || '' };
        if (customerData) {
            for (var k in customerData) {
                if (customerData.hasOwnProperty(k)) payload[k] = customerData[k];
            }
        }
        return this._request('trial', payload);
    };

    WebsmithClient.prototype.checkTrial = function(hardwareId) {
        return this._request('trial', { action: 'status', hardware_id: hardwareId });
    };

    WebsmithClient.prototype.convertTrial = function(hardwareId, plan, name, email) {
        return this._request('trial', {
            action: 'convert', hardware_id: hardwareId,
            plan: plan, customer_name: name, customer_email: email
        });
    };

    WebsmithClient.prototype.getTrialStatus = function(hardwareId) {
        return this._request('trial', { action: 'status', hardware_id: hardwareId });
    };

    WebsmithClient.prototype.getProducts = function() {
        var payload = { action: 'list' };
        if (this.productId) payload.product_id = this.productId;
        return this._request('store/products', payload);
    };

    // ─── LicenseEngine ──────────────────────────────────────────

    function LicenseEngine(config) {
        config = config || {};
        this._client = new WebsmithClient(config);
        this._cache = new CacheManager(
            config.cachePrefix || CACHE_PREFIX,
            config.cacheTTL || CACHE_TTL
        );
        this._licenseData = null;
        this._fingerprintData = null;
        this._initialized = false;
    }

    LicenseEngine.prototype.initialize = function() {
        var self = this;
        return HardwareFingerprint.generate().then(function(fp) {
            self._fingerprintData = fp;
            self._initialized = true;
            var cached = self._cache.get('license');
            if (cached) {
                self._licenseData = cached;
            }
            return { fingerprint: fp.fingerprint, cached: !!cached };
        });
    };

    LicenseEngine.prototype._ensureInitialized = function() {
        if (!this._initialized) {
            throw new Error('LicenseEngine not initialized. Call initialize() first.');
        }
    };

    LicenseEngine.prototype._getHardwareId = function() {
        return this._fingerprintData ? this._fingerprintData.fingerprint : '';
    };

    LicenseEngine.prototype.validate = function(licenseKey) {
        this._ensureInitialized();
        var self = this;
        return this._client.validateLicense(licenseKey, this._getHardwareId())
            .then(function(result) {
                self._licenseData = result.license || null;
                if (self._licenseData) {
                    self._cache.set('license', self._licenseData);
                }
                return result;
            });
    };

    LicenseEngine.prototype.activate = function(licenseKey, deviceName) {
        this._ensureInitialized();
        var self = this;
        return this._client.activateLicense(licenseKey, this._getHardwareId(), deviceName)
            .then(function(result) {
                self._licenseData = result.license || null;
                if (self._licenseData) {
                    self._cache.set('license', self._licenseData);
                }
                return result;
            });
    };

    LicenseEngine.prototype.deactivate = function(licenseKey) {
        this._ensureInitialized();
        var self = this;
        return this._client.deactivateLicense(licenseKey, this._getHardwareId())
            .then(function(result) {
                self._licenseData = null;
                self._cache.remove('license');
                return result;
            });
    };

    LicenseEngine.prototype.renew = function(licenseKey) {
        this._ensureInitialized();
        var self = this;
        return this._client.renewLicense(licenseKey, this._getHardwareId())
            .then(function(result) {
                self._licenseData = result.license || null;
                if (self._licenseData) {
                    self._cache.set('license', self._licenseData);
                }
                return result;
            });
    };

    LicenseEngine.prototype.startTrial = function(email, customerName, customerData) {
        this._ensureInitialized();
        return this._client.startTrial(email, customerName, customerData);
    };

    LicenseEngine.prototype.checkTrial = function(hardwareId) {
        this._ensureInitialized();
        return this._client.checkTrial(hardwareId || this._getHardwareId());
    };

    LicenseEngine.prototype.convertTrial = function(plan, name, email) {
        this._ensureInitialized();
        var self = this;
        return this._client.convertTrial(this._getHardwareId(), plan, name, email)
            .then(function(result) {
                if (result.license) {
                    self._licenseData = result.license;
                    self._cache.set('license', self._licenseData);
                }
                return result;
            });
    };

    LicenseEngine.prototype.bindDevice = function(licenseKey, deviceName) {
        this._ensureInitialized();
        var self = this;
        return this._client.bindDevice(licenseKey, this._getHardwareId(), deviceName)
            .then(function(result) {
                if (result.license) {
                    self._licenseData = result.license;
                    self._cache.set('license', self._licenseData);
                }
                return result;
            });
    };

    LicenseEngine.prototype.viewHardwareStatus = function() {
        var currentHwId = this._getHardwareId();
        var self = this;
        return this.validate().then(function(status) {
            var registeredHwId = (status && status.data && status.data.hardware_id) || '';
            return { matched: currentHwId === registeredHwId, current_hardware_id: currentHwId, registered_hardware_id: registeredHwId };
        });
    };

    LicenseEngine.prototype.hasLicenseKey = function() {
        return !!(this._licenseData && this._licenseData.license_key);
    };

    LicenseEngine.prototype.isValid = function() {
        if (!this._licenseData) return false;
        if (this._licenseData.status !== 'active') return false;
        if (this._licenseData.expires_at) {
            if (new Date(this._licenseData.expires_at) < new Date()) return false;
        }
        return true;
    };

    LicenseEngine.prototype.getLicenseInfo = function() {
        return this._licenseData ? JSON.parse(JSON.stringify(this._licenseData)) : null;
    };

    // ─── Global Exports ─────────────────────────────────────────

    global.WebsmithClient = WebsmithClient;
    global.WebsmithLicenseEngine = LicenseEngine;
    global.WebsmithHardwareFingerprint = HardwareFingerprint;
    global.WebsmithCacheManager = CacheManager;

})(typeof window !== 'undefined' ? window : this);

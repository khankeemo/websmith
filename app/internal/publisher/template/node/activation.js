const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');
const { ApiClient } = require('./client');
const { HardwareDetector } = require('./hardware');
const { CacheManager } = require('./cache');

function loadApiConfig() {
  const paths = [
    path.join(__dirname, 'config', 'api-config.json'),
    path.join(process.cwd(), 'config', 'api-config.json'),
  ];
  for (const p of paths) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (_) {}
  }
  return {};
}

class ActivationDialog {
  constructor(client, productName, cache) {
    this.config = loadApiConfig();
    this.client = client;
    this.productName = productName || this.config.product?.name || '';
    this.cache = cache || new CacheManager(this.config);
    this.hardware = new HardwareDetector();
    this._hardwareId = null;
    this._deviceName = os.hostname();
    this._platform = os.platform();
    this._licenseKey = null;
    this._validateData = null;
    this._trialData = null;
    this._activated = false;
    this._cancelled = false;
    this._customerData = {};
    this._initCompleted = { hardware: false, products: false };
    this._initialized = false;
    this._hardwareOk = false;
    this._productsOk = false;
    this._rl = null;
  }

  async show() {
    this._rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('=== UNIVERSAL LICENSE ACTIVATION ===');
    console.log(`Product: ${this.productName}`);
    console.log(`Device: ${this._deviceName}`);
    console.log(`Platform: ${this._platform}`);
    console.log('');
    await this._initialize();
    await this._mainLoop();
    this._rl.close();
    return {
      activated: this._activated,
      cancelled: this._cancelled,
      license_key: this._licenseKey,
    };
  }

  async _initialize() {
    console.log('Detecting hardware...');
    try {
      this._hardwareId = this.hardware.getFingerprint();
      if (!this._hardwareId) {
        console.log('Unable to detect hardware.');
        this._hardwareOk = false;
      } else {
        console.log(`Hardware ID: ${this._hardwareId}`);
        this._hardwareOk = true;
      }
    } catch (e) {
      console.log(`Hardware error: ${e.message}`);
      this._hardwareOk = false;
    }
    this._initCompleted.hardware = true;

    console.log('Loading products...');
    try {
      const result = await this.client.getProducts();
      const products = result.products || [];
      if (products.length > 0) {
        this._products = products;
        this._productsOk = true;
        console.log(`Found ${products.length} product(s).`);
      } else {
        console.log('No products available.');
        this._productsOk = false;
      }
    } catch (e) {
      console.log(`Failed to load products: ${e.message}`);
      this._productsOk = false;
    }
    this._initCompleted.products = true;

    if (this._hardwareOk && this._productsOk) {
      console.log('Hardware verified. Activation available.');
      try {
        const trialResult = await this.client.getTrialStatus(this._hardwareId);
        const trialData = trialResult.data || {};
        if (trialData.has_trial) {
          this._trialData = trialData;
          console.log(`Trial active — ${trialData.days_left || 0} day(s) remaining.`);
        }
      } catch (_) {}
    } else {
      console.log('Initialization incomplete. Some features may be unavailable.');
    }
    console.log('');
  }

  async _mainLoop() {
    while (!this._activated && !this._cancelled) {
      console.log('Options:');
      console.log('  1. Enter license key');
      console.log('  2. Refresh trial status');
      if (this._licenseKey) console.log('  3. Activate license');
      console.log('  0. Cancel');
      const answer = await this._question('Choose: ');
      switch (answer.trim()) {
        case '1':
          await this._enterLicenseKey();
          break;
        case '2':
          await this._refreshStatus();
          break;
        case '3':
          if (this._licenseKey) await this._activate();
          break;
        case '0':
          this._cancelled = true;
          return;
        default:
          console.log('Invalid option.');
      }
      console.log('');
    }
  }

  async _enterLicenseKey() {
    const key = await this._question('License key: ');
    if (!key.trim()) return;
    console.log('Validating license...');
    try {
      const result = await this.client.validateLicense(key.trim(), this._hardwareId);
      if (result.valid || result.data?.valid) {
        const data = result.data || result;
        this._validateData = data;
        this._licenseKey = key.trim();
        console.log('License validated successfully.');
        if (data.expiry_date) console.log(`Expiry: ${data.expiry_date}`);
        if (data.plan) console.log(`Plan: ${data.plan}`);
      } else {
        console.log(`Validation failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }

  async _refreshStatus() {
    try {
      const result = await this.client.getTrialStatus(this._hardwareId);
      const data = result.data || {};
      if (data.has_trial) {
        console.log(`Trial: ${data.days_left || 0} day(s) remaining, status: ${data.status}`);
      } else {
        console.log('No active trial.');
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }

  async _activate() {
    if (!this._licenseKey || !this._hardwareId) {
      console.log('License key or hardware not available.');
      return;
    }
    console.log('Activating license...');
    try {
      const result = await this.client.activateLicense(this._licenseKey, this._hardwareId);
      if (result.success || result.data?.success) {
        this._activated = true;
        console.log('License activated successfully!');
        this.cache.invalidateLicenseStatus();
      } else {
        console.log(`Activation failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }

  _question(prompt) {
    return new Promise((resolve) => {
      this._rl.question(prompt, resolve);
    });
  }
}

module.exports = { ActivationDialog };

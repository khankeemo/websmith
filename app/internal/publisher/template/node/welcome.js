const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

class WelcomeDialog {
  constructor(client, productName, cache) {
    this.config = loadApiConfig();
    this.client = client;
    this.productName = productName || this.config.product?.name || '';
    this.cache = cache || new CacheManager(this.config);
    this.hardware = new HardwareDetector();
    this._result = null;
    this._trialEnabled = this.config.trial?.enabled || false;
  }

  isOnboardingComplete() {
    return this.cache.isOnboardingComplete();
  }

  async show() {
    if (!this._trialEnabled) {
      return { skipped: true, message: 'Trial onboarding is not enabled' };
    }
    if (this.isOnboardingComplete()) {
      return { skipped: true, message: 'Onboarding already completed' };
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q) => new Promise((resolve) => rl.question(q, resolve));

    console.log('=== Welcome ===');
    console.log(`Product: ${this.productName}`);
    console.log('Complete your registration to start the trial.');
    console.log('');

    const name = await question('Name *: ');
    const email = await question('Email *: ');
    const mobile = await question('Mobile Number *: ');
    const company = await question('Company (optional): ');

    if (!name.trim() || !email.trim() || !mobile.trim()) {
      console.log('Name, email, and mobile number are required.');
      rl.close();
      return { skipped: true, message: 'Validation failed' };
    }

    console.log('Starting trial...');
    try {
      const hardwareId = this.hardware.getFingerprint();
      await this.client._request('customer/register', {
        name: name.trim(), email: email.trim(), mobile: mobile.trim(),
        company_name: company.trim(), hardware_id: hardwareId,
      });
      await this.client.startTrial(email.trim(), name.trim(), {
        mobile: mobile.trim(), company_name: company.trim(), hardware_id: hardwareId,
      });
      this.cache.setOnboardingComplete();
      this._result = {
        name: name.trim(), email: email.trim(), hardware_id: hardwareId,
        onboarding_complete: true,
      };
      console.log('Trial activated! You can now use the software.');
    } catch (e) {
      console.log(`Error: ${e.message}`);
      this._result = { skipped: true, message: e.message };
    }

    rl.close();
    return this._result || { skipped: true };
  }
}

module.exports = { WelcomeDialog };

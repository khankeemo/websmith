class SettingsWidget {
  constructor(parent, engine) {
    this.parent = parent;
    this.engine = engine;
  }

  async refresh() {
    const status = this.engine.getStatus() || await this.engine.initialize();
    const config = this.engine.config;
    console.log('=== License Information ===');
    console.log(`Status: ${status ? status.status.toUpperCase() : 'UNKNOWN'}`);
    console.log(`Product: ${config.product?.name || '--'}`);
    console.log(`Expiry: ${status?.expires_at || 'N/A'}`);
    console.log(`Plan: ${status?.plan || 'N/A'}`);
    console.log(`Hardware ID: ${status?.hardware_id || '--'}`);
    console.log(`Runtime: Node.js`);
    console.log(`SDK Version: ${config.product?.version || '--'}`);
    console.log('');
    console.log('Actions: (1) Activate  (2) Renew  (3) Replace Device  (4) Open Welcome');
  }

  async openActivation() {
    const { ActivationDialog } = require('../activation');
    const client = this.engine._client;
    const cache = this.engine._cache;
    await new ActivationDialog(client, this.engine.config.product?.name || '', cache).show();
    await this.refresh();
  }

  async openRenewal() {
    const { RenewalDialog } = require('../renewal');
    const key = this.engine.getLicenseKey();
    if (key) {
      await new RenewalDialog(this.engine, key).show();
      await this.refresh();
    }
  }

  async openReplace() {
    const { DeviceReplaceDialog } = require('../device_replace');
    const key = this.engine.getLicenseKey();
    if (key) {
      await new DeviceReplaceDialog(this.engine, key).show();
      await this.refresh();
    }
  }

  async openWelcome() {
    const { WelcomeDialog } = require('../welcome');
    const client = this.engine._client;
    await new WelcomeDialog(client, this.engine.config.product?.name || '').show();
    await this.refresh();
  }
}

module.exports = { SettingsWidget };

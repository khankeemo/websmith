import { LicenseEngine } from '../license_engine';
import { ActivationDialog } from '../activation';
import { RenewalDialog } from '../renewal';
import { DeviceReplaceDialog } from '../device_replace';
import { WelcomeDialog } from '../welcome';

export class SettingsWidget {
  private engine: LicenseEngine;

  constructor(parent: any, engine: LicenseEngine) {
    this.engine = engine;
  }

  async refresh(): Promise<void> {
    const status = this.engine.getStatus() || await this.engine.initialize();
    const config = this.engine.config;
    console.log('=== License Information ===');
    console.log(`Status: ${status ? status.status.toUpperCase() : 'UNKNOWN'}`);
    console.log(`Product: ${config.product?.name || '--'}`);
    console.log(`Expiry: ${status?.expires_at || 'N/A'}`);
    console.log(`Plan: ${status?.plan || 'N/A'}`);
    console.log(`Hardware ID: ${status?.hardware_id || '--'}`);
    console.log(`Runtime: TypeScript`);
    console.log(`SDK Version: ${config.product?.version || '--'}`);
    console.log('');
    console.log('Actions: (1) Activate  (2) Renew  (3) Replace Device  (4) Open Welcome');
  }

  async openActivation(): Promise<void> {
    const client = this.engine._client;
    const cache = this.engine._cache;
    await new ActivationDialog(client, this.engine.config.product?.name || '', cache).show();
    await this.refresh();
  }

  async openRenewal(): Promise<void> {
    const key = this.engine.getLicenseKey();
    if (key) {
      await new RenewalDialog(this.engine, key).show();
      await this.refresh();
    }
  }

  async openReplace(): Promise<void> {
    const key = this.engine.getLicenseKey();
    if (key) {
      await new DeviceReplaceDialog(this.engine, key).show();
      await this.refresh();
    }
  }

  async openWelcome(): Promise<void> {
    const client = this.engine._client;
    const cache = this.engine._cache;
    await new WelcomeDialog(client, this.engine.config.product?.name || '', cache).show();
    await this.refresh();
  }
}

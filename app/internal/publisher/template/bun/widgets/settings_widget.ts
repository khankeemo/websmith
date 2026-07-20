export class SettingsWidget {
  private engine: any;

  constructor(parent: any, engine: any) { this.engine = engine; }

  async refresh(): Promise<void> {
    const s = this.engine.getStatus() || await this.engine.initialize();
    const cfg = this.engine.config;
    console.log('=== License Information ===');
    console.log(`Status: ${s ? s.status.toUpperCase() : 'UNKNOWN'}`);
    console.log(`Product: ${cfg.product?.name || '--'}`);
    console.log(`Expiry: ${s?.expires_at || 'N/A'}  Plan: ${s?.plan || 'N/A'}`);
    console.log(`Hardware ID: ${s?.hardware_id || '--'}`);
    console.log(`Runtime: Bun  SDK: ${cfg.product?.version || '--'}`);
  }

  async openActivation(): Promise<void> {
    const { ActivationDialog } = await import('../activation');
    await new ActivationDialog(this.engine._client, this.engine.config.product?.name || '', this.engine._cache).show();
    await this.refresh();
  }

  async openRenewal(): Promise<void> {
    const key = this.engine.getLicenseKey();
    if (key) { const { RenewalDialog } = await import('../renewal'); await new RenewalDialog(this.engine, key).show(); await this.refresh(); }
  }

  async openReplace(): Promise<void> {
    const key = this.engine.getLicenseKey();
    if (key) { const { DeviceReplaceDialog } = await import('../device_replace'); await new DeviceReplaceDialog(this.engine, key).show(); await this.refresh(); }
  }

  async openWelcome(): Promise<void> {
    const { WelcomeDialog } = await import('../welcome');
    await new WelcomeDialog(this.engine._client, this.engine.config.product?.name || '', this.engine._cache).show();
    await this.refresh();
  }
}

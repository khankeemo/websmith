export class SettingsWidget {
  private engine: any;
  constructor(parent: any, engine: any) { this.engine = engine; }

  async refresh(): Promise<void> {
    const s = this.engine.getStatus() || await this.engine.initialize();
    const c = this.engine.config;
    console.log('=== License Info ===');
    console.log(`Status: ${s ? s.status.toUpperCase() : 'UNKNOWN'}`);
    console.log(`Product: ${c.product?.name || '--'}`);
    console.log(`Expiry: ${s?.expires_at || 'N/A'}  Plan: ${s?.plan || 'N/A'}`);
    console.log(`HW: ${s?.hardware_id || '--'}  Runtime: Deno  SDK: ${c.product?.version || '--'}`);
  }

  async openActivation(): Promise<void> {
    const { ActivationDialog } = await import('../activation.ts');
    await new ActivationDialog(this.engine._client, this.engine.config.product?.name || '', this.engine._cache).show();
    await this.refresh();
  }

  async openRenewal(): Promise<void> {
    const k = this.engine.getLicenseKey();
    if (k) { const { RenewalDialog } = await import('../renewal.ts'); await new RenewalDialog(this.engine, k).show(); await this.refresh(); }
  }

  async openReplace(): Promise<void> {
    const k = this.engine.getLicenseKey();
    if (k) { const { DeviceReplaceDialog } = await import('../device_replace.ts'); await new DeviceReplaceDialog(this.engine, k).show(); await this.refresh(); }
  }

  async openWelcome(): Promise<void> {
    const { WelcomeDialog } = await import('../welcome.ts');
    await new WelcomeDialog(this.engine._client, this.engine.config.product?.name || '', this.engine._cache).show();
    await this.refresh();
  }
}

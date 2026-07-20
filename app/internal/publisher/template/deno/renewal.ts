import { LicenseEngine } from './license_engine.ts';

export class RenewalDialog {
  private engine: LicenseEngine;
  private licenseKey: string;
  result: Record<string, any> | null = null;

  constructor(engine: LicenseEngine, licenseKey: string) {
    this.engine = engine;
    this.licenseKey = licenseKey;
    engine._licenseKey = licenseKey;
  }

  async show(): Promise<Record<string, any> | null> {
    console.log('=== Renew License ===');
    const s = this.engine.getStatus();
    console.log(`Plan: ${s?.plan || '--'}  Expiry: ${s?.expires_at || 'N/A'}`);
    try {
      console.log('Loading plans...');
      const pr = await this.engine.getPlans();
      if (pr.success) {
        const plans = pr.data || pr.plans || [];
        plans.forEach((p: any, i: number) =>
          console.log(`  ${i + 1}. ${p.name} — $${p.price} (${p.duration_days || '--'} days)`));
        const c = (await this._prompt('Select plan (0 to cancel): ')).trim();
        const idx = parseInt(c, 10) - 1;
        if (idx >= 0 && idx < plans.length) {
          const r = await this.engine.renew(plans[idx].id || plans[idx].name);
          if (r.success) { console.log('Renewed!'); this.result = { action: 'renewed' }; }
          else { console.log(`Failed: ${r.message}`); }
        }
      }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
    return this.result;
  }

  private async _prompt(msg: string): Promise<string> {
    await Deno.stdout.write(new TextEncoder().encode(msg));
    const buf = new Uint8Array(1024);
    const n = await Deno.stdin.read(buf);
    return new TextDecoder().decode(buf.subarray(0, n || 0)).trim();
  }
}

import { LicenseEngine } from './license_engine';

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
    console.log('');
    const encoder = new TextEncoder();
    console.log('Loading plans...');
    try {
      const pr = await this.engine.getPlans();
      if (pr.success) {
        const plans = pr.data || pr.plans || [];
        plans.forEach((p: any, i: number) => console.log(`  ${i + 1}. ${p.name} — $${p.price} (${p.duration_days || '--'} days)`));
        const reader = Bun.stdin.stream.getReader();
        Bun.stdout.write(encoder.encode('Select plan (0 to cancel): '));
        const decoder = new TextDecoder();
        let line = '';
        while (true) { const { value, done } = await reader.read(); if (done) break; line += decoder.decode(value, { stream: true }); if (line.includes('\n')) break; }
        reader.releaseLock();
        const idx = parseInt(line.trim(), 10) - 1;
        if (idx >= 0 && idx < plans.length) {
          console.log('Processing...');
          const r = await this.engine.renew(plans[idx].id || plans[idx].name);
          if (r.success) { console.log('Renewed!'); this.result = { action: 'renewed' }; }
          else { console.log(`Failed: ${r.message}`); }
        }
      }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
    return this.result;
  }
}

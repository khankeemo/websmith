import * as readline from 'readline';
import { LicenseEngine } from './license_engine';

export class RenewalDialog {
  private engine: LicenseEngine;
  private client: any;
  private config: Record<string, any>;
  private licenseKey: string;
  result: Record<string, any> | null = null;
  private plans: any[] = [];

  constructor(engine: LicenseEngine, licenseKey: string) {
    this.engine = engine;
    this.client = engine._client;
    this.config = engine.config;
    this.licenseKey = licenseKey;
    engine._licenseKey = licenseKey;
  }

  async show(): Promise<Record<string, any> | null> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

    console.log('=== Renew License ===');
    const status = this.engine.getStatus();
    console.log(`Plan: ${status?.plan || '--'}`);
    console.log(`Expiry: ${status?.expires_at || 'N/A'}`);
    console.log('');

    console.log('Loading plans...');
    try {
      const plansResult = await this.engine.getPlans();
      if (plansResult.success) {
        this.plans = plansResult.data || plansResult.plans || [];
        this.plans.forEach((p: any, i: number) => {
          console.log(`  ${i + 1}. ${p.name} — $${p.price} (${p.duration_days || p.default_expiry_days || '--'} days)`);
        });
      } else {
        console.log('No plans available.');
      }
    } catch (e) {
      console.log(`Error loading plans: ${(e as Error).message}`);
    }

    const choice = await question('\nSelect plan number or 0 to cancel: ');
    const idx = parseInt(choice, 10) - 1;
    if (idx >= 0 && idx < this.plans.length) {
      const selectedPlan = this.plans[idx];
      console.log('Processing renewal...');
      try {
        const result = await this.engine.renew(selectedPlan.id || selectedPlan.name);
        if (result.success) {
          console.log('License renewed successfully!');
          this.result = { action: 'renewed' };
        } else {
          console.log(`Renewal failed: ${result.message || 'Unknown error'}`);
        }
      } catch (e) {
        console.log(`Error: ${(e as Error).message}`);
      }
    } else {
      console.log('Cancelled.');
    }

    rl.close();
    return this.result;
  }
}

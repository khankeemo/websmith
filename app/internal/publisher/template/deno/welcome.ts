import * as path from 'https://deno.land/std@0.208.0/path/mod.ts';
import { ApiClient } from './client.ts';
import { HardwareDetector } from './hardware.ts';
import { CacheManager } from './cache.ts';

async function loadApiConfig(): Promise<Record<string, any>> {
  try { return JSON.parse(await Deno.readTextFile(path.join(Deno.cwd(), 'config', 'api-config.json'))); } catch { return {}; }
}

export class WelcomeDialog {
  private config: Record<string, any> = {};
  private client: ApiClient;
  private productName: string;
  private cache: CacheManager;
  private hardware: HardwareDetector;
  private _trialEnabled = false;

  constructor(client: ApiClient, productName?: string, cache?: CacheManager) {
    this.client = client;
    this.productName = productName || '';
    this.cache = cache || new CacheManager({});
    this.hardware = new HardwareDetector();
  }

  isOnboardingComplete(): boolean { return this.cache.isOnboardingComplete(); }

  async show(): Promise<Record<string, any>> {
    this.config = await loadApiConfig();
    this.productName = this.productName || this.config.product?.name || '';
    this._trialEnabled = this.config.trial?.enabled || false;
    if (!this._trialEnabled) return { skipped: true, message: 'Trial not enabled' };
    if (await this.cache.isOnboardingComplete()) return { skipped: true, message: 'Already completed' };

    console.log('=== Welcome ===');
    const name = await this._prompt('Name *: ');
    const email = await this._prompt('Email *: ');
    const mobile = await this._prompt('Mobile *: ');
    const company = await this._prompt('Company (optional): ');
    if (!name || !email || !mobile) { console.log('Required fields missing.'); return { skipped: true }; }

    try {
      const hid = this.hardware.getFingerprint();
      await this.client.updateCustomer(name, email, mobile, hid);
      await this.client.startTrial(email, name, { mobile, company_name: company, hardware_id: hid });
      await this.cache.setOnboardingComplete();
      console.log('Trial activated!');
      return { name, email, hardware_id: hid, onboarding_complete: true };
    } catch (e) { console.log(`Error: ${(e as Error).message}`); return { skipped: true }; }
  }

  private async _prompt(msg: string): Promise<string> {
    await Deno.stdout.write(new TextEncoder().encode(msg));
    const buf = new Uint8Array(1024);
    const n = await Deno.stdin.read(buf);
    return new TextDecoder().decode(buf.subarray(0, n || 0)).trim();
  }
}

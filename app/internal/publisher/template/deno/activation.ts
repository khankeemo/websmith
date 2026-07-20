import * as path from 'https://deno.land/std@0.208.0/path/mod.ts';
import { ApiClient } from './client.ts';
import { HardwareDetector } from './hardware.ts';
import { CacheManager } from './cache.ts';

async function loadApiConfig(): Promise<Record<string, any>> {
  const paths = [path.join(Deno.cwd(), 'config', 'api-config.json')];
  for (const p of paths) {
    try { return JSON.parse(await Deno.readTextFile(p)); } catch {}
  }
  return {};
}

export class ActivationDialog {
  private config: Record<string, any> = {};
  private client: ApiClient;
  private productName: string;
  private cache: CacheManager;
  private hardware: HardwareDetector;
  private _hardwareId: string | null = null;
  private _licenseKey: string | null = null;
  private _activated = false;
  private _cancelled = false;

  constructor(client: ApiClient, productName?: string, cache?: CacheManager) {
    this.client = client;
    this.productName = productName || '';
    this.cache = cache || new CacheManager(this.config);
    this.hardware = new HardwareDetector();
  }

  async show(): Promise<Record<string, any>> {
    this.config = await loadApiConfig();
    this.productName = this.productName || this.config.product?.name || '';
    console.log('=== UNIVERSAL LICENSE ACTIVATION ===');
    console.log(`Product: ${this.productName}`);
    await this._initialize();

    while (!this._activated && !this._cancelled) {
      console.log('\n1. Enter key  2. Refresh  3. Activate  0. Cancel');
      const c = (await this._prompt('Choose: ')).trim();
      if (c === '1') await this._enterKey();
      else if (c === '2') await this._refresh();
      else if (c === '3' && this._licenseKey) await this._activate();
      else if (c === '0') this._cancelled = true;
    }
    return { activated: this._activated, cancelled: this._cancelled, license_key: this._licenseKey };
  }

  private async _initialize(): Promise<void> {
    try {
      this._hardwareId = this.hardware.getFingerprint();
      console.log(`Hardware ID: ${this._hardwareId}`);
    } catch (e) { console.log(`Hardware error: ${(e as Error).message}`); }
  }

  private async _enterKey(): Promise<void> {
    const key = (await this._prompt('License key: ')).trim();
    if (!key) return;
    try {
      const r = await this.client.validateLicense(key, this._hardwareId || undefined);
      if (r.valid || r.data?.valid) { this._licenseKey = key; console.log('Validated.'); }
      else { console.log(`Failed: ${r.message || r.error}`); }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
  }

  private async _refresh(): Promise<void> {
    try {
      const r = await this.client.getTrialStatus(this._hardwareId || undefined);
      if (r.data?.has_trial) console.log(`Trial: ${r.data.days_left}d`);
      else console.log('No active trial.');
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
  }

  private async _activate(): Promise<void> {
    if (!this._licenseKey || !this._hardwareId) return;
    try {
      const r = await this.client.activateLicense(this._licenseKey, this._hardwareId);
      if (r.success || r.data?.success) { this._activated = true; console.log('Activated!'); }
      else { console.log(`Failed: ${r.message || r.error}`); }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
  }

  private async _prompt(msg: string): Promise<string> {
    await Deno.stdout.write(new TextEncoder().encode(msg));
    const buf = new Uint8Array(1024);
    const n = await Deno.stdin.read(buf);
    return new TextDecoder().decode(buf.subarray(0, n || 0)).trim();
  }
}

import path from 'path';
import os from 'os';
import { ApiClient } from './client';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';

async function loadApiConfig(): Promise<Record<string, any>> {
  const dir = (import.meta as any).dir;
  const paths = [
    path.join(dir, 'config', 'api-config.json'),
    path.join(process.cwd(), 'config', 'api-config.json'),
  ];
  for (const p of paths) {
    try {
      if (await Bun.file(p).exists()) return JSON.parse(await Bun.file(p).text());
    } catch {}
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
    console.log(`Device: ${os.hostname()}`);
    console.log(`Platform: ${os.platform()}`);
    console.log('');
    await this._initialize();
    await this._mainLoop();
    return { activated: this._activated, cancelled: this._cancelled, license_key: this._licenseKey };
  }

  private async _initialize(): Promise<void> {
    console.log('Detecting hardware...');
    try {
      this._hardwareId = this.hardware.getFingerprint();
      console.log(`Hardware ID: ${this._hardwareId}`);
      console.log('Hardware verified.');
    } catch (e) { console.log(`Hardware error: ${(e as Error).message}`); }
    try {
      const tr = await this.client.getTrialStatus(this._hardwareId || undefined);
      if (tr.data?.has_trial) console.log(`Trial active — ${tr.data.days_left || 0} day(s) remaining.`);
    } catch {}
    console.log('');
  }

  private async _mainLoop(): Promise<void> {
    const bu = Bun.stdin.stream.getReader();
    const encoder = new TextEncoder();
    while (!this._activated && !this._cancelled) {
      console.log('1. Enter license key  2. Refresh  3. Activate  0. Cancel');
      Bun.stdout.write(encoder.encode('Choose: '));
      const line = await this._readLine(bu);
      switch (line.trim()) {
        case '1': await this._enterKey(); break;
        case '2': await this._refresh(); break;
        case '3': if (this._licenseKey) await this._activate(); break;
        case '0': this._cancelled = true; return;
      }
    }
    bu.releaseLock();
  }

  private async _readLine(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    const decoder = new TextDecoder();
    let result = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
      if (result.includes('\n')) break;
    }
    return result.replace(/\n/g, '').trim();
  }

  private async _enterKey(): Promise<void> {
    const bu = Bun.stdin.stream.getReader();
    const encoder = new TextEncoder();
    Bun.stdout.write(encoder.encode('License key: '));
    const key = (await this._readLine(bu)).trim();
    bu.releaseLock();
    if (!key) return;
    console.log('Validating...');
    try {
      const r = await this.client.validateLicense(key, this._hardwareId || undefined);
      if (r.valid || r.data?.valid) { this._licenseKey = key; console.log('License validated.'); }
      else { console.log(`Failed: ${r.message || r.error}`); }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
  }

  private async _refresh(): Promise<void> {
    try {
      const r = await this.client.getTrialStatus(this._hardwareId || undefined);
      if (r.data?.has_trial) console.log(`Trial: ${r.data.days_left}d remaining`);
      else console.log('No active trial.');
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
  }

  private async _activate(): Promise<void> {
    if (!this._licenseKey || !this._hardwareId) return;
    console.log('Activating...');
    try {
      const r = await this.client.activateLicense(this._licenseKey, this._hardwareId);
      if (r.success || r.data?.success) { this._activated = true; console.log('Activated!'); await this.cache.invalidateLicenseStatus(); }
      else { console.log(`Failed: ${r.message || r.error}`); }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
  }
}

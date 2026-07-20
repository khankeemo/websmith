import path from 'path';
import { ApiClient } from './client';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';

async function loadApiConfig(): Promise<Record<string, any>> {
  const dir = (import.meta as any).dir;
  const paths = [path.join(dir, 'config', 'api-config.json'), path.join(process.cwd(), 'config', 'api-config.json')];
  for (const p of paths) {
    try { if (await Bun.file(p).exists()) return JSON.parse(await Bun.file(p).text()); } catch {}
  }
  return {};
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
    if (!this._trialEnabled) return { skipped: true, message: 'Trial onboarding is not enabled' };
    if (await this.cache.isOnboardingComplete()) return { skipped: true, message: 'Onboarding already completed' };

    const encoder = new TextEncoder();
    const reader = Bun.stdin.stream.getReader();
    const decoder = new TextDecoder();
    const readLine = async (): Promise<string> => {
      let r = '';
      while (true) { const { value, done } = await reader.read(); if (done) break; r += decoder.decode(value, { stream: true }); if (r.includes('\n')) break; }
      return r.replace(/\n/g, '').trim();
    };

    console.log('=== Welcome ===');
    console.log(`Product: ${this.productName}`);
    Bun.stdout.write(encoder.encode('Name *: ')); const name = await readLine();
    Bun.stdout.write(encoder.encode('Email *: ')); const email = await readLine();
    Bun.stdout.write(encoder.encode('Mobile *: ')); const mobile = await readLine();
    Bun.stdout.write(encoder.encode('Company (optional): ')); const company = await readLine();
    reader.releaseLock();

    if (!name || !email || !mobile) { console.log('Required fields missing.'); return { skipped: true }; }
    try {
      const hardwareId = this.hardware.getFingerprint();
      await this.client.updateCustomer(name, email, mobile, hardwareId);
      await this.client.startTrial(email, name, { mobile, company_name: company, hardware_id: hardwareId });
      await this.cache.setOnboardingComplete();
      console.log('Trial activated!');
      return { name, email, hardware_id: hardwareId, onboarding_complete: true };
    } catch (e) { console.log(`Error: ${(e as Error).message}`); return { skipped: true, message: (e as Error).message }; }
  }
}

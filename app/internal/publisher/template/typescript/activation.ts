import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as os from 'os';
import { ApiClient } from './client';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';

function loadApiConfig(): Record<string, any> {
  const paths = [
    path.join(__dirname, 'config', 'api-config.json'),
    path.join(process.cwd(), 'config', 'api-config.json'),
  ];
  for (const p of paths) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (_) {}
  }
  return {};
}

export class ActivationDialog {
  private config: Record<string, any>;
  private client: ApiClient;
  private productName: string;
  private cache: CacheManager;
  private hardware: HardwareDetector;
  private _hardwareId: string | null = null;
  private _deviceName: string;
  private _platform: string;
  private _licenseKey: string | null = null;
  private _validateData: Record<string, any> | null = null;
  private _activated: boolean = false;
  private _cancelled: boolean = false;
  private _rl: readline.Interface | null = null;

  constructor(client: ApiClient, productName?: string, cache?: CacheManager) {
    this.config = loadApiConfig();
    this.client = client;
    this.productName = productName || this.config.product?.name || '';
    this.cache = cache || new CacheManager(this.config);
    this.hardware = new HardwareDetector();
    this._deviceName = os.hostname();
    this._platform = os.platform();
  }

  async show(): Promise<Record<string, any>> {
    this._rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('=== UNIVERSAL LICENSE ACTIVATION ===');
    console.log(`Product: ${this.productName}`);
    console.log(`Device: ${this._deviceName}`);
    console.log(`Platform: ${this._platform}`);
    console.log('');
    await this._initialize();
    await this._mainLoop();
    this._rl.close();
    return {
      activated: this._activated,
      cancelled: this._cancelled,
      license_key: this._licenseKey,
    };
  }

  private async _initialize(): Promise<void> {
    console.log('Detecting hardware...');
    try {
      this._hardwareId = this.hardware.getFingerprint();
      if (!this._hardwareId) {
        console.log('Unable to detect hardware.');
      } else {
        console.log(`Hardware ID: ${this._hardwareId}`);
        console.log('Hardware verified. Activation available.');
      }
    } catch (e) {
      console.log(`Hardware error: ${(e as Error).message}`);
    }
    try {
      const trialResult = await this.client.getTrialStatus(this._hardwareId || undefined);
      const trialData = trialResult.data || {};
      if (trialData.has_trial) {
        console.log(`Trial active — ${trialData.days_left || 0} day(s) remaining.`);
      }
    } catch (_) {}
    console.log('');
  }

  private async _mainLoop(): Promise<void> {
    while (!this._activated && !this._cancelled) {
      console.log('Options:');
      console.log('  1. Enter license key');
      console.log('  2. Refresh trial status');
      if (this._licenseKey) console.log('  3. Activate license');
      console.log('  0. Cancel');
      const answer = await this._question('Choose: ');
      switch (answer.trim()) {
        case '1': await this._enterLicenseKey(); break;
        case '2': await this._refreshStatus(); break;
        case '3': if (this._licenseKey) await this._activate(); break;
        case '0': this._cancelled = true; return;
        default: console.log('Invalid option.');
      }
      console.log('');
    }
  }

  private async _enterLicenseKey(): Promise<void> {
    const key = await this._question('License key: ');
    if (!key.trim()) return;
    console.log('Validating license...');
    try {
      const result = await this.client.validateLicense(key.trim(), this._hardwareId || undefined);
      if (result.valid || result.data?.valid) {
        this._validateData = result.data || result;
        this._licenseKey = key.trim();
        console.log('License validated successfully.');
        if (this._validateData.expiry_date) console.log(`Expiry: ${this._validateData.expiry_date}`);
        if (this._validateData.plan) console.log(`Plan: ${this._validateData.plan}`);
      } else {
        console.log(`Validation failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _refreshStatus(): Promise<void> {
    try {
      const result = await this.client.getTrialStatus(this._hardwareId || undefined);
      const data = result.data || {};
      if (data.has_trial) {
        console.log(`Trial: ${data.days_left || 0} day(s) remaining, status: ${data.status}`);
      } else {
        console.log('No active trial.');
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _activate(): Promise<void> {
    if (!this._licenseKey || !this._hardwareId) {
      console.log('License key or hardware not available.');
      return;
    }
    console.log('Activating license...');
    try {
      const result = await this.client.activateLicense(this._licenseKey, this._hardwareId);
      if (result.success || result.data?.success) {
        this._activated = true;
        console.log('License activated successfully!');
        this.cache.invalidateLicenseStatus();
      } else {
        console.log(`Activation failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private _question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this._rl!.question(prompt, resolve);
    });
  }
}

import { LicenseEngine, LicenseStatus } from './license_engine';
import { ApiClient } from './client';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';
import { UniversalEmailDialog } from './universal_email_dialog';

const SDK_VERSION = '${kit_version}';
const RUNTIME_TYPE = '${runtime}';
const SUPPORT_EMAIL = 'support@websmithdigital.com';

export class UniversalLicenseCenter {
  private engine: LicenseEngine;
  private client: ApiClient;
  private hardware: HardwareDetector;
  private cache: CacheManager;
  private config: Record<string, any>;
  private emailDialog: UniversalEmailDialog;
  private status: LicenseStatus | null = null;

  constructor(configPath?: string) {
    this.config = this._loadConfig(configPath);
    this.engine = new LicenseEngine(configPath);
    const hw = new HardwareDetector();
    const cache = new CacheManager(this.config);
    this.client = new ApiClient(this.config, hw, cache);
    this.hardware = hw;
    this.cache = cache;
    this.emailDialog = new UniversalEmailDialog(this.config, this.client, this.hardware, this.cache);
  }

  private _loadConfig(configPath?: string): Record<string, any> {
    if (!configPath) {
      configPath = './config/api-config.json';
    }
    return require(configPath);
  }

  async show(): Promise<Record<string, any>> {
    console.log('=== UNIVERSAL LICENSE CENTER ===');
    console.log(`SDK Version: ${SDK_VERSION} | Runtime: ${RUNTIME_TYPE}`);
    console.log('');

    await this._refreshStatus();
    await this._mainLoop();

    return { status: this.status?.toDict() || null };
  }

  private async _refreshStatus(): Promise<void> {
    process.stdout.write('Checking license status...');
    try {
      this.status = await this.engine.initialize();
      console.log(' done');
    } catch (e) {
      console.log(' error');
      this.status = new LicenseStatus(false, 'error', {
        message: `Status check failed: ${(e as Error).message}`,
      });
    }
    this._printStatus();
  }

  private _printStatus(): void {
    if (!this.status) {
      console.log('  Status: Unknown');
      return;
    }
    console.log(`  Status: ${this.status.status}`);
    if (this.status.license_key) console.log(`  License: ${this.status.license_key}`);
    if (this.status.plan) console.log(`  Plan: ${this.status.plan}`);
    if (this.status.expires_at) console.log(`  Expires: ${this.status.expires_at}`);
    if (this.status.days_remaining > 0) console.log(`  Days Remaining: ${this.status.days_remaining}`);
    if (this.status.hardware_id) console.log(`  Hardware: ${this.status.hardware_id}`);
    if (this.status.message) console.log(`  Message: ${this.status.message}`);
    console.log('');
  }

  private async _mainLoop(): Promise<void> {
    let running = true;
    while (running) {
      const isLicensed = this.status?.valid === true && this.status?.status === 'active';
      const isTrial = this.status?.status === 'trial';
      const isUnlicensed = this.status?.status === 'unlicensed' || this.status?.status === 'error';

      console.log('  ┌─────────────────────────────────────┐');
      console.log('  │        UNIVERSAL LICENSE CENTER      │');
      console.log('  ├─────────────────────────────────────┤');
      console.log('  │  1. View License Status             │');
      if (isUnlicensed) {
        console.log('  │  2. Start Free Trial                 │');
        console.log('  │  3. Activate License                 │');
        console.log('  │  4. Buy License                      │');
      }
      if (isTrial) {
        console.log('  │  5. Buy License / Convert Trial      │');
      }
      if (isLicensed) {
        console.log('  │  6. Renew License                    │');
        console.log('  │  7. Replace Device                   │');
      }
      console.log('  │  8. Hardware Issue                    │');
      console.log('  │  9. Contact Support                   │');
      console.log('  │ 10. Request History                   │');
      console.log('  │  0. Exit                              │');
      console.log('  └─────────────────────────────────────┘');
      console.log('');

      const choice = await this._question('Select option: ');
      switch (choice.trim()) {
        case '1': await this._viewStatus(); break;
        case '2': if (isUnlicensed) await this._startTrial(); break;
        case '3': if (isUnlicensed) await this._activateLicense(); break;
        case '4': if (isUnlicensed) await this._buyLicense(); break;
        case '5': if (isTrial) await this._buyLicense(); break;
        case '6': if (isLicensed) await this._renewLicense(); break;
        case '7': if (isLicensed) await this._replaceDevice(); break;
        case '8': await this._hardwareIssue(); break;
        case '9': await this._contactSupport(); break;
        case '10': await this._requestHistory(); break;
        case '0': running = false; break;
        default: console.log('Invalid option.');
      }
      console.log('');
    }
  }

  private _question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
      rl.question(prompt, (answer: string) => { rl.close(); resolve(answer); });
    });
  }

  private async _viewStatus(): Promise<void> {
    console.log('── License Status ──');
    await this._refreshStatus();
  }

  private async _startTrial(): Promise<void> {
    console.log('── Start Free Trial ──');
    const name = await this._question('Name: ');
    const email = await this._question('Email: ');
    if (!name.trim() || !email.trim()) { console.log('Name and email are required.'); return; }
    try {
      const result = await this.engine.startTrial(email.trim(), name.trim());
      if (result.success) { console.log('Trial started successfully!'); await this._refreshStatus(); }
      else { console.log(`Trial failed: ${result.message || result.error || 'Unknown error'}`); }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
  }

  private async _activateLicense(): Promise<void> {
    console.log('── Activate License ──');
    const key = await this._question('License key: ');
    if (!key.trim()) return;
    try {
      const result = await this.engine.activate(key.trim());
      if (result.success) { console.log('License activated!'); await this._refreshStatus(); }
      else { console.log(`Activation failed: ${result.message || result.error || 'Unknown error'}`); }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
  }

  private async _buyLicense(): Promise<void> {
    console.log('── Buy License ──');
    const productName = this.config.product?.name || 'our product';
    console.log(`Interested in buying ${productName}?`);
    await this.emailDialog.show({ requestType: 'BUY', subject: `Buy ${productName} License` });
  }

  private async _renewLicense(): Promise<void> {
    console.log('── Renew License ──');
    await this.emailDialog.show({
      requestType: 'RENEW', subject: 'License Renewal Request',
      autoFill: { license_key: this.status?.license_key, plan_name: this.status?.plan },
    });
  }

  private async _replaceDevice(): Promise<void> {
    console.log('── Replace Device ──');
    await this.emailDialog.show({
      requestType: 'DEVICE_REPLACEMENT', subject: 'Device Replacement Request',
      autoFill: { license_key: this.status?.license_key, plan_name: this.status?.plan },
    });
  }

  private async _hardwareIssue(): Promise<void> {
    console.log('── Hardware Issue ──');
    await this.emailDialog.show({ requestType: 'HARDWARE', subject: 'Hardware Issue Report' });
  }

  private async _contactSupport(): Promise<void> {
    console.log('── Contact Support ──');
    const reason = await this._question('Reason (support/activation/trial issue): ');
    await this.emailDialog.show({
      requestType: reason.trim().toUpperCase() === 'ACTIVATION' ? 'ACTIVATION'
        : reason.trim().toUpperCase() === 'TRIAL' ? 'ACTIVATION' : 'SUPPORT',
      subject: reason.trim() ? `${reason.trim()} Support Request` : 'General Support Request',
    });
  }

  private async _requestHistory(): Promise<void> {
    console.log('── Request History ──');
    const email = await this._question('Enter email: ');
    if (!email.trim()) return;
    try {
      const baseUrl = this.config.api?.url || '';
      const response = await fetch(`${baseUrl}/api/v1/request?email=${encodeURIComponent(email.trim())}`, { method: 'GET' });
      const data = await response.json();
      if (data.success && data.data?.requests?.length > 0) {
        for (const req of data.data.requests) {
          console.log(`  ${req.request_id} | ${req.request_type} | ${req.status} | ${req.subject}`);
        }
      } else { console.log('No requests found.'); }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
  }
}

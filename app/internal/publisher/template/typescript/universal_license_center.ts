import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as os from 'os';
import { LicenseEngine, LicenseStatus } from './license_engine';
import { ApiClient } from './client';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';
import { UniversalEmailDialog } from './universal_email_dialog';

const SDK_VERSION = '${kit_version}';
const RUNTIME_TYPE = '${runtime}';
const SUPPORT_EMAIL = 'support@websmithdigital.com';

function loadConfig(configPath?: string): Record<string, any> {
  if (!configPath) {
    const dir = __dirname;
    configPath = path.join(dir, 'config', 'api-config.json');
    if (!fs.existsSync(configPath)) {
      configPath = path.join(process.cwd(), 'config', 'api-config.json');
    }
  }
  if (!fs.existsSync(configPath)) {
    throw new Error(`api-config.json not found at: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export class UniversalLicenseCenter {
  private engine: LicenseEngine;
  private client: ApiClient;
  private hardware: HardwareDetector;
  private cache: CacheManager;
  private config: Record<string, any>;
  private emailDialog: UniversalEmailDialog;
  private status: LicenseStatus | null = null;
  private rl: readline.Interface | null = null;

  constructor(configPath?: string) {
    this.config = loadConfig(configPath);
    this.engine = new LicenseEngine(configPath);
    this.client = new ApiClient(this.config, new HardwareDetector(), new CacheManager(this.config));
    this.hardware = new HardwareDetector();
    this.cache = new CacheManager(this.config);
    this.emailDialog = new UniversalEmailDialog(this.config, this.client, this.hardware, this.cache);
  }

  async show(): Promise<Record<string, any>> {
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('=== UNIVERSAL LICENSE CENTER ===');
    console.log(`SDK Version: ${SDK_VERSION} | Runtime: ${RUNTIME_TYPE}`);
    console.log('');

    await this._refreshStatus();
    await this._mainLoop();

    const result = { status: this.status?.toDict() || null };
    if (this.rl) this.rl.close();
    this.rl = null;
    return result;
  }

  private async _question(prompt: string): Promise<string> {
    return new Promise((resolve) => this.rl!.question(prompt, resolve));
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
      const hardwareId = this.hardware.getFingerprint();
      const isLicensed = this.status?.valid === true && this.status?.status === 'active';
      const isTrial = this.status?.status === 'trial';
      const isUnlicensed = this.status?.status === 'unlicensed' || this.status?.status === 'error';
      const hasLicenseKey = !!this.engine.getLicenseKey();

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
        default: console.log('Invalid option. Please try again.');
      }
      console.log('');
    }
  }

  private async _viewStatus(): Promise<void> {
    console.log('── License Status ──');
    await this._refreshStatus();
  }

  private async _startTrial(): Promise<void> {
    console.log('── Start Free Trial ──');
    const name = await this._question('Name: ');
    const email = await this._question('Email: ');
    if (!name.trim() || !email.trim()) {
      console.log('Name and email are required.');
      return;
    }
    try {
      const result = await this.engine.startTrial(email.trim(), name.trim());
      if (result.success) {
        console.log('Trial started successfully!');
        await this._refreshStatus();
      } else {
        console.log(`Trial failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _activateLicense(): Promise<void> {
    console.log('── Activate License ──');
    const key = await this._question('License key: ');
    if (!key.trim()) return;
    try {
      const result = await this.engine.activate(key.trim());
      if (result.success) {
        console.log('License activated!');
        await this._refreshStatus();
      } else {
        console.log(`Activation failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _buyLicense(): Promise<void> {
    console.log('── Buy License ──');
    const productName = this.config.product?.name || 'our product';
    console.log(`Interested in buying ${productName}?`);
    console.log('Submit your details and our sales team will contact you.');
    console.log('');

    const contactMethod = await this._question('Use email form? (y/n): ');
    if (contactMethod.toLowerCase() === 'y') {
      await this.emailDialog.show({
        requestType: 'BUY',
        subject: `Buy ${productName} License`,
      });
    } else {
      console.log(`Please email us at ${SUPPORT_EMAIL} to purchase a license.`);
    }
  }

  private async _renewLicense(): Promise<void> {
    console.log('── Renew License ──');
    const contactMethod = await this._question('Use email form to request renewal? (y/n): ');
    if (contactMethod.toLowerCase() === 'y') {
      const status = this.status;
      await this.emailDialog.show({
        requestType: 'RENEW',
        subject: 'License Renewal Request',
        autoFill: {
          license_key: status?.license_key || undefined,
          plan_name: status?.plan || undefined,
        },
      });
    } else {
      console.log(`Please email us at ${SUPPORT_EMAIL} for renewal.`);
    }
  }

  private async _replaceDevice(): Promise<void> {
    console.log('── Replace Device ──');
    const status = this.status;
    await this.emailDialog.show({
      requestType: 'DEVICE_REPLACEMENT',
      subject: 'Device Replacement Request',
      autoFill: {
        license_key: status?.license_key || undefined,
        plan_name: status?.plan || undefined,
      },
    });
  }

  private async _hardwareIssue(): Promise<void> {
    console.log('── Hardware Issue ──');
    await this.emailDialog.show({
      requestType: 'HARDWARE',
      subject: 'Hardware Issue Report',
    });
  }

  private async _contactSupport(): Promise<void> {
    console.log('── Contact Support ──');
    const reason = await this._question('Reason (support/activation/trial issue): ');
    await this.emailDialog.show({
      requestType: reason.trim().toUpperCase() === 'ACTIVATION' ? 'ACTIVATION'
        : reason.trim().toUpperCase() === 'TRIAL' ? 'ACTIVATION'
        : 'SUPPORT',
      subject: reason.trim() ? `${reason.trim()} Support Request` : 'General Support Request',
    });
  }

  private async _requestHistory(): Promise<void> {
    console.log('── Request History ──');
    const email = await this._question('Enter email to check request status: ');
    if (!email.trim()) return;

    try {
      const baseUrl = this.config.api?.url || '';
      const response = await fetch(
        `${baseUrl}/api/v1/request?email=${encodeURIComponent(email.trim())}`,
        { method: 'GET' }
      );
      const data = await response.json();
      if (data.success && data.data?.requests?.length > 0) {
        console.log(`\nFound ${data.data.requests.length} request(s):`);
        for (const req of data.data.requests) {
          console.log(`  ${req.request_id} | ${req.request_type} | ${req.status} | ${new Date(req.created_at).toLocaleDateString()}`);
          console.log(`  Subject: ${req.subject}`);
          console.log('');
        }
      } else {
        console.log('No requests found for this email.');
      }
    } catch (e) {
      console.log(`Error fetching history: ${(e as Error).message}`);
    }
  }
}

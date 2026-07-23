import * as readline from 'readline';
import { LicenseEngine } from './license_engine';

export class DeviceReplaceDialog {
  private engine: LicenseEngine;
  private config: Record<string, any>;
  private licenseKey: string;
  result: Record<string, any> | null = null;
  private supportEmail: string;

  constructor(engine: LicenseEngine, licenseKey: string) {
    this.engine = engine;
    this.config = engine.config;
    this.licenseKey = licenseKey;
    engine._licenseKey = licenseKey;
    this.supportEmail = this.config.branding?.support_email || 'support@websmithdigital.com';
  }

  async show(): Promise<Record<string, any> | null> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

    console.log('=== Reactivate License ===');
    console.log('Device reactivation requires Websmith Support approval.');
    console.log(`Please contact ${this.supportEmail} to submit a reactivation request.`);
    console.log('');
    console.log('Your application will remain locked until the reactivation is approved.');
    console.log('');

    await question('Press Enter to return...');
    this.result = { action: 'contact_support', support_email: this.supportEmail };
    rl.close();
    return this.result;
  }
}

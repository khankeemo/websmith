import * as readline from 'readline';
import * as os from 'os';
import { LicenseEngine } from './license_engine';

export class DeviceReplaceDialog {
  private engine: LicenseEngine;
  private config: Record<string, any>;
  private licenseKey: string;
  result: Record<string, any> | null = null;

  constructor(engine: LicenseEngine, licenseKey: string) {
    this.engine = engine;
    this.config = engine.config;
    this.licenseKey = licenseKey;
    engine._licenseKey = licenseKey;
  }

  async show(): Promise<Record<string, any> | null> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

    console.log('=== Replace Device ===');
    console.log('Move your license from old device to this one.');
    console.log('');

    const status = this.engine.getStatus();
    const oldHwId = status?.hardware_id || 'Unknown';
    const newHwId = this.engine.getHardwareId();
    console.log(`Old Hardware ID: ${oldHwId.slice(0, 48)}`);
    console.log(`New Hardware ID: ${newHwId.slice(0, 48)}`);
    const devName = await question(`Device Name [${os.hostname()}]: `) || os.hostname();

    const confirm = await question('Replace device? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      rl.close();
      return null;
    }

    console.log('Replacing device...');
    try {
      const result = await this.engine.replaceHardware();
      if (result.success) {
        console.log('Device replaced successfully!');
        this.result = { action: 'device_replaced' };
      } else {
        console.log(`Replacement failed: ${result.message || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }

    rl.close();
    return this.result;
  }
}

import { LicenseEngine } from './license_engine.ts';

export class DeviceReplaceDialog {
  private engine: LicenseEngine;
  private licenseKey: string;
  result: Record<string, any> | null = null;

  constructor(engine: LicenseEngine, licenseKey: string) {
    this.engine = engine;
    this.licenseKey = licenseKey;
    engine._licenseKey = licenseKey;
  }

  async show(): Promise<Record<string, any> | null> {
    console.log('=== Replace Device ===');
    const s = this.engine.getStatus();
    const oldHw = s?.hardware_id || 'Unknown';
    const newHw = this.engine.getHardwareId();
    console.log(`Old: ${oldHw.slice(0, 48)}`);
    console.log(`New: ${newHw.slice(0, 48)}`);
    const devName = await this._prompt('Device Name: ');
    const confirm = (await this._prompt('Replace device? (y/N): ')).trim().toLowerCase();
    if (confirm !== 'y') { console.log('Cancelled.'); return null; }
    try {
      const r = await this.engine.replaceHardware();
      if (r.success) { console.log('Device replaced!'); this.result = { action: 'device_replaced' }; }
      else { console.log(`Failed: ${r.message}`); }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
    return this.result;
  }

  private async _prompt(msg: string): Promise<string> {
    await Deno.stdout.write(new TextEncoder().encode(msg));
    const buf = new Uint8Array(1024);
    const n = await Deno.stdin.read(buf);
    return new TextDecoder().decode(buf.subarray(0, n || 0)).trim();
  }
}

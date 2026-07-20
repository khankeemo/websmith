import os from 'os';
import { LicenseEngine } from './license_engine';

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
    console.log('Move your license from old device to this one.\n');
    const status = this.engine.getStatus();
    const oldHw = status?.hardware_id || 'Unknown';
    const newHw = this.engine.getHardwareId();
    console.log(`Old: ${oldHw.slice(0, 48)}`);
    console.log(`New: ${newHw.slice(0, 48)}`);

    const encoder = new TextEncoder();
    Bun.stdout.write(encoder.encode(`Device Name [${os.hostname()}]: `));
    const reader = Bun.stdin.stream.getReader();
    const decoder = new TextDecoder();
    let line = '';
    while (true) { const { value, done } = await reader.read(); if (done) break; line += decoder.decode(value, { stream: true }); if (line.includes('\n')) break; }
    reader.releaseLock();

    Bun.stdout.write(encoder.encode('Replace device? (y/N): '));
    const reader2 = Bun.stdin.stream.getReader();
    let line2 = '';
    while (true) { const { value, done } = await reader2.read(); if (done) break; line2 += decoder.decode(value, { stream: true }); if (line2.includes('\n')) break; }
    reader2.releaseLock();

    if (line2.trim().toLowerCase() !== 'y') { console.log('Cancelled.'); return null; }
    console.log('Replacing device...');
    try {
      const r = await this.engine.replaceHardware();
      if (r.success) { console.log('Device replaced!'); this.result = { action: 'device_replaced' }; }
      else { console.log(`Failed: ${r.message}`); }
    } catch (e) { console.log(`Error: ${(e as Error).message}`); }
    return this.result;
  }
}

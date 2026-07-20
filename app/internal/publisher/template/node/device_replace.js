const readline = require('readline');
const os = require('os');

class DeviceReplaceDialog {
  constructor(engine, licenseKey) {
    this.engine = engine;
    this.config = engine.config;
    this.licenseKey = licenseKey;
    engine._licenseKey = licenseKey;
    this.result = null;
    this._loading = false;
  }

  async show() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q) => new Promise((resolve) => rl.question(q, resolve));

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
      console.log(`Error: ${e.message}`);
    }

    rl.close();
    return this.result;
  }
}

module.exports = { DeviceReplaceDialog };

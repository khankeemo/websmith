const readline = require('readline');

const SDK_VERSION = '${kit_version}';
const RUNTIME_TYPE = '${runtime}';

class UniversalEmailDialog {
  constructor(config, client, hardware, cache) {
    this.config = config;
    this.client = client;
    this.hardware = hardware;
    this.cache = cache;
  }

  async show(options) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q) => new Promise((resolve) => rl.question(q, resolve));

    const productName = (options.autoFill && options.autoFill.product_name) ||
      (this.config.product && this.config.product.name) || '';
    const supportEmail = (this.config.branding && this.config.branding.support_email) || 'support@websmithdigital.com';

    console.log('── Universal Email Form ──');
    console.log(`Request: ${options.requestType.replace(/_/g, ' ')}`);
    if (productName) console.log(`Product: ${productName}`);
    console.log('');

    const cached = this.cache.getLicenseStatus();
    const autoFill = options.autoFill || {};

    let name = autoFill.customer_name || (cached ? cached.customer_name : null) || '';
    let email = autoFill.customer_email || (cached ? cached.customer_email : null) || '';
    const hardwareId = autoFill.hardware_id || this.hardware.getFingerprint() || (cached ? cached.hardware_id : null) || '';

    if (!name) {
      name = await question('Your Name: ');
    } else {
      console.log(`Name: ${name} (auto-detected)`);
    }

    if (!email) {
      email = await question('Your Email: ');
    } else {
      console.log(`Email: ${email} (auto-detected)`);
    }

    if (!name.trim() || !email.trim()) {
      console.log('Name and email are required.');
      rl.close();
      return { sent: false, error: 'Validation failed' };
    }

    const subject = options.subject || `${options.requestType} Request`;
    const message = await question('Your Message: ');

    if (!message.trim()) {
      console.log('Message is required.');
      rl.close();
      return { sent: false, error: 'Message is required' };
    }

    const licenseKey = autoFill.license_key || (cached ? cached.license_key : null) || '';
    const planName = autoFill.plan_name || (cached ? cached.plan : null) || '';

    console.log('\nSubmitting your request...');

    try {
      const baseUrl = this.config.api ? this.config.api.url : '';
      const apiKey = this.config.api ? this.config.api.public_key : '';

      const payload = {
        request_type: options.requestType,
        customer_name: name.trim(),
        customer_email: email.trim(),
        product_name: productName,
        plan_name: planName,
        license_key: licenseKey,
        hardware_id: hardwareId,
        sdk_version: SDK_VERSION,
        runtime_type: RUNTIME_TYPE,
        subject: subject,
        message: message.trim(),
      };

      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const response = await fetch(`${baseUrl}/api/v1/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`\nRequest submitted successfully!`);
        console.log(`Reference: ${result.data.request_id}`);
        console.log(`We will contact you at ${email.trim()} shortly.`);
        rl.close();
        return { sent: true, request_id: result.data.request_id };
      } else {
        console.log(`\nFailed to submit: ${(result.error && result.error.message) || 'Unknown error'}`);
        rl.close();
        return { sent: false, error: result.error ? result.error.message : undefined };
      }
    } catch (e) {
      console.log(`\nError submitting request: ${e.message}`);
      console.log(`Please email us directly at ${supportEmail}`);
      rl.close();
      return { sent: false, error: e.message };
    }
  }
}

module.exports = { UniversalEmailDialog };

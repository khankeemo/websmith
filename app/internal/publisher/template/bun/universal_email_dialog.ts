const SDK_VERSION = '${kit_version}';
const RUNTIME_TYPE = '${runtime}';

interface EmailDialogOptions {
  requestType: string;
  subject?: string;
  autoFill?: {
    customer_name?: string;
    customer_email?: string;
    product_name?: string;
    plan_name?: string;
    license_key?: string;
    hardware_id?: string;
  };
}

export class UniversalEmailDialog {
  private config: Record<string, any>;
  private client: any;
  private hardware: any;
  private cache: any;

  constructor(config: Record<string, any>, client: any, hardware: any, cache: any) {
    this.config = config;
    this.client = client;
    this.hardware = hardware;
    this.cache = cache;
  }

  async show(options: EmailDialogOptions): Promise<Record<string, any>> {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

    const productName = options.autoFill?.product_name || this.config.product?.name || '';
    const supportEmail = this.config.branding?.support_email || 'support@websmithdigital.com';

    console.log('── Universal Email Form ──');
    console.log(`Request: ${options.requestType.replace(/_/g, ' ')}`);
    if (productName) console.log(`Product: ${productName}`);
    console.log('');

    const cached = this.cache.getLicenseStatus();
    let name = options.autoFill?.customer_name || cached?.customer_name || '';
    let email = options.autoFill?.customer_email || cached?.customer_email || '';
    const hardwareId = options.autoFill?.hardware_id || this.hardware.getFingerprint() || cached?.hardware_id || '';

    if (!name) { name = await question('Your Name: '); }
    else { console.log(`Name: ${name} (auto-detected)`); }
    if (!email) { email = await question('Your Email: '); }
    else { console.log(`Email: ${email} (auto-detected)`); }
    if (!name.trim() || !email.trim()) { rl.close(); return { sent: false, error: 'Validation failed' }; }

    const subject = options.subject || `${options.requestType} Request`;
    const message = await question('Your Message: ');
    if (!message.trim()) { rl.close(); return { sent: false, error: 'Message is required' }; }

    const licenseKey = options.autoFill?.license_key || cached?.license_key || '';
    const planName = options.autoFill?.plan_name || cached?.plan || '';

    console.log('\nSubmitting...');
    try {
      const baseUrl = this.config.api?.url || '';
      const apiKey = this.config.api?.public_key || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['X-API-Key'] = apiKey;

      const response = await fetch(`${baseUrl}/api/v1/request`, {
        method: 'POST', headers,
        body: JSON.stringify({
          request_type: options.requestType, customer_name: name.trim(), customer_email: email.trim(),
          product_name: productName, plan_name: planName, license_key: licenseKey, hardware_id: hardwareId,
          sdk_version: SDK_VERSION, runtime_type: RUNTIME_TYPE, subject, message: message.trim(),
        }),
      });
      const result = await response.json();
      if (result.success) {
        console.log(`\nSubmitted! Reference: ${result.data.request_id}`);
        rl.close(); return { sent: true, request_id: result.data.request_id };
      } else {
        console.log(`\nFailed: ${result.error?.message || 'Unknown'}`);
        rl.close(); return { sent: false, error: result.error?.message };
      }
    } catch (e) {
      console.log(`\nError: ${(e as Error).message}`);
      console.log(`Email us at ${supportEmail}`);
      rl.close(); return { sent: false, error: (e as Error).message };
    }
  }
}

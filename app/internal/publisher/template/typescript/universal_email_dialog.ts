import * as readline from 'readline';
import { ApiClient } from './client';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';

const SDK_VERSION = '{{SDK_VERSION}}';
const RUNTIME_TYPE = '{{RUNTIME_TYPE}}';

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
  private client: ApiClient;
  private hardware: HardwareDetector;
  private cache: CacheManager;

  constructor(
    config: Record<string, any>,
    client: ApiClient,
    hardware: HardwareDetector,
    cache: CacheManager,
  ) {
    this.config = config;
    this.client = client;
    this.hardware = hardware;
    this.cache = cache;
  }

  async show(options: EmailDialogOptions): Promise<Record<string, any>> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

    const productName = options.autoFill?.product_name || this.config.product?.name || '';
    const supportEmail = this.config.branding?.support_email || 'support@example.com';

    console.log('── Universal Email Form ──');
    console.log(`Request: ${options.requestType.replace(/_/g, ' ')}`);
    if (productName) console.log(`Product: ${productName}`);
    console.log('');

    const cached = this.cache.getLicenseStatus();
    const hasCustomerInfo = !!(options.autoFill?.customer_name || cached?.customer_name || cached?.customer_email);

    let name = options.autoFill?.customer_name || cached?.customer_name || '';
    let email = options.autoFill?.customer_email || cached?.customer_email || '';
    const hardwareId = options.autoFill?.hardware_id || this.hardware.getFingerprint() || cached?.hardware_id || '';

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

    const licenseKey = options.autoFill?.license_key || cached?.license_key || '';
    const planName = options.autoFill?.plan_name || cached?.plan || '';

    console.log('\nSubmitting your request...');

    try {
      const baseUrl = this.config.api?.url || '';
      const apiKey = this.config.api?.public_key || '';

      const payload: Record<string, any> = {
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

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const response = await fetch(`${baseUrl}/api/v1/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as any;

      if (result.success) {
        console.log(`\nRequest submitted successfully!`);
        console.log(`Reference: ${result.data.request_id}`);
        console.log(`We will contact you at ${email.trim()} shortly.`);
        rl.close();
        return { sent: true, request_id: result.data.request_id };
      } else {
        console.log(`\nFailed to submit: ${result.error?.message || 'Unknown error'}`);
        rl.close();
        return { sent: false, error: result.error?.message };
      }
    } catch (e) {
      console.log(`\nError submitting request: ${(e as Error).message}`);
      console.log(`Please email us directly at ${supportEmail}`);
      rl.close();
      return { sent: false, error: (e as Error).message };
    }
  }
}

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
    const supportEmail = (this.engine as any).config?.branding?.support_email || 'support@websmithdigital.com';

    console.log('=== Replace Device ===');
    console.log('Device reactivation requires Websmith Support approval.\n');
    console.log(`Please contact support at: ${supportEmail}`);
    console.log('The application will remain locked until reactivation is approved.\n');

    this.result = { action: 'contact_support', support_email: supportEmail };
    return this.result;
  }
}

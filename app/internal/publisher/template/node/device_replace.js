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
    const supportEmail = this.config?.branding?.support_email || 'support@websmithdigital.com';

    console.log('=== Replace Device ===');
    console.log('Device reactivation requires Websmith Support approval.');
    console.log('');
    console.log(`Please contact support at: ${supportEmail}`);
    console.log('The application will remain locked until reactivation is approved.');
    console.log('');

    this.result = { action: 'contact_support', support_email: supportEmail };
    return this.result;
  }
}

module.exports = { DeviceReplaceDialog };

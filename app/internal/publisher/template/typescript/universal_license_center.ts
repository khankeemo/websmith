import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { LicenseEngine, LicenseStatus } from './license_engine';
import { ApiClient, ApiError } from './client';
import { HardwareDetector } from './hardware';
import { CacheManager } from './cache';

function acquireLock(lockName: string): () => void {
  const lockFile = path.join(os.tmpdir(), `${lockName}.opencode.lock`);
  try {
    fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
    const release = () => {
      try { fs.unlinkSync(lockFile); } catch {}
    };
    process.on('exit', release);
    process.on('SIGINT', () => { release(); process.exit(); });
    process.on('SIGTERM', () => { release(); process.exit(); });
    return release;
  } catch {
    console.error(`Another instance of ${lockName} is already running.`);
    console.error('Only one process may control the licensing workflow.');
    process.exit(1);
  }
}

interface HardwareInfo {
  hardwareId: string;
  deviceName: string;
  systemName: string;
  operatingSystem: string;
  bindingStatus: 'Bound' | 'Not Bound';
}

const SDK_VERSION = '{{SDK_VERSION}}';
const RUNTIME_TYPE = '{{RUNTIME_TYPE}}';

const BRANDING_DEFAULTS: Record<string, string> = {
  company_name: '{{COMPANY_NAME}}',
  product_name: '{{PRODUCT_NAME}}',
  support_email: '{{SUPPORT_EMAIL}}',
  sales_email: '{{SALES_EMAIL}}',
  website_url: '{{WEBSITE_URL}}',
  sender_name: '{{SENDER_NAME}}',
  welcome_text: 'Welcome!',
  license_text: 'License',
  tagline: 'License Management',
};

function loadConfig(configPath?: string): Record<string, any> {
  if (!configPath) {
    const dir = __dirname;
    configPath = path.join(dir, 'config', 'api-config.json');
    if (!fs.existsSync(configPath)) {
      configPath = path.join(process.cwd(), 'config', 'api-config.json');
    }
  }
  if (!fs.existsSync(configPath)) {
    throw new Error(`api-config.json not found at: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export class UniversalLicenseCenter {
  private engine: LicenseEngine;
  private client: ApiClient;
  private hardware: HardwareDetector;
  private cache: CacheManager;
  private config: Record<string, any>;
  private branding: Record<string, string>;
  private status: LicenseStatus | null = null;
  private rl: readline.Interface | null = null;
  private _locked: boolean = true;
  onLicenseReady: ((valid: boolean) => void) | null = null;
  private _hardwareInfo: HardwareInfo | null = null;
  private _trialConsumed: boolean = false;
  private _releaseLock: (() => void) | null = null;

  constructor(configPath?: string, onLicenseReady?: ((valid: boolean) => void) | null) {
    this.config = loadConfig(configPath);
    this.branding = this._loadBranding();
    this.engine = new LicenseEngine(configPath);
    this.client = new ApiClient(this.config, new HardwareDetector(), new CacheManager(this.config));
    this.hardware = new HardwareDetector();
    this.cache = new CacheManager(this.config);
    if (onLicenseReady) {
      this.onLicenseReady = onLicenseReady;
      this.engine.onLicenseReady = (valid: boolean) => {
        this._locked = !valid;
        if (this.onLicenseReady) {
          try { this.onLicenseReady(valid); } catch { }
        }
      };
    }
  }

  private _loadBranding(): Record<string, string> {
    const b = this.config.branding || {};
    const p = this.config.product || {};
    return {
      company_name: b.company_name || BRANDING_DEFAULTS.company_name,
      product_name: p.name || BRANDING_DEFAULTS.product_name,
      support_email: b.support_email || process.env.MAIL_SUPPORT_ADDRESS || BRANDING_DEFAULTS.support_email,
      sales_email: b.sales_email || process.env.MAIL_SALES_ADDRESS || BRANDING_DEFAULTS.sales_email,
      website_url: b.website_url || BRANDING_DEFAULTS.website_url,
      sender_name: b.sender_name || BRANDING_DEFAULTS.sender_name,
      welcome_text: b.welcome_text || BRANDING_DEFAULTS.welcome_text,
      license_text: b.license_text || BRANDING_DEFAULTS.license_text,
      tagline: b.tagline || BRANDING_DEFAULTS.tagline,
    };
  }

  private _isValidForUnlock(): boolean {
    if (!this.status) return false;
    return this.status.status === 'active' || this.status.status === 'trial';
  }

  async show(): Promise<Record<string, any>> {
    this._releaseLock = acquireLock('UniversalLicenseCenter');
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('=== UNIVERSAL LICENSE CENTER ===');
    console.log(`SDK Version: ${SDK_VERSION} | Runtime: ${RUNTIME_TYPE}`);
    console.log('');

    await this._refreshStatus();

    if (this.status && this.status.valid) {
      this._unlockApplication();
      console.log('Valid license detected — launching application directly.');
      const result = { status: this.status?.toDict() || null };
      if (this.rl) this.rl.close();
      this.rl = null;
      return result;
    }

    this._lockApplication();

    if (this.status?.status === 'no_license' || this.status?.status === 'unlicensed') {
      if (this.cache.isOnboardingComplete()) {
        this._trialConsumed = true;
      }
    }

    await this._mainLoop();

    const result = { status: this.status?.toDict() || null };
    if (this.rl) this.rl.close();
    this.rl = null;
    return result;
  }

  getLicenseKey(): string | null {
    return this.engine.getLicenseKey();
  }

  isValid(): boolean {
    return !this._locked;
  }

  private _lockApplication(): void {
    this._locked = true;
    console.log('🔒 APPLICATION LOCKED');
    console.log('A valid license or trial is required to use this application.');
    console.log('');
  }

  private _unlockApplication(): void {
    this._locked = false;
    console.log('🔓 APPLICATION UNLOCKED');
    console.log('');
  }

  private async _question(prompt: string): Promise<string> {
    return new Promise((resolve) => this.rl!.question(prompt, resolve));
  }

  private async _refreshStatus(): Promise<void> {
    process.stdout.write('Checking license status...');
    try {
      this.status = await this.engine.initialize();
      console.log(' done');
    } catch (e) {
      console.log(' error');
      this.status = new LicenseStatus(false, 'error', {
        message: `Status check failed: ${(e as Error).message}`,
      });
    }
    this._updateHardwareStatus();
    this._printStatus();
  }

  private _updateHardwareStatus(): void {
    const hwId = this.hardware.getFingerprint();
    const identifiers = this.hardware.getIdentifiers();
    const deviceName = os.hostname();
    const systemName = os.hostname();
    const osName = `${os.platform()} ${os.release()}`;

    let bindingStatus: 'Bound' | 'Not Bound' = 'Not Bound';
    if (this.status && this.status.valid && this.status.hardware_id === hwId) {
      bindingStatus = 'Bound';
    }

    this._hardwareInfo = {
      hardwareId: hwId,
      deviceName,
      systemName,
      operatingSystem: osName,
      bindingStatus,
    };
  }

  private _printStatus(): void {
    if (!this.status) {
      console.log('  Status: Unknown');
      return;
    }
    if (this.status.status === 'inactive') {
      console.log('  You are an existing customer, but your license is inactive.');
      console.log('  If you have a new or reactivated license, activate it now.');
      console.log('  Otherwise, please contact support.');
      if (this.branding.support_email) {
        console.log(`  Support: ${this.branding.support_email}`);
      }
    } else if (this.status.status === 'trial_consumed') {
      console.log('  This email has already consumed its lifetime trial.');
      console.log('  Please activate a paid license or renew your existing license.');
    } else if (this.status.status === 'deactivated') {
      console.log('  Your license has been deactivated.');
      console.log('  Please contact your administrator.');
    } else if (this.status.status === 'force_reactivation') {
      console.log('  Unable to verify your license.');
      console.log('  Please contact support.');
    } else if (this.status.status === 'no_license') {
      console.log('  Status: NO LICENSE FOUND');
      console.log('  No active trial or paid license was found.');
      console.log('  Start a Free Trial or activate your license.');
    } else {
      console.log(`  Status: ${this.status.status}`);
    }
    if (this.status.hardware_id) console.log(`  Hardware: ${this.status.hardware_id}`);
    if (this.status.message && this.status.status !== 'deactivated' && this.status.status !== 'force_reactivation') {
      console.log(`  Message: ${this.status.message}`);
    }
    console.log('');
  }

  private async _mainLoop(): Promise<void> {
    let running = true;
    while (running) {
      const isNoLicense = this.status?.status === 'no_license';
      const isTrial = this.status?.status === 'trial';
      const isLicensed = this.status?.status === 'active';
      const isExpired = this.status?.status === 'expired';
      const isForceReactivation = this.status?.status === 'force_reactivation';
      const isInactive = this.status?.status === 'inactive';
      const isTrialConsumed = this.status?.status === 'trial_consumed';
      const needsReactivation = isExpired || isForceReactivation;

      if (this._locked) {
        const isDeactivated = this.status?.status === 'deactivated';
        const showActivation = !isDeactivated && !isForceReactivation && !isExpired;
        console.log('  ┌─────────────────────────────────────┐');
        console.log('  │        APPLICATION LOCKED            │');
        console.log('  ├─────────────────────────────────────┤');
        if (isInactive) {
          console.log('  │  You are an existing customer, but    │');
          console.log('  │  your license is inactive. If you    │');
          console.log('  │  have a new or reactivated license,  │');
          console.log('  │  activate it now. Otherwise, please  │');
          console.log('  │  contact support.                    │');
          if (this.branding.support_email) {
            const email = this.branding.support_email;
            const pad = ' '.repeat(Math.max(0, 37 - email.length));
            console.log(`  │  ${email}${pad}│`);
          }
          console.log('  ├─────────────────────────────────────┤');
          console.log('  │  1. Activate License                 │');
          console.log('  │  4. Contact Support                  │');
        } else if (isTrialConsumed) {
          console.log('  │  This email has already consumed     │');
          console.log('  │  its lifetime trial. Please activate │');
          console.log('  │  a paid license or renew your        │');
          console.log('  │  existing license.                   │');
          console.log('  ├─────────────────────────────────────┤');
          console.log('  │  1. Activate License                 │');
          console.log('  │  2. Renew License                    │');
          console.log('  │  4. Contact Support                  │');
        } else if (isForceReactivation) {
          console.log('  │  Unable to verify your license.      │');
          console.log('  │  Please contact support or request   │');
          console.log('  │  a reactivation.                     │');
          console.log('  ├─────────────────────────────────────┤');
          console.log('  │  3. Reactivate License               │');
          console.log('  │  4. Contact Support                  │');
        } else if (isDeactivated) {
          console.log('  │  Your license has been deactivated.  │');
          console.log('  │  Please contact your administrator.  │');
          console.log('  ├─────────────────────────────────────┤');
          console.log('  │  4. Contact Support                  │');
        } else {
          if (isNoLicense && !this._trialConsumed) {
            console.log('  │  S. Start Free Trial                  │');
          }
          if (showActivation) {
            console.log('  │  1. Activate License                 │');
          }
          if (!isDeactivated && !isForceReactivation) {
            console.log('  │  2. Renew License                    │');
          }
          console.log('  │  3. Sales Enquiry                    │');
          console.log('  │  4. Contact Support                  │');
        }
        const pending = this.cache.getPendingCount();
        if (pending > 0) console.log(`  │     (${pending} pending messages)            │`);
        console.log('  │  0. Exit                              │');
        console.log('  └─────────────────────────────────────┘');
      } else {
        const unreadCount = 0;
        console.log('  ┌─────────────────────────────────────┐');
        console.log('  │        UNIVERSAL LICENSE CENTER      │');
        console.log('  ├─────────────────────────────────────┤');
        console.log('  │  1. View License Status             │');
        if (isTrial) {
          console.log('  │  5. Buy License / Convert Trial      │');
        }
        if (isLicensed || isTrial) {
          console.log('  │  6. Renew License                    │');
        }
        if (isLicensed || isTrial) {
          console.log('  │  7. View Hardware Status             │');
        }
        console.log('  │  8. Report Hardware Issue             │');
        console.log('  │  9. Contact Support                   │');
        console.log('  │ 10. View Conversations                │');
        console.log('  │ 11. Request History                   │');
        console.log('  │ 12. View Notifications                │');
        const pending = this.cache.getPendingCount();
        if (pending > 0) console.log(`  │     (${pending} offline messages queued)   │`);
        console.log('  │  0. Exit                              │');
        console.log('  └─────────────────────────────────────┘');
      }
      console.log('');

      const choice = await this._question('Select option: ');
      const trimmed = choice.trim();

      let handled = false;

      if (this._locked) {
        const isDeactivated = this.status?.status === 'deactivated';
        const isForceReactivation = this.status?.status === 'force_reactivation';
        const showActivation = !isDeactivated && !isForceReactivation && !isExpired;
        switch (trimmed.toUpperCase()) {
          case 'S':
            if (isNoLicense && !this._trialConsumed) {
              await this._startTrial();
            }
            handled = true;
            break;
          case '1':
            if (showActivation || isInactive || isTrialConsumed) {
              await this._enterLicenseKey();
            }
            handled = true;
            break;
          case '2':
            if ((!isDeactivated && !isForceReactivation) || isTrialConsumed) {
              await this._renewLicenseFlow();
            }
            handled = true;
            break;
          case '3':
            if (isForceReactivation) {
              await this._reactivateLicense();
            } else if (!isInactive && !isTrialConsumed && !isForceReactivation) {
              await this._salesEnquiry();
            }
            handled = true;
            break;
          case '4':
            await this._contactSupport(); handled = true;
            break;
          case '0':
            running = false;
            handled = true;
            if (this._locked) {
              console.log('Exiting application...');
              this._shutdown();
            }
            break;
        }
        if (!handled) {
          console.log('Application is locked. Please use an option above to proceed.');
        }
      } else {
        switch (trimmed) {
          case '1': await this._viewStatus(); break;
          case '5': if (isTrial) await this._buyLicense(); break;
          case '6': if (isLicensed || isTrial) await this._renewLicenseFlow(); break;
          case '7': if (isLicensed || isTrial) await this._viewHardwareStatus(); break;
          case '8': await this._hardwareIssue(); break;
          case '9': await this._contactSupport(); break;
          case '10': await this._viewConversations(); break;
          case '11': await this._requestHistory(); break;
          case '12': await this._viewNotifications(); break;
          case '0': running = false; break;
          default: console.log('Invalid option. Please try again.');
        }
      }

      if (!this._locked && !this._isValidForUnlock()) {
        this._lockApplication();
      } else if (this._locked && this._isValidForUnlock()) {
        this._unlockApplication();
      }

      console.log('');
    }
  }

  private async _viewStatus(): Promise<void> {
    console.log('── License Status ──');
    await this._refreshStatus();
  }

  private async _collectRequestInfo(requestType: string): Promise<Record<string, any> | null> {
    const productName = this.branding.product_name;
    const cached = this.cache.getLicenseStatus();

    console.log(`── ${requestType.replace(/_/g, ' ')} ──`);

    let name = cached?.customer_name || '';
    if (!name) {
      name = (await this._question('Your Name: ')).trim();
    } else {
      console.log(`Name: ${name} (from cache)`);
    }

    let email = cached?.customer_email || '';
    if (!email) {
      email = (await this._question('Your Email: ')).trim();
    } else {
      console.log(`Email: ${email} (from cache)`);
    }

    if (!name || !email) {
      console.log('Name and email are required.');
      return null;
    }

    let subject = cached?.subject || '';
    if (requestType === 'SALES') {
      subject = (await this._question('Subject: ')).trim();
      if (!subject) { console.log('Subject is required.'); return null; }
    }

    const message = (await this._question('Message: ')).trim();
    if (!message) {
      console.log('Message is required.');
      return null;
    }

    return {
      customer_name: name,
      customer_email: email,
      subject,
      message,
      license_key: this.engine.getLicenseKey() || cached?.license_key || '',
      plan_name: cached?.plan || '',
      hardware_id: this.hardware.getFingerprint(),
    };
  }

  private async _welcomeFlow(): Promise<boolean> {
    const productName = this.branding.product_name;
    console.log(`── ${this.branding.welcome_text} ──`);
    console.log(`Welcome to ${productName}! Let's get you started with a free trial.`);
    console.log('');

    const name = (await this._question('Your Name: ')).trim();
    if (!name) { console.log('Name is required.'); return false; }

    const email = (await this._question('Your Email: ')).trim();
    if (!email) { console.log('Email is required.'); return false; }

    const mobile = (await this._question('Mobile Number: ')).trim();
    if (!mobile) { console.log('Mobile is required.'); return false; }

    const countryCode = (await this._question('Country Code (e.g., US): ')).trim();
    const company = (await this._question('Company (optional): ')).trim();

    console.log('');
    console.log('Sending verification code...');
    try {
      const otpResult = await this.client.sendOtp(email);
      if (!otpResult.success) {
        console.error(`[OTP] Send failed (internal): ${otpResult.error?.message || otpResult.message || 'Unknown error'}`);
        console.log('Failed to send OTP. Please check your email address and try again.');
        return false;
      }
    } catch (e) {
      console.error(`[OTP] Send exception (internal): ${(e as Error).message}`);
      console.log('An unexpected error occurred. Please try again later.');
      return false;
    }

    console.log('Verification code sent to your email.');
    const otp = (await this._question('Enter verification code: ')).trim();
    if (!otp) { console.log('Verification code is required.'); return false; }

    console.log('Verifying...');
    try {
      const verifyResult = await this.client.verifyOtp(email, otp);
      if (!verifyResult.success) {
        console.error(`[OTP] Verify failed (internal): ${verifyResult.error?.message || verifyResult.message || 'Unknown error'}`);
        console.log('\x1b[1;31mOTP verification failed. The OTP you entered is incorrect or has expired. Please check the OTP and try again.\x1b[0m');
        return false;
      }

      // Check if customer already exists — skip registration and trial
      if (verifyResult.customer_exists) {
        this.cache.setOnboardingComplete();
        this.cache.setLicenseStatus({ customer_email: email, customer_name: name });
        this._trialConsumed = true;
        console.log('Customer already exists. Opening License Center...');
        await this._refreshStatus();
        return true;
      }
    } catch (e) {
      if (e instanceof ApiError && e.statusCode >= 400 && e.statusCode < 500) {
        console.error(`[OTP] Verify failed (internal): ${e.message}`);
        console.log('\x1b[1;31mOTP verification failed. The OTP you entered is incorrect or has expired. Please check the OTP and try again.\x1b[0m');
        return false;
      }
      console.error(`[OTP] Verify exception (internal): ${(e as Error).message}`);
      console.log('An unexpected error occurred. Please try again later.');
      return false;
    }

    console.log('Email verified! Creating your account...');
    const hardwareId = this.hardware.getFingerprint();
    try {
      const registerResult = await this.client.registerCustomer({
        name, email, mobile,
        country_code: countryCode,
        company: company,
        hardware_id: hardwareId,
      });
      if (!registerResult.success) {
        console.log(`Registration failed: ${registerResult.error?.message || 'Unknown error'}`);
        return false;
      }
    } catch (e) {
      console.log(`Error registering: ${(e as Error).message}`);
      return false;
    }

    console.log('Starting your free trial...');
    try {
      const result = await this.engine.startTrial(email, name);
      if (result.success) {
        this.cache.setOnboardingComplete();
        console.log('Trial started! You can now use the application.');
        await this._refreshStatus();
        return true;
      }
      console.log(`Trial failed: ${result.message || result.error || 'Unknown error'}`);
      return false;
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
      return false;
    }
  }

  private async _startTrial(): Promise<void> {
    const success = await this._welcomeFlow();
    if (success && this.rl) {
      console.log('');
      await this._mainLoop();
    }
  }

  private async _validateHardware(): Promise<void> {
    console.log('── Validate License by Hardware ──');
    const hwId = this.hardware.getFingerprint();
    console.log(`  Hardware ID: ${hwId}`);
    console.log('');

    console.log('Checking existing licenses for this device...');
    try {
      const result = await this.engine.validateHardware();
      if (result.success) {
        const data = result.data || result;
        if (data.valid) {
          console.log('');
          console.log('═══════════════════════════════════════');
          console.log('      LICENSE FOUND');
          console.log('═══════════════════════════════════════');
          console.log(`  Customer: ${data.customer_name || 'N/A'}`);
          console.log(`  Email: ${data.customer_email || 'N/A'}`);
          console.log(`  Product: ${data.product_name || 'N/A'}`);
          console.log(`  Plan: ${data.plan || 'N/A'}`);
          console.log(`  Status: ${data.status || 'N/A'}`);
          console.log(`  Expires: ${data.expiry_date || 'N/A'}`);
          console.log(`  Days Left: ${data.days_left || 0}`);
          console.log('═══════════════════════════════════════');
          console.log('');
          if (data.this_device_activated) {
            console.log('License is bound to this device.');
          }
          this.cache.setLicenseStatus(data);
          await this._refreshStatus();
          if (this._isValidForUnlock()) {
            console.log('Press Enter to continue.');
            await this._question('');
          }
          return;
        } else {
          const errCode = result?.error?.code || '';
          if (errCode === 'LICENSE_EXPIRED') {
            console.log('  License has expired. Please renew your license.');
            console.log('  Use the Renew option from the menu.');
          } else if (errCode === 'LICENSE_REVOKED') {
            console.log('  License has been revoked. Please contact support.');
          } else if (errCode === 'LICENSE_INACTIVE') {
            console.log('  License is inactive. Please contact support.');
          } else if (errCode === 'LICENSE_DELETED') {
            console.log('  License has been deleted. Please contact support.');
          } else {
            console.log(`  Validation failed: ${result.error?.message || result.message || 'Unknown error'}`);
          }
          return;
        }
      } else if (result.error?.code === 'NO_LICENSE_FOUND') {
        console.log('  No license found for this device.');
        console.log('  Please enter a license key manually or contact support.');
      } else {
        console.log(`  Validation error: ${result.error?.message || result.message || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`  Error: ${(e as Error).message}`);
    }
  }

  private async _enterLicenseKey(): Promise<void> {
    console.log('── Enter License Key ──');
    const hwId = this.hardware.getFingerprint();
    console.log(`  Hardware ID: ${hwId}`);
    console.log('');

    const key = (await this._question('License key: ')).trim();
    if (!key) { console.log('License key is required.'); return; }

    console.log('');
    console.log('Validating license...');
    let customerEmail = '';
    let customerData: Record<string, any> = {};
    let alreadyActivated = false;
    try {
      const validateResult = await this.engine.validate(key.trim());
      const errCode = validateResult?.error?.code || '';
      if (!validateResult.success && validateResult.valid !== true) {
        const errorMsg = validateResult.error?.message || validateResult.message || 'License validation failed';
        if (errCode === 'LICENSE_EXPIRED') {
          console.log(`  License has expired. Please renew your license.`);
          console.log(`  You can use the Renew option in the main menu.`);
        } else if (errCode === 'LICENSE_REVOKED') {
          console.log(`  License has been revoked. Please contact support.`);
        } else if (errCode === 'LICENSE_INACTIVE') {
          console.log(`  License is inactive. Please contact support.`);
        } else if (errCode === 'LICENSE_DELETED') {
          console.log(`  License has been deleted. Please contact support.`);
        } else if (errCode === 'PRODUCT_INACTIVE' || errCode === 'PRODUCT_DELETED') {
          console.log(`  Product is not available. Please contact support.`);
        } else {
          console.log(`Validation failed: ${errorMsg}`);
        }
        return;
      }
      const data = validateResult.data || validateResult;
      if (!data.valid) {
        console.log('License validation failed.');
        return;
      }

      // Check if already activated on this device
      if (data.this_device_activated) {
        alreadyActivated = true;
        console.log(`  License already activated on this device.`);
        console.log(`  You can continue using the application.`);
        this.cache.setLicenseStatus({ valid: true, status: 'active', license_key: key, plan: data.plan, customer_name: data.customer_name, customer_email: data.customer_email, expires_at: data.expiry_date, days_remaining: data.days_left || 0, hardware_id: hwId });
        await this._refreshStatus();
        return;
      }

      // Check device limit
      if (data.active_devices >= data.max_devices) {
        console.log(`  Device limit reached: ${data.active_devices}/${data.max_devices} devices in use.`);
        console.log(`  Please deactivate another device or contact support.`);
        console.log(`  You can also use the Renew option to upgrade your plan.`);
        return;
      }

      customerEmail = data.customer_email || '';
      customerData = data;
      console.log(`  Customer: ${data.customer_name || 'N/A'}`);
      console.log(`  Email: ${customerEmail || 'N/A'}`);
      console.log(`  Product: ${data.product_name || 'N/A'}`);
      console.log(`  Plan: ${data.plan || 'N/A'}`);
      console.log(`  Status: ${data.status || 'N/A'}`);
      console.log(`  Expires: ${data.expiry_date || 'N/A'}`);
      console.log(`  Days Left: ${data.days_left || 0}`);
      console.log('');
    } catch (e) {
      console.log(`Validation error: ${(e as Error).message}`);
      return;
    }

    if (alreadyActivated) return;

    if (!customerEmail) {
      console.log('No customer email available for OTP verification.');
      return;
    }

    console.log('Sending OTP...');
    try {
      const otpResult = await this.client.sendOtp(customerEmail);
      if (!otpResult.success) {
        console.error(`[OTP] Send failed (internal): ${otpResult.error?.message || otpResult.message || 'Unknown error'}`);
        console.log('Failed to send OTP. Please check your email address and try again.');
        return;
      }
      console.log(`OTP sent to ${customerEmail}.`);
    } catch (e) {
      console.error(`[OTP] Send exception (internal): ${(e as Error).message}`);
      console.log('An unexpected error occurred. Please try again later.');
      return;
    }

    const otp = (await this._question('Enter OTP code: ')).trim();
    if (!otp) { console.log('OTP is required.'); return; }

    console.log('Verifying OTP...');
    try {
      const verifyResult = await this.client.verifyOtp(customerEmail, otp);
      if (!verifyResult.success) {
        console.error(`[OTP] Verify failed (internal): ${verifyResult.error?.message || verifyResult.message || 'Unknown error'}`);
        console.log('\x1b[1;31mOTP verification failed. The OTP you entered is incorrect or has expired. Please check the OTP and try again.\x1b[0m');
        return;
      }
      console.log('OTP verified successfully.');
      console.log('');
    } catch (e) {
      if (e instanceof ApiError && e.statusCode >= 400 && e.statusCode < 500) {
        console.error(`[OTP] Verify failed (internal): ${e.message}`);
        console.log('\x1b[1;31mOTP verification failed. The OTP you entered is incorrect or has expired. Please check the OTP and try again.\x1b[0m');
        return;
      }
      console.error(`[OTP] Verify exception (internal): ${(e as Error).message}`);
      console.log('An unexpected error occurred. Please try again later.');
      return;
    }

    console.log('Activating license...');
    try {
      const result = await this.engine.activate(key.trim());
      if (result.success) {
        if (result.already_activated) {
          console.log('  License already activated on this device. You can continue using the application.');
          return;
        }
        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('      LICENSE ACTIVATED');
        console.log('═══════════════════════════════════════');
        const data = result.data || result;
        console.log(`  Customer Name: ${customerData.customer_name || 'N/A'}`);
        console.log(`  Product: ${customerData.product_name || this.branding.product_name || 'N/A'}`);
        console.log(`  Plan: ${data.plan || customerData.plan || 'N/A'}`);
        console.log(`  License Status: Active`);
        console.log(`  Activation Date: ${new Date().toISOString().split('T')[0]}`);
        console.log(`  Expiry Date: ${data.expiry_date || customerData.expiry_date || 'N/A'}`);
        console.log(`  Remaining Validity: ${data.days_left || customerData.days_left || 0} days`);
        console.log('═══════════════════════════════════════');
        console.log('');
        console.log('Activation completed successfully.');
        console.log('');
        console.log('The application must restart to apply the new license.');
        console.log('');
        console.log('1. Restart Now');
        console.log('2. Restart Later');
        const restartChoice = (await this._question('Select option: ')).trim();
        if (restartChoice === '1') {
          console.log('Restarting application...');
          this._shutdown();
        } else {
          console.log('Please restart the application to apply the license.');
        }
      } else {
        const errCode = result?.error?.code || '';
        const errMsg = result?.error?.message || result.message || result.error || 'Unknown error';
        if (errCode === 'MAX_DEVICES_EXCEEDED') {
          console.log(`  Device limit reached. Please deactivate another device or contact support.`);
        } else if (errCode === 'LICENSE_EXPIRED') {
          console.log(`  License has expired. Please renew your license.`);
        } else if (errCode === 'LICENSE_REVOKED') {
          console.log(`  License has been revoked. Please contact support.`);
        } else if (errCode === 'LICENSE_INACTIVE') {
          console.log(`  License is inactive. Please contact support.`);
        } else if (result.already_activated) {
          console.log('  License already activated on this device.');
        } else {
          console.log(`Activation failed: ${errMsg}`);
        }
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private _maskLicenseKey(key: string): string {
    if (key.length <= 8) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }

  private async _buyLicense(): Promise<void> {
    const productName = this.branding.product_name;
    console.log(`── Buy ${productName} License ──`);
    const info = await this._collectRequestInfo('SALES');
    if (!info) return;

    try {
      const result = await this.engine.createCommunication({
        category: 'sales',
        customer_email: info.customer_email,
        customer_name: info.customer_name,
        subject: `Buy ${productName} License`,
        message: info.message,
        license_key: info.license_key || '',
        hardware_id: info.hardware_id || '',
      });
      if (result.success) {
        console.log('Sales enquiry submitted! Our sales team will contact you.');
      } else if (result.queued) {
        console.log('Sales enquiry queued. Will be sent when connection is restored.');
      } else {
        console.log(`Failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _renewLicenseFlow(): Promise<void> {
    console.log('── Renew License ──');
    console.log('');

    const key = (await this._question('Enter Last License Key: ')).trim();
    if (!key) { console.log('License key is required.'); return; }

    console.log('Validating license...');
    let customerData: Record<string, any> = {};
    try {
      const validateResult = await this.engine.validate(key);
      const data = validateResult.data || validateResult;
      if (!data.valid) {
        const errCode = validateResult?.error?.code || data?.error?.code || '';
        const errMsg = validateResult?.error?.message || data?.error?.message || 'License validation failed';
        if (errCode === 'LICENSE_REVOKED' || errCode === 'LICENSE_INACTIVE' || errCode === 'LICENSE_DELETED') {
          console.log(`  License ${errCode.replace('LICENSE_', '').toLowerCase()}. Please contact support.`);
          return;
        }
        if (errCode !== 'LICENSE_EXPIRED') {
          console.log(`  Validation failed: ${errMsg}`);
          return;
        }
        console.log('  License expired. Proceeding with renewal...');
      }
      customerData = data;
    } catch (e) {
      console.log(`  Validation error: ${(e as Error).message}`);
      return;
    }

    console.log('');
    console.log('── License Information ──');
    console.log(`  Customer: ${customerData.customer_name || 'N/A'}`);
    console.log(`  Email: ${customerData.customer_email || 'N/A'}`);
    console.log(`  Product: ${customerData.product_name || 'N/A'}`);
    console.log(`  Current Plan: ${customerData.plan || 'N/A'}`);
    console.log(`  Current Expiry: ${customerData.expiry_date || 'N/A'}`);
    console.log(`  License Status: ${customerData.status || 'N/A'}`);
    console.log(`  Days Remaining: ${customerData.days_left || 0}`);
    console.log('');

    console.log('Loading available plans...');
    let plans: Array<{ id: string; name: string; description: string; duration: string; is_current_plan: boolean }> = [];
    let selectedPlan = '';
    try {
      const plansResult = await this.client.getAvailablePlans(key);
      if (plansResult.success && plansResult.plans?.length > 0) {
        plans = plansResult.plans;
      }
    } catch {} // proceed without plans

    if (plans.length > 0) {
      console.log('Available paid plans:');
      plans.forEach((p, i) => {
        const current = p.is_current_plan ? ' (current)' : '';
        console.log(`  ${i + 1}. ${p.name} — ${p.description || p.duration}${current}`);
      });
      console.log('  0. Keep current plan');
      console.log('');
      const planChoice = (await this._question('Select a plan (number): ')).trim();
      const planIndex = parseInt(planChoice, 10) - 1;
      if (planChoice === '0') {
        selectedPlan = customerData.plan || '';
      } else if (!isNaN(planIndex) && planIndex >= 0 && planIndex < plans.length) {
        selectedPlan = plans[planIndex].name;
      } else {
        console.log('Invalid selection. Keeping current plan.');
        selectedPlan = customerData.plan || '';
      }
    }

    console.log('');
    console.log('Sending renewal request...');
    try {
      const result = await this.engine.createCommunication({
        category: 'renewal',
        customer_email: customerData.customer_email || '',
        customer_name: customerData.customer_name || '',
        subject: `License Renewal Request — ${key}`,
        message: `Renewal requested for license ${key}. Current plan: ${customerData.plan || 'N/A'}. Selected plan: ${selectedPlan || customerData.plan || 'N/A'}.`,
        license_key: key,
        hardware_id: this.hardware.getFingerprint(),
      });
      if (result.success) {
        console.log('Renewal request submitted! Our team will contact you.');
      } else if (result.queued) {
        console.log('Renewal request queued. Will be sent when connection is restored.');
      } else {
        console.log(`Failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _salesEnquiry(): Promise<void> {
    console.log('── Sales Enquiry ──');
    const info = await this._collectRequestInfo('SALES');
    if (!info) return;

    try {
      const result = await this.engine.createCommunication({
        category: 'sales',
        customer_email: info.customer_email,
        customer_name: info.customer_name,
        subject: info.subject || 'Sales Enquiry',
        message: info.message,
        license_key: info.license_key || '',
        hardware_id: info.hardware_id || '',
      });
      if (result.success) {
        console.log('Sales enquiry submitted! Our sales team will contact you.');
      } else if (result.queued) {
        console.log('Sales enquiry queued. Will be sent when connection is restored.');
      } else {
        console.log(`Failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _reactivateLicense(): Promise<void> {
    console.log('── Reactivate License ──');
    const cached = this.cache.getLicenseStatus();
    const licenseKey = this.engine.getLicenseKey() || cached?.license_key || '';

    if (!licenseKey) {
      console.log('No license key found. Cannot reactivate.');
      return;
    }

    console.log(`  License Key: ${licenseKey}`);
    console.log(`  Hardware ID: ${this.hardware.getFingerprint()}`);
    if (cached?.customer_name) console.log(`  Customer: ${cached.customer_name}`);
    if (cached?.customer_email) console.log(`  Email: ${cached.customer_email}`);
    if (cached?.plan) console.log(`  Plan: ${cached.plan}`);
    console.log('');

    const name = cached?.customer_name || (await this._question('Your Name: ')).trim();
    const email = cached?.customer_email || (await this._question('Your Email: ')).trim();
    if (!name || !email) { console.log('Name and email required.'); return; }

    console.log('');
    console.log('Submitting reactivation request...');
    try {
      const result = await this.engine.sendReactivationRequest({
        license_key: licenseKey,
        customer_name: name,
        customer_email: email,
      });
      if (result.success) {
        console.log('Reactivation request submitted! Our team will contact you.');
      } else {
        console.log(`Failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _viewHardwareStatus(): Promise<void> {
    console.log('── Hardware Status ──');
    if (!this._hardwareInfo) {
      this._updateHardwareStatus();
    }
    console.log(`  Hardware Status: Ready`);
    console.log(`  Binding Status: ${this._hardwareInfo!.bindingStatus}`);
    console.log(`  Hardware ID: ${this._hardwareInfo!.hardwareId}`);
    console.log(`  Device Name: ${this._hardwareInfo!.deviceName}`);
    console.log(`  System Name: ${this._hardwareInfo!.systemName}`);
    console.log(`  Operating System: ${this._hardwareInfo!.operatingSystem}`);
    console.log(`  Runtime: ${RUNTIME_TYPE}`);
    console.log(`  SDK Version: ${SDK_VERSION}`);
    console.log('');
  }

  private async _viewConversations(): Promise<void> {
    console.log('── Your Conversations ──');
    const cached = this.cache.getLicenseStatus();
    const email = cached?.customer_email || (await this._question('Enter your email: ')).trim();
    if (!email) { console.log('Email is required.'); return; }

    try {
      const result = await this.engine.listConversations(email);
      if (!result.success || !result.data?.conversations?.length) {
        console.log('No conversations found for this email.');
        return;
      }

      const conversations = result.data.conversations;
      console.log(`\nFound ${conversations.length} conversation(s):`);
      for (let i = 0; i < conversations.length; i++) {
        const conv = conversations[i];
        const cat = (conv.category || '').toUpperCase();
        console.log(`  ${i + 1}. [${cat}] ${conv.subject || 'No subject'}`);
        console.log(`     Status: ${conv.status} | ${new Date(conv.created_at).toLocaleDateString()}`);
      }
      console.log('');

      const choice = (await this._question('Select a conversation to view (number, or 0 to cancel): ')).trim();
      const index = parseInt(choice, 10) - 1;
      if (choice === '0' || isNaN(index) || index < 0 || index >= conversations.length) return;

      const selected = conversations[index];
      await this._viewConversationDetail(selected.id, selected.category);
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _viewConversationDetail(conversationId: string, category: string): Promise<void> {
    try {
      const result = await this.engine.getConversation(conversationId);
      if (!result.success) {
        console.log(`Failed to load conversation: ${result.error?.message || 'Unknown error'}`);
        return;
      }

      const conv = result.data?.conversation || {};
      const messages = result.data?.messages || [];
      const catLabel = (conv.category || category || '').toUpperCase();
      console.log(`\n── [${catLabel}] ${conv.subject || 'Conversation'} ──`);
      console.log(`  Status: ${conv.status || 'N/A'}`);
      console.log('');

      for (const msg of messages) {
        const date = new Date(msg.created_at).toLocaleString();
        const sender = msg.sender_type === 'admin' ? `${this.branding.sender_name}` : msg.sender_name || 'Customer';
        console.log(`  [${date}] ${sender}:`);
        console.log(`  ${msg.message}`);
        console.log('');
      }

      const canReply = conv.status !== 'closed' && conv.status !== 'resolved';
      if (canReply) {
        const replyChoice = (await this._question('Reply to this conversation? (y/n): ')).trim().toLowerCase();
        if (replyChoice === 'y' || replyChoice === 'yes') {
          await this._replyToConversation(conversationId);
        }
      } else {
        console.log('This conversation is closed.');
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _replyToConversation(conversationId: string): Promise<void> {
    const cached = this.cache.getLicenseStatus();
    const name = cached?.customer_name || (await this._question('Your Name: ')).trim();
    const email = cached?.customer_email || (await this._question('Your Email: ')).trim();
    if (!name || !email) { console.log('Name and email are required.'); return; }

    const message = (await this._question('Your message: ')).trim();
    if (!message) { console.log('Message is required.'); return; }

    console.log('Sending reply...');
    try {
      const result = await this.engine.replyToConversation(conversationId, message, name, email);
      if (result.success) {
        console.log('Reply sent! The team will review it.');
      } else if (result.queued) {
        console.log('Reply queued. Will be sent when connection is restored.');
      } else {
        console.log(`Failed: ${result.error?.message || result.message || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _viewNotifications(): Promise<void> {
    console.log('── Notifications ──');
    const cached = this.cache.getLicenseStatus();
    const email = cached?.customer_email || (await this._question('Enter your email: ')).trim();
    if (!email) { console.log('Email is required.'); return; }

    try {
      const result = await this.engine.getNotifications(email);
      if (!result.success || !result.data?.notifications?.length) {
        console.log('No notifications found.');
        return;
      }

      const notifications = result.data.notifications;
      for (let i = 0; i < notifications.length; i++) {
        const n = notifications[i];
        const readStatus = n.is_read ? ' ' : '●';
        console.log(`  ${readStatus} ${i + 1}. [${(n.category || '').toUpperCase()}] ${n.title}`);
        console.log(`     ${new Date(n.created_at).toLocaleDateString()}`);
      }
      console.log('');

      const choice = (await this._question('Select notification to view (number, or 0 to cancel): ')).trim();
      const index = parseInt(choice, 10) - 1;
      if (choice === '0' || isNaN(index) || index < 0 || index >= notifications.length) return;

      const selected = notifications[index];
      console.log(`\n── ${selected.title} ──`);
      console.log(`  ${selected.message}`);
      console.log('');

      if (!selected.is_read) {
        await this.engine.markNotificationRead(selected.id);
      }

      await this._question('Press Enter to continue...');
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _hardwareIssue(): Promise<void> {
    console.log('── Hardware Issue ──');
    const info = await this._collectRequestInfo('HARDWARE');
    if (!info) return;

    try {
      const result = await this.engine.createCommunication({
        category: 'hardware_replacement',
        customer_email: info.customer_email,
        customer_name: info.customer_name,
        subject: 'Hardware Issue Report',
        message: info.message,
        license_key: info.license_key || '',
        hardware_id: info.hardware_id || '',
      });
      if (result.success) {
        console.log('Hardware issue reported! Our support team will review it.');
      } else if (result.queued) {
        console.log('Hardware issue queued. Will be sent when connection is restored.');
      } else {
        console.log(`Failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _contactSupport(): Promise<void> {
    console.log('── Contact Support ──');
    const info = await this._collectRequestInfo('SUPPORT');
    if (!info) return;

    try {
      const result = await this.engine.createCommunication({
        category: 'support',
        customer_email: info.customer_email,
        customer_name: info.customer_name,
        subject: 'Support Request',
        message: info.message,
        license_key: info.license_key || '',
        hardware_id: info.hardware_id || '',
      });
      if (result.success) {
        console.log('Support request submitted! Our team will get back to you.');
      } else if (result.queued) {
        console.log('Support request queued. Will be sent when connection is restored.');
      } else {
        console.log(`Failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.log(`Error: ${(e as Error).message}`);
    }
  }

  private async _requestHistory(): Promise<void> {
    console.log('── Request History ──');
    const email = await this._question('Enter email to check request status: ');
    if (!email.trim()) return;

    try {
      const result = await this.engine.getRequestHistory(email.trim());
      if (result.success && result.data?.requests?.length > 0) {
        console.log(`\nFound ${result.data.requests.length} request(s):`);
        for (const req of result.data.requests) {
          console.log(`  ${req.request_id} | ${req.request_type} | ${req.status} | ${new Date(req.created_at).toLocaleDateString()}`);
          console.log(`  Subject: ${req.subject}`);
          console.log('');
        }
      } else {
        console.log('No requests found for this email.');
      }
    } catch (e) {
      console.log(`Error fetching history: ${(e as Error).message}`);
    }
  }

  // ====================================================================
  // Shutdown (Rule 18 — Close Behaviour)
  // ====================================================================

  private _saveRuntimeState(): void {
    if (this._hardwareInfo) {
      this.cache.set('hardware_id', this._hardwareInfo.hardwareId);
    }
    if (this.status) {
      this.cache.setLicenseStatus(this.status.toDict());
    }
  }

  private _shutdown(): void {
    console.log('Shutdown sequence started — Saving state and flushing cache');
    this._saveRuntimeState();
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    if (this._releaseLock) {
      this._releaseLock();
      this._releaseLock = null;
    }
    console.log('Destroying all SDK dialogs...');
    console.log('Exiting process...');
    process.exit(0);
  }
}

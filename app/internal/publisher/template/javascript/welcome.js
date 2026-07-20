import { HardwareDetector } from './hardware.js';
import { CacheManager } from './cache.js';

function loadApiConfig() {
  try {
    const raw = document.querySelector('script[data-ws-config]')?.dataset?.wsConfig
      || localStorage.getItem('ws_api_config');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export class WelcomeDialog {
  constructor(client, productName, cache) {
    this.client = client;
    this.productName = productName || '';
    this.cache = cache || new CacheManager({});
    this.hardware = new HardwareDetector();
    this._dialog = null;
    this._resolve = null;
    this._trialEnabled = false;
    const config = loadApiConfig();
    const branding = config.branding || {};
    const colors = branding.colors || {};
    this._primary = colors.primary || branding.primary_color || '#6366f1';
    this._text_primary = colors.text_primary || '#111827';
    this._text_secondary = colors.text_secondary || '#6b7280';
    this._success = colors.success || '#16a34a';
    this._error = colors.error || '#dc2626';
    this._border = colors.border || '#d1d5db';
    this._card_bg = colors.bg_card || '#ffffff';
  }

  isOnboardingComplete() { return this.cache.isOnboardingComplete(); }

  async show() {
    if (this.isOnboardingComplete()) return { skipped: true, message: 'Already completed' };
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._createDialog();
    });
  }

  _createDialog() {
    this._dialog = document.createElement('div');
    this._dialog.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:sans-serif;';

    const card = document.createElement('div');
    card.style.cssText = `background:${this._card_bg};border-radius:12px;padding:24px;width:440px;max-width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);`;

    card.innerHTML = `
      <h2 style="margin:0 0 4px;color:${this._text_primary};font-size:22px;">Welcome</h2>
      <p style="margin:0 0 20px;color:${this._text_secondary};font-size:14px;">${this.productName} — Complete registration to start your trial</p>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:13px;font-weight:600;color:${this._text_primary};margin-bottom:4px;">Name *</label>
        <input id="ws-w-name" type="text" style="width:100%;padding:8px 12px;border:1px solid ${this._border};border-radius:6px;font-size:14px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:13px;font-weight:600;color:${this._text_primary};margin-bottom:4px;">Email *</label>
        <input id="ws-w-email" type="email" style="width:100%;padding:8px 12px;border:1px solid ${this._border};border-radius:6px;font-size:14px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:13px;font-weight:600;color:${this._text_primary};margin-bottom:4px;">Mobile Number *</label>
        <input id="ws-w-mobile" type="tel" style="width:100%;padding:8px 12px;border:1px solid ${this._border};border-radius:6px;font-size:14px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:20px;">
        <label style="display:block;font-size:13px;font-weight:600;color:${this._text_primary};margin-bottom:4px;">Company (optional)</label>
        <input id="ws-w-company" type="text" style="width:100%;padding:8px 12px;border:1px solid ${this._border};border-radius:6px;font-size:14px;box-sizing:border-box;">
      </div>
      <div id="ws-w-status" style="font-size:13px;margin-bottom:12px;color:${this._text_secondary};"></div>
      <div style="display:flex;gap:8px;">
        <button id="ws-w-start" style="flex:1;padding:10px;background:${this._primary};color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;">Start Trial</button>
        <button id="ws-w-close" style="padding:10px;background:${this._border};color:${this._text_primary};border:none;border-radius:6px;font-size:14px;cursor:pointer;">Close</button>
      </div>
    `;

    this._dialog.appendChild(card);
    document.body.appendChild(this._dialog);

    card.querySelector('#ws-w-start').onclick = () => this._onStart();
    card.querySelector('#ws-w-close').onclick = () => {
      this._resolve({ skipped: true, closed: true });
      this._close();
    };
  }

  async _onStart() {
    const name = this._dialog.querySelector('#ws-w-name').value.trim();
    const email = this._dialog.querySelector('#ws-w-email').value.trim();
    const mobile = this._dialog.querySelector('#ws-w-mobile').value.trim();
    const company = this._dialog.querySelector('#ws-w-company').value.trim();
    const status = this._dialog.querySelector('#ws-w-status');

    if (!name || !email || !mobile) {
      status.textContent = 'Name, email, and mobile are required.';
      status.style.color = this._error;
      return;
    }

    status.textContent = 'Starting trial...';
    status.style.color = this._text_secondary;

    try {
      const hid = await this.hardware.getFingerprint();
      await this.client.updateCustomer(name, email, mobile, hid);
      await this.client.startTrial(email, name, { mobile, company_name: company, hardware_id: hid });
      this.cache.setOnboardingComplete();
      status.textContent = 'Trial activated! You can now use the software.';
      status.style.color = this._success;
      setTimeout(() => {
        this._resolve({ name, email, hardware_id: hid, onboarding_complete: true });
        this._close();
      }, 1500);
    } catch (e) {
      status.textContent = `Error: ${e.message}`;
      status.style.color = this._error;
    }
  }

  _close() {
    if (this._dialog && this._dialog.parentNode) {
      this._dialog.parentNode.removeChild(this._dialog);
    }
  }
}

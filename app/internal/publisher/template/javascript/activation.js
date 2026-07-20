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

export class ActivationDialog {
  constructor(client, productName, cache) {
    this.client = client;
    this.productName = productName || '';
    this.cache = cache || new CacheManager({});
    this.hardware = new HardwareDetector();
    this._hardwareId = null;
    this._licenseKey = null;
    this._activated = false;
    this._cancelled = false;
    this._dialog = null;
    const config = loadApiConfig();
    const branding = config.branding || {};
    const colors = branding.colors || {};
    this._primary = colors.primary || branding.primary_color || '#6366f1';
    this._secondary = colors.secondary || '#6b7280';
    this._text_primary = colors.text_primary || '#111827';
    this._text_secondary = colors.text_secondary || '#6b7280';
    this._success = colors.success || '#16a34a';
    this._error = colors.error || '#dc2626';
    this._border = colors.border || '#d1d5db';
    this._card_bg = colors.bg_card || '#ffffff';
    this._bg = colors.bg_page || '#f3f4f6';
  }

  async show() {
    this._hardwareId = await this.hardware.getFingerprint();
    this._createDialog();
    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  _createDialog() {
    this._dialog = document.createElement('div');
    this._dialog.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:sans-serif;`;

    const card = document.createElement('div');
    card.style.cssText = `background:${this._card_bg};border-radius:12px;padding:24px;width:480px;max-width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2);`;

    card.innerHTML = `
      <h2 style="margin:0 0 4px;color:${this._text_primary};font-size:20px;">Universal License Activation</h2>
      <p style="margin:0 0 16px;color:${this._text_secondary};font-size:14px;">${this.productName}</p>
      <div style="background:${this._bg};padding:12px;border-radius:8px;margin-bottom:16px;">
        <p style="margin:0;font-size:13px;color:${this._text_primary};"><strong>Hardware ID:</strong> ${this._hardwareId ? this._hardwareId.slice(0, 32) + '...' : 'Unable to detect'}</p>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:13px;font-weight:600;color:${this._text_primary};margin-bottom:4px;">License Key</label>
        <input id="ws-lic-key" type="text" style="width:100%;padding:8px 12px;border:1px solid ${this._border};border-radius:6px;font-size:14px;box-sizing:border-box;" placeholder="Enter license key">
      </div>
      <div id="ws-lic-status" style="font-size:13px;margin-bottom:12px;color:${this._text_secondary};"></div>
      <div style="display:flex;gap:8px;">
        <button id="ws-lic-validate" style="flex:1;padding:10px;background:${this._secondary};color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;">Validate</button>
        <button id="ws-lic-activate" style="flex:1;padding:10px;background:${this._primary};color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;" disabled>Activate</button>
        <button id="ws-lic-cancel" style="padding:10px;background:${this._border};color:${this._text_primary};border:none;border-radius:6px;font-size:14px;cursor:pointer;">Cancel</button>
      </div>
      <div style="margin-top:16px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
        <p style="margin:0;font-size:12px;color:#991b1b;">This device will be permanently linked to this license. For device replacement, contact support@websmithdigital.com</p>
      </div>
    `;

    this._dialog.appendChild(card);
    document.body.appendChild(this._dialog);

    card.querySelector('#ws-lic-validate').onclick = () => this._onValidate();
    card.querySelector('#ws-lic-activate').onclick = () => this._onActivate();
    card.querySelector('#ws-lic-cancel').onclick = () => { this._cancelled = true; this._close(); };
  }

  async _onValidate() {
    const input = this._dialog.querySelector('#ws-lic-key');
    const status = this._dialog.querySelector('#ws-lic-status');
    const key = input.value.trim();
    if (!key) { status.textContent = 'Please enter a license key.'; status.style.color = this._error; return; }
    status.textContent = 'Validating...';
    status.style.color = this._text_secondary;
    try {
      const r = await this.client.validateLicense(key, this._hardwareId);
      if (r.valid || r.data?.valid) {
        this._licenseKey = key;
        status.textContent = 'License validated.';
        status.style.color = this._success;
        this._dialog.querySelector('#ws-lic-activate').disabled = false;
      } else {
        status.textContent = r.message || r.error || 'Validation failed';
        status.style.color = this._error;
      }
    } catch (e) { status.textContent = `Error: ${e.message}`; status.style.color = this._error; }
  }

  async _onActivate() {
    if (!this._licenseKey || !this._hardwareId) return;
    const status = this._dialog.querySelector('#ws-lic-status');
    status.textContent = 'Activating...';
    status.style.color = this._text_secondary;
    try {
      const r = await this.client.activateLicense(this._licenseKey, this._hardwareId);
      if (r.success || r.data?.success) {
        this._activated = true;
        status.textContent = 'License activated successfully!';
        status.style.color = this._success;
        this.cache.invalidateLicenseStatus();
        setTimeout(() => this._close(), 1500);
      } else {
        status.textContent = r.message || r.error || 'Activation failed';
        status.style.color = this._error;
      }
    } catch (e) { status.textContent = `Error: ${e.message}`; status.style.color = this._error; }
  }

  _close() {
    if (this._dialog && this._dialog.parentNode) {
      this._dialog.parentNode.removeChild(this._dialog);
    }
    if (this._resolve) {
      this._resolve({ activated: this._activated, cancelled: this._cancelled, license_key: this._licenseKey });
    }
  }
}

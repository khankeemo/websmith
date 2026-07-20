import { HardwareDetector } from './hardware.js';

export class DeviceReplaceDialog {
  constructor(engine, licenseKey) {
    this.engine = engine;
    this.licenseKey = licenseKey;
    engine._licenseKey = licenseKey;
    this._dialog = null;
    this._resolve = null;
    this._hardware = new HardwareDetector();
  }

  async show() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._createDialog();
    });
  }

  async _createDialog() {
    const s = this.engine.getStatus();
    const oldHw = s?.hardware_id || 'Unknown';
    const newHw = await this._hardware.getFingerprint();

    this._dialog = document.createElement('div');
    this._dialog.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:sans-serif;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:12px;padding:24px;width:440px;max-width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);';

    card.innerHTML = `
      <h2 style="margin:0 0 4px;color:#111827;font-size:20px;">Replace Device</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Move your license from old device to this one.</p>
      <div style="background:#f3f4f6;padding:12px;border-radius:8px;margin-bottom:16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Old Hardware: <strong>${oldHw.slice(0, 48)}</strong></p>
        <p style="margin:0;font-size:12px;color:#6b7280;">New Hardware: <strong>${newHw.slice(0, 48)}</strong></p>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px;">Device Name</label>
        <input id="ws-d-name" type="text" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;" placeholder="New Device">
      </div>
      <div id="ws-d-status" style="font-size:13px;margin-bottom:12px;color:#6b7280;"></div>
      <div style="display:flex;gap:8px;">
        <button id="ws-d-replace" style="flex:1;padding:10px;background:#f59e0b;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;">Replace Device</button>
        <button id="ws-d-cancel" style="padding:10px;background:#e5e7eb;color:#374151;border:none;border-radius:6px;font-size:14px;cursor:pointer;">Cancel</button>
      </div>
    `;

    this._dialog.appendChild(card);
    document.body.appendChild(this._dialog);

    card.querySelector('#ws-d-replace').onclick = () => this._onReplace();
    card.querySelector('#ws-d-cancel').onclick = () => { this._resolve(null); this._close(); };
  }

  async _onReplace() {
    const status = this._dialog.querySelector('#ws-d-status');
    status.textContent = 'Replacing device...';
    status.style.color = '#6b7280';
    try {
      const r = await this.engine.replaceHardware();
      if (r.success) { status.textContent = 'Device replaced!'; status.style.color = '#16a34a'; this._resolve({ action: 'device_replaced' }); setTimeout(() => this._close(), 1000); }
      else { status.textContent = r.message || 'Failed'; status.style.color = '#dc2626'; }
    } catch (e) { status.textContent = `Error: ${e.message}`; status.style.color = '#dc2626'; }
  }

  _close() {
    if (this._dialog && this._dialog.parentNode) this._dialog.parentNode.removeChild(this._dialog);
  }
}

export class RenewalDialog {
  constructor(engine, licenseKey) {
    this.engine = engine;
    this.licenseKey = licenseKey;
    engine._licenseKey = licenseKey;
    this._dialog = null;
    this._resolve = null;
  }

  async show() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._createDialog();
    });
  }

  _createDialog() {
    this._dialog = document.createElement('div');
    this._dialog.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:sans-serif;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:12px;padding:24px;width:440px;max-width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);';

    const s = this.engine.getStatus();
    card.innerHTML = `
      <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Renew License</h2>
      <p style="font-size:14px;color:#6b7280;margin:0 0 4px;">Current Plan: ${s?.plan || '--'}</p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">Expiry: ${s?.expires_at || 'N/A'}</p>
      <div id="ws-r-plans" style="margin-bottom:16px;max-height:200px;overflow-y:auto;"></div>
      <div id="ws-r-status" style="font-size:13px;margin-bottom:12px;color:#6b7280;"></div>
      <button id="ws-r-close" style="padding:10px 20px;background:#e5e7eb;color:#374151;border:none;border-radius:6px;font-size:14px;cursor:pointer;">Close</button>
    `;

    this._dialog.appendChild(card);
    document.body.appendChild(this._dialog);

    card.querySelector('#ws-r-close').onclick = () => { this._resolve(null); this._close(); };
    this._loadPlans();
  }

  async _loadPlans() {
    const container = this._dialog.querySelector('#ws-r-plans');
    const status = this._dialog.querySelector('#ws-r-status');
    try {
      const pr = await this.engine.getPlans();
      if (pr.success) {
        const plans = pr.data || pr.plans || [];
        plans.forEach((p, i) => {
          const btn = document.createElement('button');
          btn.textContent = `${p.name} — $${p.price} (${p.duration_days || '--'} days)`;
          btn.style.cssText = 'display:block;width:100%;padding:10px;margin-bottom:6px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;font-size:13px;cursor:pointer;text-align:left;';
          btn.onclick = async () => {
            status.textContent = 'Processing...';
            try {
              const r = await this.engine.renew(p.id || p.name);
              if (r.success) { status.textContent = 'Renewed!'; status.style.color = '#16a34a'; this._resolve({ action: 'renewed' }); setTimeout(() => this._close(), 1000); }
              else { status.textContent = r.message || 'Failed'; status.style.color = '#dc2626'; }
            } catch (e) { status.textContent = `Error: ${e.message}`; status.style.color = '#dc2626'; }
          };
          container.appendChild(btn);
        });
      } else {
        container.textContent = 'No plans available.';
      }
    } catch (e) { status.textContent = `Error: ${e.message}`; status.style.color = '#dc2626'; }
  }

  _close() {
    if (this._dialog && this._dialog.parentNode) this._dialog.parentNode.removeChild(this._dialog);
  }
}

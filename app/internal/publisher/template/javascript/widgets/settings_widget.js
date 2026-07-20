export class SettingsWidget {
  constructor(container, engine) {
    this.container = container;
    this.engine = engine;
    this._elements = {};
  }

  build() {
    const div = document.createElement('div');
    div.style.cssText = 'font-family:sans-serif;padding:16px;background:#f8f9fa;border-radius:8px;';
    div.innerHTML = `
      <h3 style="margin:0 0 12px;color:#333;font-size:16px;">License Information</h3>
      <div id="ws-set-s" style="font-size:14px;color:#555;"></div>
      <div id="ws-set-p" style="font-size:14px;color:#555;"></div>
      <div id="ws-set-e" style="font-size:14px;color:#555;"></div>
      <div id="ws-set-pl" style="font-size:14px;color:#555;"></div>
      <div id="ws-set-h" style="font-size:12px;color:#888;"></div>
      <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;">
        <button class="ws-act" data-action="activate" style="padding:6px 12px;background:#6366f1;color:white;border:none;border-radius:4px;cursor:pointer;">Activate</button>
        <button class="ws-act" data-action="renew" style="padding:6px 12px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;">Renew</button>
        <button class="ws-act" data-action="replace" style="padding:6px 12px;background:#f59e0b;color:white;border:none;border-radius:4px;cursor:pointer;">Replace Device</button>
        <button class="ws-act" data-action="welcome" style="padding:6px 12px;background:#8b5cf6;color:white;border:none;border-radius:4px;cursor:pointer;">Open Welcome</button>
      </div>
    `;
    this.container.appendChild(div);
    this._elements = {
      s: div.querySelector('#ws-set-s'), p: div.querySelector('#ws-set-p'),
      e: div.querySelector('#ws-set-e'), pl: div.querySelector('#ws-set-pl'),
      h: div.querySelector('#ws-set-h'),
    };

    div.querySelectorAll('.ws-act').forEach(btn => {
      btn.onclick = () => this[`_${btn.dataset.action}`]();
    });

    this.refresh();
    return div;
  }

  async refresh() {
    const s = this.engine.getStatus() || await this.engine.initialize();
    const c = this.engine.config;
    this._elements.s.textContent = `Status: ${s ? s.status.toUpperCase() : 'UNKNOWN'}`;
    this._elements.s.style.color = s?.valid ? '#16a34a' : '#dc2626';
    this._elements.p.textContent = `Product: ${c.product?.name || '--'}`;
    this._elements.e.textContent = `Expiry: ${s?.expires_at || 'N/A'}`;
    this._elements.pl.textContent = `Plan: ${s?.plan || 'N/A'}`;
    this._elements.h.textContent = `Hardware ID: ${s?.hardware_id || '--'}`;
  }

  async _activate() {
    const { ActivationDialog } = await import('../activation.js');
    await new ActivationDialog(this.engine._client, this.engine.config.product?.name || '', this.engine._cache).show();
    await this.refresh();
  }

  async _renew() {
    const k = this.engine.getLicenseKey();
    if (k) { const { RenewalDialog } = await import('../renewal.js'); await new RenewalDialog(this.engine, k).show(); await this.refresh(); }
  }

  async _replace() {
    const k = this.engine.getLicenseKey();
    if (k) { const { DeviceReplaceDialog } = await import('../device_replace.js'); await new DeviceReplaceDialog(this.engine, k).show(); await this.refresh(); }
  }

  async _welcome() {
    const { WelcomeDialog } = await import('../welcome.js');
    await new WelcomeDialog(this.engine._client, this.engine.config.product?.name || '', this.engine._cache).show();
    await this.refresh();
  }
}

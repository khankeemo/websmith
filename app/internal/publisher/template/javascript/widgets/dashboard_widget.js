// Startup sequence (enforced by build/refresh):
//   Application Start → LicenseEngine.initialize() → Internal API validates →
//   Final state (ACTIVE/TRIAL_ACTIVE) → Build Dashboard → Unlock UI → Start Services
// For any other state the dashboard shows a locked placeholder.
export class DashboardWidget {
  constructor(container, engine) {
    this.container = container;
    this.engine = engine;
    this._elements = {};
  }

  async build() {
    const s = this.engine.getStatus() || await this.engine.initialize();
    const validStates = ['active', 'trial', 'trial_active'];
    if (!s || !s.valid || !validStates.includes(s.status)) {
      const div = document.createElement('div');
      div.style.cssText = 'font-family:sans-serif;padding:16px;background:#f8f9fa;border-radius:8px;text-align:center;';
      div.innerHTML = `<p style="color:#dc2626;font-size:14px;margin:0;">License required — please activate this application.</p>`;
      this.container.appendChild(div);
      return div;
    }
    const div = document.createElement('div');
    div.style.cssText = 'font-family:sans-serif;padding:16px;background:#f8f9fa;border-radius:8px;';
    div.innerHTML = `
      <h3 style="margin:0 0 12px;color:#333;font-size:16px;">License Status</h3>
      <div id="ws-d-s" style="font-size:14px;color:#555;"></div>
      <div id="ws-d-t" style="font-size:14px;color:#555;"></div>
      <div id="ws-d-d" style="font-size:14px;color:#555;"></div>
      <div id="ws-d-e" style="font-size:14px;color:#555;"></div>
      <div id="ws-d-p" style="font-size:14px;color:#555;"></div>
      <button id="ws-d-refresh" style="margin-top:8px;padding:6px 12px;background:#e5e7eb;color:#333;border:none;border-radius:4px;cursor:pointer;">Refresh</button>
    `;
    this.container.appendChild(div);
    this._elements = {
      s: div.querySelector('#ws-d-s'),
      t: div.querySelector('#ws-d-t'),
      d: div.querySelector('#ws-d-d'),
      e: div.querySelector('#ws-d-e'),
      p: div.querySelector('#ws-d-p'),
    };
    const refreshBtn = div.querySelector('#ws-d-refresh');
    refreshBtn.onclick = () => this.refresh();
    this.refresh();
    return div;
  }

  async refresh() {
    const s = this.engine.getStatus() || await this.engine.initialize();
    const validStates = ['active', 'trial', 'trial_active'];
    if (s && s.valid && validStates.includes(s.status)) {
      const label = s.trial_active ? 'Trial Active' : 'Licensed';
      this._elements.s.textContent = `Status: ${label}`;
      this._elements.s.style.color = '#16a34a';
      this._elements.t.textContent = '';
      this._elements.d.textContent = `Remaining days: ${s.days_remaining}`;
      this._elements.e.textContent = `Expiry: ${s.expires_at || 'N/A'}`;
      this._elements.p.textContent = `Plan: ${s.plan || 'N/A'}`;
    } else {
      this._elements.s.textContent = `Status: ${s?.message || 'Unlicensed'}`;
      this._elements.s.style.color = '#dc2626';
      this._elements.t.textContent = '';
      this._elements.d.textContent = '';
      this._elements.e.textContent = '';
      this._elements.p.textContent = '';
    }
  }
}

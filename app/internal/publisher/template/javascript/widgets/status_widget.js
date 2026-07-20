export class StatusWidget {
  constructor(container, engine) {
    this.container = container;
    this.engine = engine;
    this._icon = null;
    this._label = null;
  }

  build() {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;font-family:sans-serif;font-size:14px;';

    this._icon = document.createElement('span');
    this._icon.textContent = '\u25CF';
    this._icon.style.color = '#888';
    div.appendChild(this._icon);

    this._label = document.createElement('span');
    this._label.textContent = 'Checking...';
    this._label.style.color = '#555';
    div.appendChild(this._label);

    this.container.appendChild(div);
    this.refresh();
    return div;
  }

  async refresh() {
    const s = this.engine.getStatus() || await this.engine.initialize();
    if (s?.valid) {
      const text = s.trial_active ? `Trial: ${s.days_remaining}d` : `Licensed: ${s.days_remaining}d`;
      const color = s.trial_active ? '#f59e0b' : '#16a34a';
      this._label.textContent = text;
      this._label.style.color = color;
      this._icon.style.color = color;
    } else {
      this._label.textContent = s?.message || 'No license';
      this._label.style.color = '#dc2626';
      this._icon.style.color = '#dc2626';
    }
  }
}

export class ActivationButton {
  constructor(container, engine) {
    this.container = container;
    this.engine = engine;
    this._activated = false;
    this._btn = null;
  }

  build() {
    const btn = document.createElement('button');
    btn.textContent = 'Activate License';
    btn.style.cssText = 'padding:10px 20px;background:#6366f1;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-family:sans-serif;';
    btn.onclick = () => this._onClick();
    this.container.appendChild(btn);
    this._btn = btn;
    return btn;
  }

  async _onClick() {
    const { ActivationDialog } = await import('../activation.js');
    const r = await new ActivationDialog(
      this.engine._client,
      this.engine.config.product?.name || '',
      this.engine._cache,
    ).show();
    if (r?.activated) {
      this._activated = true;
      if (this._btn) {
        this._btn.textContent = 'Licensed';
        this._btn.style.background = '#16a34a';
      }
    }
  }

  isActivated() { return this._activated; }
}

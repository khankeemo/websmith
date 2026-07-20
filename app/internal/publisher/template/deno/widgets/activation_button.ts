export class ActivationButton {
  private engine: any;
  private _activated = false;

  constructor(parent: any, engine: any) { this.engine = engine; }

  async click(): Promise<boolean> {
    const { ActivationDialog } = await import('../activation.ts');
    const r = await new ActivationDialog(this.engine._client, this.engine.config.product?.name || '', this.engine._cache).show();
    if (r?.activated) { this._activated = true; return true; }
    return false;
  }

  isActivated(): boolean { return this._activated; }
}

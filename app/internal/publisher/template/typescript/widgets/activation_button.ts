import { LicenseEngine } from '../license_engine';
import { ActivationDialog } from '../activation';

export class ActivationButton {
  private engine: LicenseEngine;
  private _activated: boolean = false;

  constructor(parent: any, engine: LicenseEngine) {
    this.engine = engine;
  }

  async click(): Promise<boolean> {
    const client = this.engine._client;
    const cache = this.engine._cache;
    const result = await new ActivationDialog(
      client,
      this.engine.config.product?.name || '',
      cache,
    ).show();
    if (result?.activated) {
      this._activated = true;
      return true;
    }
    return false;
  }

  isActivated(): boolean {
    return this._activated;
  }
}

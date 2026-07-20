import { LicenseEngine } from '../license_engine';

export class StatusWidget {
  private engine: LicenseEngine;

  constructor(parent: any, engine: LicenseEngine) {
    this.engine = engine;
  }

  async refresh(): Promise<void> {
    const status = this.engine.getStatus() || await this.engine.initialize();
    if (status && status.valid) {
      const text = status.trial_active
        ? `Trial: ${status.days_remaining}d`
        : `Licensed: ${status.days_remaining}d`;
      console.log(text);
    } else {
      console.log(status?.message || 'No license');
    }
  }
}

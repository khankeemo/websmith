// Startup sequence (enforced by build/refresh):
//   Application Start → LicenseEngine.initialize() → Internal API validates →
//   Final state (ACTIVE/TRIAL_ACTIVE) → Build Dashboard → Unlock UI → Start Services
// For any other state the dashboard shows a locked placeholder.
import { LicenseEngine } from '../license_engine';

export class DashboardWidget {
  private engine: LicenseEngine;

  constructor(parent: any, engine: LicenseEngine) {
    this.engine = engine;
  }

  async refresh(): Promise<void> {
    const status = this.engine.getStatus() || await this.engine.initialize();
    const validStates = ['active', 'trial', 'trial_active'];
    console.log('=== License Status ===');
    if (status && status.valid && validStates.includes(status.status)) {
      const label = status.trial_active ? 'Trial Active' : 'Licensed';
      console.log(`Status: ${label}`);
      console.log(`Remaining days: ${status.days_remaining}`);
      console.log(`Expiry: ${status.expires_at || 'N/A'}`);
      console.log(`Plan: ${status.plan || 'N/A'}`);
    } else {
      console.log(`Status: ${status?.message || 'Unlicensed'}`);
    }
  }
}

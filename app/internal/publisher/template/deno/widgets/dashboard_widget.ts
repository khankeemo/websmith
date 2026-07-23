export class DashboardWidget {
  private engine: any;
  constructor(parent: any, engine: any) { this.engine = engine; }

  async refresh(): Promise<void> {
    const s = this.engine.getStatus() || await this.engine.initialize();
    console.log('=== License Status ===');
    if (s?.valid && ['active', 'trial', 'trial_active'].includes(s.status)) {
      console.log(`Status: ${s.trial_active ? 'Trial Active' : 'Licensed'}`);
      console.log(`Days: ${s.days_remaining}  Expiry: ${s.expires_at || 'N/A'}  Plan: ${s.plan || 'N/A'}`);
    } else {
      console.log(`Status: ${s?.message || 'Unlicensed'}`);
    }
  }
}

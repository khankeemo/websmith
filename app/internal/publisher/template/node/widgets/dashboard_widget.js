class DashboardWidget {
  constructor(parent, engine) {
    this.parent = parent;
    this.engine = engine;
  }

  async refresh() {
    const status = this.engine.getStatus() || await this.engine.initialize();
    console.log('=== License Status ===');
    if (status && status.valid && ['active', 'trial', 'trial_active'].includes(status.status)) {
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

module.exports = { DashboardWidget };

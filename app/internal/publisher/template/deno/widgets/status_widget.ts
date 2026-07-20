export class StatusWidget {
  private engine: any;
  constructor(parent: any, engine: any) { this.engine = engine; }

  async refresh(): Promise<void> {
    const s = this.engine.getStatus() || await this.engine.initialize();
    if (s?.valid) console.log(s.trial_active ? `Trial: ${s.days_remaining}d` : `Licensed: ${s.days_remaining}d`);
    else console.log(s?.message || 'No license');
  }
}

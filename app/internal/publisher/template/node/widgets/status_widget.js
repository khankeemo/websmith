class StatusWidget {
  constructor(parent, engine) {
    this.parent = parent;
    this.engine = engine;
  }

  async refresh() {
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

module.exports = { StatusWidget };

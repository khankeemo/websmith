const readline = require('readline');

class ActivationButton {
  constructor(parent, engine) {
    this.parent = parent;
    this.engine = engine;
    this._activated = false;
  }

  async click() {
    const { ActivationDialog } = require('../activation');
    const client = this.engine._client;
    const cache = this.engine._cache;
    const result = await new ActivationDialog(
      client,
      this.engine.config.product?.name || '',
      cache
    ).show();
    if (result?.activated) {
      this._activated = true;
      return true;
    }
    return false;
  }

  isActivated() {
    return this._activated;
  }
}

module.exports = { ActivationButton };

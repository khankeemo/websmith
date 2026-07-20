export class HardwareDetector {
  constructor() {
    this._fingerprint = null;
    this._identifiers = null;
  }

  async getFingerprint() {
    if (this._fingerprint === null) {
      const identifiers = await this._collectIdentifiers();
      const combined = this._buildCombinedString(identifiers);
      this._fingerprint = await this._hashIdentifiers(combined);
      this._identifiers = identifiers;
    }
    return this._fingerprint;
  }

  getIdentifiers() {
    if (this._identifiers === null) return {};
    return this._identifiers;
  }

  async _collectIdentifiers() {
    const identifiers = {};
    const canvasId = this._getCanvasFingerprint();
    if (canvasId) identifiers.canvas_id = canvasId;
    const navId = this._getNavigatorFingerprint();
    if (navId) identifiers.navigator_id = navId;
    const screenId = this._getScreenFingerprint();
    if (screenId) identifiers.screen_id = screenId;
    const timeId = this._getTimezoneFingerprint();
    if (timeId) identifiers.timezone_id = timeId;
    return identifiers;
  }

  _getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Crypto', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Crypto', 4, 17);
      return canvas.toDataURL();
    } catch {
      return null;
    }
  }

  _getNavigatorFingerprint() {
    try {
      const nav = navigator;
      const parts = [
        nav.userAgent || '',
        nav.language || '',
        nav.platform || '',
        nav.hardwareConcurrency || '',
        nav.deviceMemory || '',
        nav.maxTouchPoints || '',
      ];
      return parts.join('|');
    } catch {
      return null;
    }
  }

  _getScreenFingerprint() {
    try {
      const s = screen;
      return `${s.width}x${s.height}x${s.colorDepth}`;
    } catch {
      return null;
    }
  }

  _getTimezoneFingerprint() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  }

  _buildCombinedString(identifiers) {
    const parts = [];
    for (const key of ['canvas_id', 'navigator_id', 'screen_id', 'timezone_id']) {
      if (identifiers[key]) parts.push(identifiers[key]);
    }
    return parts.join('|');
  }

  async _hashIdentifiers(data) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

const crypto = require('crypto');
const os = require('os');

class HardwareDetector {
  constructor() {
    this._fingerprint = null;
    this._identifiers = null;
  }

  getFingerprint() {
    if (this._fingerprint === null) {
      const identifiers = this._collectIdentifiers();
      const combined = this._buildCombinedString(identifiers);
      this._fingerprint = this._hashIdentifiers(combined);
      this._identifiers = identifiers;
    }
    return this._fingerprint;
  }

  getIdentifiers() {
    if (this._identifiers === null) {
      this.getFingerprint();
    }
    return this._identifiers || {};
  }

  _collectIdentifiers() {
    const identifiers = {};
    const cpuId = this._getCpuId();
    if (cpuId) identifiers.cpu_id = cpuId;
    const motherboardId = this._getMotherboardId();
    if (motherboardId) identifiers.motherboard_id = motherboardId;
    if (!motherboardId) {
      const networkId = this._getNetworkId();
      if (networkId) identifiers.network_id = networkId;
    }
    const osInfo = this._getOsInfo();
    if (osInfo) identifiers.os_info = osInfo;
    return identifiers;
  }

  _getCpuId() {
    try {
      const cpus = os.cpus();
      if (cpus && cpus.length > 0) {
        return cpus[0].model.trim() || null;
      }
    } catch (_) {}
    return os.arch() || null;
  }

  _getMotherboardId() {
    return null;
  }

  _getNetworkId() {
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        const addrs = interfaces[name];
        if (!addrs) continue;
        for (const addr of addrs) {
          if (addr.mac && addr.mac !== '00:00:00:00:00:00' && !addr.internal) {
            const mac = addr.mac.replace(/:/g, '').toLowerCase();
            return crypto.createHash('sha256').update('net-' + mac, 'utf-8').digest('hex').slice(0, 16);
          }
        }
      }
    } catch (_) {}
    return null;
  }

  _getOsInfo() {
    return os.platform() + '-' + os.release();
  }

  _buildCombinedString(identifiers) {
    const parts = [];
    for (const key of ['cpu_id', 'motherboard_id', 'network_id']) {
      if (identifiers[key]) parts.push(identifiers[key]);
    }
    return parts.join('|');
  }

  _hashIdentifiers(data) {
    return crypto.createHash('sha256').update(data, 'utf-8').digest('hex');
  }
}

module.exports = { HardwareDetector };

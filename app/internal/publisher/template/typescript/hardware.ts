import * as crypto from 'crypto';
import * as os from 'os';

interface HardwareIdentifiers {
  cpu_id?: string;
  motherboard_id?: string;
  network_id?: string;
  os_info?: string;
}

export class HardwareDetector {
  private _fingerprint: string | null = null;
  private _identifiers: HardwareIdentifiers | null = null;

  getFingerprint(): string {
    if (this._fingerprint === null) {
      const identifiers = this._collectIdentifiers();
      const combined = this._buildCombinedString(identifiers);
      this._fingerprint = this._hashIdentifiers(combined);
      this._identifiers = identifiers;
    }
    return this._fingerprint;
  }

  getIdentifiers(): HardwareIdentifiers {
    if (this._identifiers === null) {
      this.getFingerprint();
    }
    return this._identifiers || {};
  }

  private _collectIdentifiers(): HardwareIdentifiers {
    const identifiers: HardwareIdentifiers = {};
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

  private _getCpuId(): string | null {
    try {
      const cpus = os.cpus();
      if (cpus && cpus.length > 0) {
        return cpus[0].model.trim() || null;
      }
    } catch (_) {}
    return os.arch() || null;
  }

  private _getMotherboardId(): string | null {
    return null;
  }

  private _getNetworkId(): string | null {
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

  private _getOsInfo(): string | null {
    return os.platform() + '-' + os.release();
  }

  private _buildCombinedString(identifiers: HardwareIdentifiers): string {
    const parts: string[] = [];
    for (const key of ['cpu_id', 'motherboard_id', 'network_id'] as const) {
      if (identifiers[key]) parts.push(identifiers[key]!);
    }
    return parts.join('|');
  }

  private _hashIdentifiers(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf-8').digest('hex');
  }
}

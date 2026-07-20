interface HardwareIdentifiers {
  cpu_id?: string;
  motherboard_id?: string;
  network_id?: string;
  os_info?: string;
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class HardwareDetector {
  private _fingerprint: string | null = null;
  private _identifiers: HardwareIdentifiers | null = null;

  getFingerprint(): string {
    if (this._fingerprint === null) {
      const identifiers = this._collectIdentifiers();
      const combined = this._buildCombinedString(identifiers);
      this._fingerprint = sha256Hex(combined);
      this._identifiers = identifiers;
    }
    return this._fingerprint;
  }

  getIdentifiers(): HardwareIdentifiers {
    if (this._identifiers === null) this.getFingerprint();
    return this._identifiers || {};
  }

  private _collectIdentifiers(): HardwareIdentifiers {
    const identifiers: HardwareIdentifiers = {};
    const cpuId = this._getCpuId();
    if (cpuId) identifiers.cpu_id = cpuId;
    const mb = this._getMotherboardId();
    if (mb) identifiers.motherboard_id = mb;
    if (!mb) { const net = this._getNetworkId(); if (net) identifiers.network_id = net; }
    const osInfo = this._getOsInfo();
    if (osInfo) identifiers.os_info = osInfo;
    return identifiers;
  }

  private _getCpuId(): string | null {
    try {
      const info = Deno.systemCpuInfo();
      if (info?.model) return info.model.trim();
    } catch {}
    return Deno.build.arch || null;
  }

  private _getMotherboardId(): string | null {
    return null;
  }

  private _getNetworkId(): string | null {
    try {
      const interfaces = Deno.networkInterfaces();
      for (const iface of interfaces) {
        if (iface.mac && iface.mac !== '00:00:00:00:00:00' && !iface.internal) {
          const mac = iface.mac.replace(/:/g, '').toLowerCase();
          return sha256Hex('net-' + mac).slice(0, 16);
        }
      }
    } catch {}
    return null;
  }

  private _getOsInfo(): string {
    return `${Deno.build.os}-${Deno.osRelease()}`;
  }

  private _buildCombinedString(identifiers: HardwareIdentifiers): string {
    const parts: string[] = [];
    for (const key of ['cpu_id', 'motherboard_id', 'network_id'] as const) {
      if (identifiers[key]) parts.push(identifiers[key]!);
    }
    return parts.join('|');
  }
}

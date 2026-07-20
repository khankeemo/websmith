<?php
namespace WSD\SDK;

class HardwareDetector
{
    private ?string $fingerprint = null;
    private ?array $identifiers = null;

    public function getFingerprint(): string
    {
        if ($this->fingerprint === null) {
            $identifiers = $this->collectIdentifiers();
            $combined = $this->buildCombinedString($identifiers);
            $this->fingerprint = $this->hashIdentifiers($combined);
            $this->identifiers = $identifiers;
        }
        return $this->fingerprint;
    }

    public function getIdentifiers(): array
    {
        if ($this->identifiers === null) {
            $this->getFingerprint();
        }
        return $this->identifiers ?? [];
    }

    private function collectIdentifiers(): array
    {
        $identifiers = [];
        $cpuId = $this->getCpuId();
        if ($cpuId !== null) {
            $identifiers['cpu_id'] = $cpuId;
        }
        $motherboardId = $this->getMotherboardId();
        if ($motherboardId !== null) {
            $identifiers['motherboard_id'] = $motherboardId;
        }
        if (!isset($identifiers['motherboard_id'])) {
            $networkId = $this->getNetworkId();
            if ($networkId !== null) {
                $identifiers['network_id'] = $networkId;
            }
        }
        $osInfo = $this->getOsInfo();
        if ($osInfo !== null) {
            $identifiers['os_info'] = $osInfo;
        }
        return $identifiers;
    }

    private function getCpuId(): ?string
    {
        $osFamily = PHP_OS_FAMILY;
        try {
            if ($osFamily === 'Windows') {
                return $this->getCpuIdWindows();
            } elseif ($osFamily === 'Darwin') {
                return $this->getCpuIdDarwin();
            } elseif ($osFamily === 'Linux') {
                return $this->getCpuIdLinux();
            }
        } catch (\Throwable $e) {
        }
        return php_uname('m') ?: null;
    }

    private function getCpuIdWindows(): ?string
    {
        try {
            $output = [];
            $exitCode = 0;
            @exec('wmic cpu get ProcessorId /value 2>nul', $output, $exitCode);
            if ($exitCode === 0) {
                foreach ($output as $line) {
                    if (preg_match('/^ProcessorId=(.+)$/', trim($line), $m)) {
                        $cpuId = trim($m[1]);
                        if ($cpuId !== '') {
                            return $cpuId;
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
        }
        return php_uname('m') ?: null;
    }

    private function getCpuIdDarwin(): ?string
    {
        try {
            $output = [];
            $exitCode = 0;
            @exec('sysctl -n hw.model 2>/dev/null', $output, $exitCode);
            if ($exitCode === 0 && !empty($output[0])) {
                return 'mac-' . trim($output[0]);
            }
        } catch (\Throwable $e) {
        }
        try {
            $output = [];
            $exitCode = 0;
            @exec('sysctl -n machdep.cpu.brand_string 2>/dev/null', $output, $exitCode);
            if ($exitCode === 0 && !empty($output[0])) {
                return substr(hash('sha256', trim($output[0])), 0, 16);
            }
        } catch (\Throwable $e) {
        }
        return php_uname('m') ?: null;
    }

    private function getCpuIdLinux(): ?string
    {
        try {
            $cpuinfo = @file_get_contents('/proc/cpuinfo');
            if ($cpuinfo !== false) {
                if (preg_match('/Serial\s*:\s*([0-9a-f]+)/i', $cpuinfo, $m)) {
                    return 'cpu-' . $m[1];
                }
                $vendor = '';
                $family = '';
                foreach (explode("\n", $cpuinfo) as $line) {
                    if (str_starts_with($line, 'vendor_id')) {
                        $parts = explode(':', $line, 2);
                        $vendor = trim($parts[1] ?? '');
                    } elseif (str_starts_with($line, 'cpu family')) {
                        $parts = explode(':', $line, 2);
                        $family = trim($parts[1] ?? '');
                    }
                }
                if ($vendor !== '' && $family !== '') {
                    return "{$vendor}-{$family}";
                }
            }
        } catch (\Throwable $e) {
        }
        return php_uname('m') ?: null;
    }

    private function getMotherboardId(): ?string
    {
        $osFamily = PHP_OS_FAMILY;
        try {
            if ($osFamily === 'Windows') {
                $output = [];
                $exitCode = 0;
                @exec('wmic baseboard get SerialNumber /value 2>nul', $output, $exitCode);
                if ($exitCode === 0) {
                    foreach ($output as $line) {
                        if (preg_match('/^SerialNumber=(.+)$/', trim($line), $m)) {
                            $serial = trim($m[1]);
                            if ($serial !== '' && !in_array($serial, ['To be filled by O.E.M.', 'Default string'], true)) {
                                return 'mb-' . $serial;
                            }
                        }
                    }
                }
            } elseif ($osFamily === 'Linux') {
                $output = [];
                $exitCode = 0;
                @exec('dmidecode -s baseboard-serial-number 2>/dev/null', $output, $exitCode);
                if ($exitCode === 0 && !empty($output[0])) {
                    $serial = trim($output[0]);
                    if ($serial !== '' && !in_array($serial, ['To be filled by O.E.M.', 'Default string'], true)) {
                        return 'mb-' . $serial;
                    }
                }
            }
        } catch (\Throwable $e) {
        }
        return null;
    }

    private function getNetworkId(): ?string
    {
        try {
            $macs = [];
            $osFamily = PHP_OS_FAMILY;
            if ($osFamily === 'Linux') {
                $netDir = '/sys/class/net';
                if (is_dir($netDir)) {
                    $interfaces = scandir($netDir);
                    if ($interfaces !== false) {
                        foreach ($interfaces as $iface) {
                            if ($iface === '.' || $iface === '..' || $iface === 'lo') {
                                continue;
                            }
                            $addrFile = $netDir . '/' . $iface . '/address';
                            if (file_exists($addrFile)) {
                                $mac = trim(@file_get_contents($addrFile));
                                if ($mac !== '' && $mac !== '00:00:00:00:00:00') {
                                    $macs[] = $mac;
                                }
                            }
                        }
                    }
                }
            } else {
                $output = [];
                $exitCode = 0;
                @exec('getmac 2>nul', $output, $exitCode);
                if ($exitCode === 0 && is_array($output)) {
                    foreach ($output as $line) {
                        if (preg_match('/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/', $line, $m)) {
                            $macs[] = strtolower($m[0]);
                        }
                    }
                }
            }
            if (!empty($macs)) {
                $combined = 'net-' . implode(':', array_slice($macs, 0, 3));
                return substr(hash('sha256', $combined), 0, 16);
            }
        } catch (\Throwable $e) {
        }
        return null;
    }

    private function getOsInfo(): ?string
    {
        return php_uname('s') . '-' . php_uname('r');
    }

    private function buildCombinedString(array $identifiers): string
    {
        $parts = [];
        foreach (['cpu_id', 'motherboard_id', 'network_id'] as $key) {
            if (isset($identifiers[$key])) {
                $parts[] = $identifiers[$key];
            }
        }
        return implode('|', $parts);
    }

    private function hashIdentifiers(string $data): string
    {
        return hash('sha256', $data);
    }
}

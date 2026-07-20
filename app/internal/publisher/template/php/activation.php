<?php
namespace WSD\SDK;

class ActivationDialog
{
    private array $config;
    private ApiClient $client;
    private CacheManager $cache;
    private HardwareDetector $hardware;
    private string $productName;
    private string $supportEmail;

    public function __construct(
        ?ApiClient $client = null,
        ?CacheManager $cache = null,
        ?HardwareDetector $hardware = null,
        ?string $productName = null
    ) {
        $this->config = $this->loadConfig();
        $this->client = $client ?? new ApiClient($this->config);
        $this->cache = $cache ?? new CacheManager($this->config);
        $this->hardware = $hardware ?? new HardwareDetector();
        $this->productName = $productName ?? ($this->config['product']['name'] ?? '');
        $branding = $this->config['branding'] ?? [];
        $this->supportEmail = $branding['support_email'] ?? 'support@websmithdigital.com';
    }

    private function loadConfig(): array
    {
        $paths = [
            __DIR__ . '/config/api-config.json',
            getcwd() . '/config/api-config.json',
        ];
        foreach ($paths as $path) {
            if (file_exists($path)) {
                $data = @file_get_contents($path);
                if ($data !== false) {
                    $decoded = json_decode($data, true);
                    if (is_array($decoded)) {
                        return $decoded;
                    }
                }
            }
        }
        return [];
    }

    public function show(): array
    {
        echo "\n=== " . ($this->productName ?: 'License') . " Activation ===\n\n";

        echo "Detecting hardware...\n";
        try {
            $hardwareId = $this->hardware->getFingerprint();
            echo "Hardware ID: {$hardwareId}\n\n";
        } catch (\Throwable $e) {
            echo "Unable to detect hardware: {$e->getMessage()}\n";
            echo "Please contact support: {$this->supportEmail}\n";
            return ['activated' => false, 'cancelled' => true, 'error' => 'Hardware detection failed'];
        }

        echo "Enter License Key: ";
        $licenseKey = trim(fgets(STDIN));
        if ($licenseKey === '') {
            echo "License key is required.\n";
            return ['activated' => false, 'cancelled' => true, 'error' => 'No license key entered'];
        }

        echo "\nValidating license...\n";
        try {
            $result = $this->client->validateLicense($licenseKey, $hardwareId);
            $data = $result['data'] ?? $result;
            if (empty($data['valid']) && empty($result['valid'])) {
                $errMsg = $result['message'] ?? $result['error'] ?? 'License validation failed';
                echo "Validation failed: {$errMsg}\n";
                return ['activated' => false, 'cancelled' => true, 'error' => $errMsg];
            }

            $maxDev = (int)($data['max_devices'] ?? 0);
            $devCount = (int)($data['device_count'] ?? $data['active_devices'] ?? 0);
            if ($maxDev > 0 && $devCount >= $maxDev) {
                echo "Device limit reached ({$devCount}/{$maxDev}). Deactivate another device first.\n";
                echo "Contact support: {$this->supportEmail}\n";
                return ['activated' => false, 'cancelled' => true, 'error' => 'Device limit reached'];
            }

            echo "\nLicense validated successfully!\n";
            if (!empty($data['expiry_date'])) {
                echo "Expires: {$data['expiry_date']}\n";
            }
            if (!empty($data['plan'])) {
                echo "Plan: {$data['plan']}\n";
            }

            echo "\nActivate this license on this device? (y/n): ";
            $confirm = strtolower(trim(fgets(STDIN)));
            if ($confirm !== 'y' && $confirm !== 'yes') {
                echo "Activation cancelled.\n";
                return ['activated' => false, 'cancelled' => true];
            }

            echo "\nActivating license...\n";
            $activateResult = $this->client->activateLicense($licenseKey, $hardwareId);
            if (!empty($activateResult['success']) || !empty($activateResult['data']['success'])) {
                echo "License activated successfully!\n";
                $this->cache->invalidateLicenseStatus();
                return [
                    'activated' => true,
                    'license_key' => $licenseKey,
                    'hardware_id' => $hardwareId,
                ];
            } else {
                $errMsg = $activateResult['message'] ?? $activateResult['error'] ?? 'Activation failed';
                echo "Activation failed: {$errMsg}\n";
                return ['activated' => false, 'cancelled' => false, 'error' => $errMsg];
            }
        } catch (\Throwable $e) {
            echo "Error: {$e->getMessage()}\n";
            return ['activated' => false, 'cancelled' => true, 'error' => $e->getMessage()];
        }
    }
}

<?php
namespace WSD\SDK;

class DeviceReplaceDialog
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

    public function show(?string $licenseKey = null): array
    {
        echo "\n=== Device Replacement ===\n\n";

        if ($licenseKey === null) {
            echo "Enter License Key: ";
            $licenseKey = trim(fgets(STDIN));
            if ($licenseKey === '') {
                echo "License key is required.\n";
                return ['replaced' => false, 'cancelled' => true, 'error' => 'No license key entered'];
            }
        }

        echo "Enter OLD Hardware ID: ";
        $oldHardwareId = trim(fgets(STDIN));
        if ($oldHardwareId === '') {
            echo "Old hardware ID is required.\n";
            return ['replaced' => false, 'cancelled' => true, 'error' => 'No old hardware ID entered'];
        }

        echo "\nDetecting new hardware...\n";
        try {
            $newHardwareId = $this->hardware->getFingerprint();
            echo "New Hardware ID: {$newHardwareId}\n\n";
        } catch (\Throwable $e) {
            echo "Unable to detect new hardware: {$e->getMessage()}\n";
            echo "Please contact support: {$this->supportEmail}\n";
            return ['replaced' => false, 'cancelled' => true, 'error' => 'Hardware detection failed'];
        }

        if ($oldHardwareId === $newHardwareId) {
            echo "Old and new hardware IDs are identical. No replacement needed.\n";
            return ['replaced' => false, 'cancelled' => true, 'error' => 'Identical hardware IDs'];
        }

        echo "Replace device from:\n";
        echo "  Old: {$oldHardwareId}\n";
        echo "  New: {$newHardwareId}\n";
        echo "Proceed? (y/n): ";
        $confirm = strtolower(trim(fgets(STDIN)));
        if ($confirm !== 'y' && $confirm !== 'yes') {
            echo "Device replacement cancelled.\n";
            return ['replaced' => false, 'cancelled' => true];
        }

        echo "\nReplacing device...\n";
        try {
            $result = $this->client->replaceDevice(
                licenseKey: $licenseKey,
                newHardwareId: $newHardwareId,
                oldHardwareId: $oldHardwareId
            );
            if (!empty($result['success'])) {
                echo "Device replaced successfully!\n";
                $this->cache->invalidateLicenseStatus();
                return [
                    'replaced' => true,
                    'license_key' => $licenseKey,
                    'old_hardware_id' => $oldHardwareId,
                    'new_hardware_id' => $newHardwareId,
                ];
            } else {
                $errMsg = $result['message'] ?? $result['error'] ?? 'Replacement failed';
                echo "Replacement failed: {$errMsg}\n";
                return ['replaced' => false, 'cancelled' => false, 'error' => $errMsg];
            }
        } catch (\Throwable $e) {
            echo "Error: {$e->getMessage()}\n";
            return ['replaced' => false, 'cancelled' => true, 'error' => $e->getMessage()];
        }
    }
}

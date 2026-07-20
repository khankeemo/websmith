<?php
namespace WSD\SDK\Widgets;

use WSD\SDK\ApiClient;
use WSD\SDK\CacheManager;
use WSD\SDK\HardwareDetector;

class ActivationButtonWidget
{
    public static function render(): void
    {
        echo "\n--- Activation Widget ---\n\n";
        $config = self::loadConfig();
        if (empty($config)) {
            echo "Error: api-config.json not found.\n";
            return;
        }
        $cache = new CacheManager($config);
        $hardware = new HardwareDetector();
        try {
            $hardwareId = $hardware->getFingerprint();
            echo "Hardware ID: {$hardwareId}\n\n";
        } catch (\Throwable $e) {
            echo "Hardware detection failed: {$e->getMessage()}\n";
            return;
        }
        echo "Enter License Key: ";
        $licenseKey = trim(fgets(STDIN));
        if ($licenseKey === '') {
            echo "License key is required.\n";
            return;
        }
        try {
            $client = new ApiClient($config, $hardware, $cache);
            echo "Activating license...\n";
            $result = $client->activateLicense($licenseKey, $hardwareId);
            if (!empty($result['success']) || !empty($result['data']['success'])) {
                echo "License activated successfully!\n";
                $cache->invalidateLicenseStatus();
            } else {
                $err = $result['message'] ?? $result['error'] ?? 'Activation failed';
                echo "Failed: {$err}\n";
            }
        } catch (\Throwable $e) {
            echo "Error: {$e->getMessage()}\n";
        }
    }

    private static function loadConfig(): array
    {
        $paths = [
            __DIR__ . '/../config/api-config.json',
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
}

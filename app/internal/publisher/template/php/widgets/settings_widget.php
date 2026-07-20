<?php
namespace WSD\SDK\Widgets;

class SettingsWidget
{
    public static function render(): void
    {
        echo "\n--- SDK Settings ---\n\n";
        $config = self::loadConfig();
        if (empty($config)) {
            echo "No configuration loaded.\n";
            return;
        }
        echo "API Settings:\n";
        $api = $config['api'] ?? [];
        echo "  URL: " . ($api['url'] ?? 'Not set') . "\n";
        echo "  Version: " . ($api['version'] ?? 'v1') . "\n";
        echo "  Timeout: " . ($api['timeout'] ?? 30000) . "ms\n";
        echo "  Retry Count: " . ($api['retry_count'] ?? 3) . "\n";
        echo "  Public Key: " . (isset($api['public_key']) ? substr($api['public_key'], 0, 8) . '...' : 'Not set') . "\n";
        $product = $config['product'] ?? [];
        echo "\nProduct Settings:\n";
        echo "  ID: " . ($product['id'] ?? 'Not set') . "\n";
        echo "  Name: " . ($product['name'] ?? 'Not set') . "\n";
        $trial = $config['trial'] ?? [];
        echo "\nTrial Settings:\n";
        echo "  Enabled: " . (!empty($trial['enabled']) ? 'Yes' : 'No') . "\n";
        echo "  Days: " . ($trial['days'] ?? 0) . "\n";
        $offline = $config['offline'] ?? [];
        echo "\nOffline Settings:\n";
        echo "  Cache Days: " . ($offline['cache_days'] ?? 0) . "\n";
        $license = $config['license'] ?? [];
        echo "\nLicense Settings:\n";
        echo "  Max Devices: " . ($license['max_devices'] ?? 'Unlimited') . "\n";
        echo "  Allow Conversion: " . (!empty($license['allow_conversion']) ? 'Yes' : 'No') . "\n";
        $branding = $config['branding'] ?? [];
        echo "\nBranding:\n";
        echo "  Company: " . ($branding['company_name'] ?? 'Not set') . "\n";
        echo "  Support Email: " . ($branding['support_email'] ?? 'support@websmithdigital.com') . "\n";
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

<?php
namespace WSD\SDK;

class RenewalDialog
{
    private array $config;
    private ApiClient $client;
    private CacheManager $cache;
    private string $productName;
    private string $supportEmail;

    public function __construct(
        ?ApiClient $client = null,
        ?CacheManager $cache = null,
        ?string $productName = null
    ) {
        $this->config = $this->loadConfig();
        $this->client = $client ?? new ApiClient($this->config);
        $this->cache = $cache ?? new CacheManager($this->config);
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
        if ($licenseKey === null) {
            echo "\n=== License Renewal ===\n\n";
            echo "Enter License Key to renew: ";
            $licenseKey = trim(fgets(STDIN));
            if ($licenseKey === '') {
                echo "License key is required.\n";
                return ['renewed' => false, 'cancelled' => true, 'error' => 'No license key entered'];
            }
        }

        echo "\nHow many days to renew? (leave empty for default): ";
        $input = trim(fgets(STDIN));
        $extraDays = null;
        if ($input !== '' && is_numeric($input)) {
            $extraDays = (int)$input;
        }

        echo "\nProcessing renewal for license key: {$licenseKey}\n";
        if ($extraDays !== null) {
            echo "Extra days: {$extraDays}\n";
        }

        try {
            $result = $this->client->renewLicense($licenseKey, $extraDays);
            if (!empty($result['success'])) {
                $data = $result['data'] ?? $result;
                $expiry = $data['expiry_date'] ?? $data['expires_at'] ?? 'N/A';
                echo "\nLicense renewed successfully!\n";
                echo "New expiry: {$expiry}\n";
                $this->cache->invalidateLicenseStatus();
                return [
                    'renewed' => true,
                    'license_key' => $licenseKey,
                    'expiry' => $expiry,
                ];
            } else {
                $errMsg = $result['message'] ?? $result['error'] ?? 'Renewal failed';
                echo "\nRenewal failed: {$errMsg}\n";
                return ['renewed' => false, 'cancelled' => false, 'error' => $errMsg];
            }
        } catch (\Throwable $e) {
            echo "\nError: {$e->getMessage()}\n";
            return ['renewed' => false, 'cancelled' => true, 'error' => $e->getMessage()];
        }
    }
}

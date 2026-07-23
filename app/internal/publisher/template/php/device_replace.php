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
        echo "Device reactivation requires Websmith Support approval.\n\n";
        echo "Please contact support at: {$this->supportEmail}\n";
        echo "The application will remain locked until reactivation is approved.\n\n";

        return ['action' => 'contact_support', 'support_email' => $this->supportEmail, 'cancelled' => true];
    }
}

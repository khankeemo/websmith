<?php
namespace WSD\SDK;

class WelcomeDialog
{
    private array $config;
    private ApiClient $client;
    private CacheManager $cache;
    private HardwareDetector $hardware;
    private string $productName;
    private bool $trialEnabled;
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
        $trial = $this->config['trial'] ?? [];
        $this->trialEnabled = !empty($trial['enabled']);
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

    public function isOnboardingComplete(): bool
    {
        return $this->cache->isOnboardingComplete();
    }

    public function show(): array
    {
        if (!$this->trialEnabled) {
            echo "Trial onboarding is not enabled for this product.\n";
            return ['skipped' => true, 'message' => 'Trial not enabled'];
        }

        if ($this->isOnboardingComplete()) {
            echo "Onboarding has already been completed.\n";
            return ['skipped' => true, 'message' => 'Already completed'];
        }

        echo "\n=== Welcome to " . ($this->productName ?: 'Software') . " ===\n\n";
        echo "Complete your registration to start the trial.\n\n";

        echo "Name *: ";
        $name = trim(fgets(STDIN));
        while ($name === '') {
            echo "Name is required. Please enter your name: ";
            $name = trim(fgets(STDIN));
        }

        echo "Email *: ";
        $email = trim(fgets(STDIN));
        while ($email === '' || !str_contains($email, '@')) {
            echo "Valid email is required. Please enter your email: ";
            $email = trim(fgets(STDIN));
        }

        echo "Company (optional): ";
        $company = trim(fgets(STDIN));

        echo "\nStarting trial for: {$name} <{$email}>...\n";

        try {
            $hardwareId = $this->hardware->getFingerprint();
            $customerData = [
                'company_name' => $company,
                'hardware_id' => $hardwareId,
            ];
            $result = $this->client->startTrial($email, $name, $customerData);

            if (!empty($result['success'])) {
                $this->cache->setOnboardingComplete();
                echo "\nTrial activated successfully! You can now use the software.\n";
                return [
                    'name' => $name,
                    'email' => $email,
                    'hardware_id' => $hardwareId,
                    'onboarding_complete' => true,
                ];
            }

            $errorMsg = $result['error'] ?? $result['message'] ?? 'Unknown error';
            echo "\nFailed to start trial: {$errorMsg}\n";
            return ['skipped' => true, 'message' => $errorMsg];
        } catch (\Throwable $e) {
            echo "\nError: {$e->getMessage()}\n";
            return ['skipped' => true, 'message' => $e->getMessage()];
        }
    }
}

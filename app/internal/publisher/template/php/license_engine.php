<?php
namespace WSD\SDK;

class LicenseStatus
{
    public bool $valid;
    public string $status;
    public ?string $expiresAt;
    public int $daysRemaining;
    public ?string $plan;
    public ?string $hardwareId;
    public ?string $message;
    public ?string $licenseKey;
    public bool $trialActive;

    public function __construct(
        bool $valid,
        string $status,
        ?string $expiresAt = null,
        int $daysRemaining = 0,
        ?string $plan = null,
        ?string $hardwareId = null,
        ?string $message = null,
        ?string $licenseKey = null,
        bool $trialActive = false
    ) {
        $this->valid = $valid;
        $this->status = $status;
        $this->expiresAt = $expiresAt;
        $this->daysRemaining = $daysRemaining;
        $this->plan = $plan;
        $this->hardwareId = $hardwareId;
        $this->message = $message;
        $this->licenseKey = $licenseKey;
        $this->trialActive = $trialActive;
    }

    public function toArray(): array
    {
        return [
            'valid' => $this->valid,
            'status' => $this->status,
            'expires_at' => $this->expiresAt,
            'days_remaining' => $this->daysRemaining,
            'plan' => $this->plan,
            'hardware_id' => $this->hardwareId,
            'message' => $this->message,
            'license_key' => $this->licenseKey,
            'trial_active' => $this->trialActive,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            valid: (bool)($data['valid'] ?? false),
            status: (string)($data['status'] ?? 'unlicensed'),
            expiresAt: $data['expires_at'] ?? null,
            daysRemaining: (int)($data['days_remaining'] ?? 0),
            plan: $data['plan'] ?? null,
            hardwareId: $data['hardware_id'] ?? null,
            message: $data['message'] ?? null,
            licenseKey: $data['license_key'] ?? null,
            trialActive: (bool)($data['trial_active'] ?? ($data['status'] ?? '') === 'trial')
        );
    }
}

class LicenseEngine
{
    private array $config;
    private HardwareDetector $hardware;
    private CacheManager $cache;
    private ApiClient $client;
    private ?LicenseStatus $status = null;
    private ?string $licenseKey = null;

    public function __construct(?string $configPath = null)
    {
        $this->config = $this->loadConfig($configPath);
        $this->hardware = new HardwareDetector();
        $this->cache = new CacheManager($this->config);
        $this->client = new ApiClient($this->config, $this->hardware, $this->cache);
    }

    private function loadConfig(?string $configPath): array
    {
        if ($configPath === null) {
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
            throw new \RuntimeException('api-config.json not found');
        }
        if (!file_exists($configPath)) {
            throw new \RuntimeException("api-config.json not found at: {$configPath}");
        }
        $data = @file_get_contents($configPath);
        if ($data === false) {
            throw new \RuntimeException("Failed to read config: {$configPath}");
        }
        $decoded = json_decode($data, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('Invalid config JSON');
        }
        return $decoded;
    }

    public function initialize(): LicenseStatus
    {
        if ($this->cache->isValid()) {
            $cached = $this->cache->getLicenseStatus();
            if ($cached !== null) {
                $this->status = LicenseStatus::fromArray($cached);
                return $this->status;
            }
        }
        try {
            $hardwareId = $this->hardware->getFingerprint();
            $trialResponse = $this->client->getTrialStatus($hardwareId);
            $trialData = $trialResponse['data'] ?? [];
            if (!empty($trialData['has_trial'])) {
                $statusStr = $trialData['status'] ?? 'trial';
                $this->status = new LicenseStatus(
                    valid: $statusStr === 'active',
                    status: $statusStr,
                    expiresAt: $trialData['expiry_date'] ?? null,
                    daysRemaining: (int)($trialData['days_left'] ?? 0),
                    plan: $trialData['plan'] ?? null,
                    hardwareId: $hardwareId,
                    message: "Trial is {$statusStr}"
                );
                if ($this->status->valid) {
                    $this->cache->setLicenseStatus($this->status->toArray());
                }
                return $this->status;
            }
            $this->status = new LicenseStatus(
                valid: false,
                status: 'unlicensed',
                hardwareId: $hardwareId,
                message: 'No license or trial found'
            );
            return $this->status;
        } catch (\Throwable $e) {
            $cached = $this->cache->getLicenseStatus();
            if ($cached !== null) {
                $this->status = LicenseStatus::fromArray($cached);
                return $this->status;
            }
            $this->status = new LicenseStatus(
                valid: false,
                status: 'error',
                message: "Unexpected error: {$e->getMessage()}"
            );
            return $this->status;
        }
    }

    public function getHardwareId(): string
    {
        return $this->hardware->getFingerprint();
    }

    public function getStatus(): ?LicenseStatus
    {
        return $this->status;
    }

    public function getLicenseKey(): ?string
    {
        return $this->licenseKey;
    }

    public function hasLicenseKey(): bool
    {
        return $this->licenseKey !== null;
    }

    public function validate(?string $licenseKey = null): array
    {
        $key = $licenseKey ?? $this->licenseKey;
        if ($key === null) {
            throw new \RuntimeException('License key unavailable. Please activate first.');
        }
        $hardwareId = $this->hardware->getFingerprint();
        $result = $this->client->validateLicense($key, $hardwareId);
        $data = $result['data'] ?? $result;
        if (!empty($data['valid'])) {
            if (!empty($data['license_key'])) {
                $this->licenseKey = $data['license_key'];
            }
            $this->initialize();
        }
        return $result;
    }

    public function activate(string $licenseKey): array
    {
        $result = $this->client->activateLicense($licenseKey);
        if (!empty($result['success'])) {
            $this->licenseKey = $licenseKey;
            $this->initialize();
        }
        return $result;
    }

    public function startTrial(string $email, string $customerName = '', ?array $customerData = null): array
    {
        $result = $this->client->startTrial($email, $customerName, $customerData);
        if (!empty($result['success'])) {
            $this->initialize();
        }
        return $result;
    }

    public function convertTrial(?string $plan = null, string $customerName = '', string $customerEmail = ''): array
    {
        $status = $this->initialize();
        if ($status === null || $status->status !== 'trial') {
            throw new \RuntimeException('No active trial to convert.');
        }
        $hardwareId = $this->hardware->getFingerprint();
        $result = $this->client->convertTrial($hardwareId, $plan, $customerName, $customerEmail);
        if (!empty($result['success'])) {
            if (isset($result['license_key'])) {
                $this->licenseKey = $result['license_key'];
            }
            $this->initialize();
        }
        return $result;
    }

    public function renew(?int $extraDays = null): array
    {
        if ($this->licenseKey === null) {
            throw new \RuntimeException('License key unavailable. Please activate first.');
        }
        $result = $this->client->renewLicense($this->licenseKey, $extraDays);
        if (!empty($result['success'])) {
            $this->initialize();
        }
        return $result;
    }

    public function deactivate(?string $licenseKey = null): array
    {
        $key = $licenseKey ?? $this->licenseKey;
        if ($key === null) {
            throw new \RuntimeException('License key unavailable. Please provide a key.');
        }
        $result = $this->client->deactivateLicense($key);
        if (!empty($result['success'])) {
            $this->cache->invalidateLicenseStatus();
            $this->status = null;
            if ($licenseKey === null) {
                $this->licenseKey = null;
            }
        }
        return $result;
    }

    public function replaceHardware(): array
    {
        if ($this->licenseKey === null) {
            throw new \RuntimeException('License key unavailable. Please activate first.');
        }
        $newHardwareId = $this->hardware->getFingerprint();
        $oldHardwareId = null;
        if ($this->status !== null && $this->status->hardwareId !== null) {
            $oldHardwareId = $this->status->hardwareId;
        }
        if ($oldHardwareId === null) {
            $cached = $this->cache->getLicenseStatus();
            if ($cached !== null && !empty($cached['hardware_id'])) {
                $oldHardwareId = $cached['hardware_id'];
            }
        }
        if ($oldHardwareId === null) {
            throw new \RuntimeException('Current hardware_id unavailable. Cannot replace device.');
        }
        if ($oldHardwareId === $newHardwareId) {
            return ['success' => false, 'message' => 'Old and new hardware IDs are identical.'];
        }
        $result = $this->client->replaceDevice(
            licenseKey: $this->licenseKey,
            newHardwareId: $newHardwareId,
            oldHardwareId: $oldHardwareId
        );
        if (!empty($result['success'])) {
            $this->cache->invalidateLicenseStatus();
            $this->status = null;
            $this->initialize();
        }
        return $result;
    }

    public function bindDevice(?string $licenseKey = null, ?string $deviceName = null): array
    {
        $key = $licenseKey ?? $this->licenseKey;
        if ($key === null) {
            throw new \RuntimeException('License key unavailable.');
        }
        $result = $this->client->bindDevice($key, deviceName: $deviceName);
        if (!empty($result['success'])) {
            $this->initialize();
        }
        return $result;
    }
}

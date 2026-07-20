<?php
namespace WSD\SDK;

class ApiError extends \RuntimeException
{
    private int $statusCode;
    private array $data;

    public function __construct(int $statusCode, string $message, array $data = [])
    {
        $this->statusCode = $statusCode;
        $this->data = $data;
        parent::__construct("API Error {$statusCode}: {$message}", $statusCode);
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getResponseData(): array
    {
        return $this->data;
    }
}

class ApiClient
{
    private array $config;
    private array $apiConfig;
    private string $baseUrl;
    private string $apiVersion;
    private string $apiKey;
    private string $apiSecret;
    private float $timeout;
    private int $retryCount;
    private string $productId;
    private ?HardwareDetector $hardware;
    private ?CacheManager $cache;

    private const RETRYABLE_STATUSES = [500, 502, 503, 504];
    private const SDK_VERSION = '${kit_version}';
    private const RUNTIME_TYPE = '${runtime}';

    public function __construct(
        array $config,
        ?HardwareDetector $hardware = null,
        ?CacheManager $cache = null
    ) {
        $this->config = $config;
        $this->apiConfig = $config['api'] ?? [];
        $this->baseUrl = rtrim($this->apiConfig['url'] ?? '', '/');
        $this->apiVersion = $this->apiConfig['version'] ?? 'v1';
        $this->apiKey = $this->apiConfig['public_key'] ?? '';
        $this->apiSecret = $this->apiConfig['secret'] ?? '';
        $this->timeout = (float)($this->apiConfig['timeout'] ?? 30000) / 1000;
        $this->retryCount = (int)($this->apiConfig['retry_count'] ?? 3);
        $this->productId = $config['product']['id'] ?? '';
        $this->hardware = $hardware ?? new HardwareDetector();
        $this->cache = $cache;
    }

    private function getHardwareId(): string
    {
        return $this->hardware->getFingerprint();
    }

    private function signRequest(array $payload, string $method = 'POST', string $path = '', string $query = ''): array
    {
        $timestamp = CryptoUtils::generateTimestamp();
        $nonce = CryptoUtils::generateNonce();
        $signature = CryptoUtils::signRequest($payload, $this->apiSecret, $timestamp, $nonce, $method, $path, $query);
        return [
            'x-api-key' => $this->apiKey,
            'x-timestamp' => $timestamp,
            'x-nonce' => $nonce,
            'x-signature' => $signature,
        ];
    }

    private function request(string $endpoint, array $payload, ?int $retries = null): array
    {
        $url = "{$this->baseUrl}/api/{$this->apiVersion}/{$endpoint}";
        $maxRetries = $retries ?? $this->retryCount;
        $requestPayload = $payload;
        if ($this->productId !== '' && !isset($requestPayload['product_id'])) {
            $requestPayload['product_id'] = $this->productId;
        }
        for ($attempt = 0; $attempt <= $maxRetries; $attempt++) {
            $apiPath = "/api/{$this->apiVersion}/{$endpoint}";
            $headers = $this->signRequest($requestPayload, 'POST', $apiPath, '');
            $headers['Content-Type'] = 'application/json';
            $ch = curl_init($url);
            if ($ch === false) {
                throw new \RuntimeException('Failed to initialize cURL');
            }
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($requestPayload),
                CURLOPT_HTTPHEADER => $this->formatHeaders($headers),
                CURLOPT_TIMEOUT => (int)ceil($this->timeout),
                CURLOPT_CONNECTTIMEOUT => 10,
                CURLOPT_FAILONERROR => false,
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            $data = [];
            if ($response !== false && $response !== '') {
                $decoded = json_decode($response, true);
                if (is_array($decoded)) {
                    $data = $decoded;
                } elseif ($response !== '') {
                    $data = ['message' => $response];
                }
            }
            if ($response !== false && $httpCode >= 200 && $httpCode < 300) {
                return $data;
            }
            if ($httpCode === 429) {
                if ($attempt < $maxRetries) {
                    $retryAfter = 5;
                    if (isset($data['retry_after'])) {
                        $retryAfter = (int)$data['retry_after'];
                    }
                    sleep($retryAfter);
                    continue;
                }
                throw new ApiError(429, 'Rate limit exceeded', $data);
            }
            if (in_array($httpCode, self::RETRYABLE_STATUSES, true)) {
                if ($attempt < $maxRetries) {
                    sleep(($attempt + 1) * 2);
                    continue;
                }
                throw new ApiError($httpCode, 'Server error', $data);
            }
            $message = $data['message'] ?? $data['error'] ?? "HTTP {$httpCode}";
            throw new ApiError($httpCode, $message, $data);
        }
        throw new ApiError(500, "Failed after {$maxRetries} retries");
    }

    private function formatHeaders(array $headers): array
    {
        $formatted = [];
        foreach ($headers as $key => $value) {
            $formatted[] = "{$key}: {$value}";
        }
        return $formatted;
    }

    public function validateLicense(string $licenseKey, ?string $hardwareId = null): array
    {
        if ($hardwareId === null) {
            $hardwareId = $this->getHardwareId();
        }
        $payload = ['action' => 'validate', 'license_key' => $licenseKey, 'hardware_id' => $hardwareId];
        if ($this->cache !== null && $this->cache->isValid()) {
            $cached = $this->cache->getLicenseStatus();
            if ($cached !== null) {
                return $cached;
            }
        }
        $response = $this->request('license', $payload);
        if ($this->cache !== null && ($response['success'] ?? false) && ($response['data']['valid'] ?? false)) {
            $this->cache->setLicenseStatus($response);
        }
        return $response;
    }

    public function activateLicense(string $licenseKey, ?string $hardwareId = null): array
    {
        if ($hardwareId === null) {
            $hardwareId = $this->getHardwareId();
        }
        $payload = ['action' => 'activate', 'license_key' => $licenseKey, 'hardware_id' => $hardwareId];
        $response = $this->request('license', $payload);
        if ($this->cache !== null) {
            $this->cache->invalidateLicenseStatus();
        }
        return $response;
    }

    public function deactivateLicense(string $licenseKey, ?string $hardwareId = null): array
    {
        if ($hardwareId === null) {
            $hardwareId = $this->getHardwareId();
        }
        $payload = ['action' => 'deactivate', 'license_key' => $licenseKey, 'hardware_id' => $hardwareId];
        $response = $this->request('license', $payload);
        if ($this->cache !== null) {
            $this->cache->invalidateLicenseStatus();
        }
        return $response;
    }

    public function renewLicense(string $licenseKey, ?int $extraDays = null): array
    {
        $payload = ['action' => 'renew', 'license_key' => $licenseKey];
        if ($extraDays !== null) {
            $payload['extra_days'] = $extraDays;
        }
        $response = $this->request('license', $payload);
        if ($this->cache !== null) {
            $this->cache->invalidateLicenseStatus();
        }
        return $response;
    }

    public function startTrial(string $email, string $customerName = '', ?array $customerData = null): array
    {
        $hardwareId = $this->getHardwareId();
        $payload = [
            'action' => 'start',
            'customer_email' => $email,
            'customer_name' => $customerName,
            'hardware_id' => $hardwareId,
        ];
        if ($customerData !== null) {
            $payload['customer_data'] = $customerData;
        }
        return $this->request('trial', $payload);
    }

    public function getTrialStatus(?string $hardwareId = null): array
    {
        if ($hardwareId === null) {
            $hardwareId = $this->getHardwareId();
        }
        return $this->request('trial', ['action' => 'status', 'hardware_id' => $hardwareId]);
    }

    public function convertTrial(?string $hardwareId = null, ?string $plan = null, string $customerName = '', string $customerEmail = ''): array
    {
        if ($hardwareId === null) {
            $hardwareId = $this->getHardwareId();
        }
        $payload = ['action' => 'convert', 'hardware_id' => $hardwareId];
        if ($plan !== null) {
            $payload['plan'] = $plan;
        }
        if ($customerName !== '') {
            $payload['customer_name'] = $customerName;
        }
        if ($customerEmail !== '') {
            $payload['customer_email'] = $customerEmail;
        }
        $response = $this->request('trial', $payload);
        if ($this->cache !== null) {
            $this->cache->invalidateLicenseStatus();
        }
        return $response;
    }

    public function bindDevice(string $licenseKey, ?string $hardwareId = null, ?string $deviceName = null): array
    {
        if ($hardwareId === null) {
            $hardwareId = $this->getHardwareId();
        }
        $payload = ['action' => 'bind', 'license_key' => $licenseKey, 'hardware_id' => $hardwareId];
        if ($deviceName !== null) {
            $payload['device_name'] = $deviceName;
        }
        return $this->request('device', $payload);
    }

    public function replaceDevice(string $licenseKey, ?string $newHardwareId = null, ?string $oldHardwareId = null): array
    {
        if ($newHardwareId === null) {
            $newHardwareId = $this->getHardwareId();
        }
        if ($oldHardwareId === null) {
            throw new \InvalidArgumentException('old_hardware_id is required for device replacement');
        }
        $payload = [
            'action' => 'replace',
            'license_key' => $licenseKey,
            'old_hardware_id' => $oldHardwareId,
            'new_hardware_id' => $newHardwareId,
        ];
        $response = $this->request('device', $payload);
        if ($this->cache !== null) {
            $this->cache->invalidateLicenseStatus();
        }
        return $response;
    }

    public function getProducts(): array
    {
        $payload = ['action' => 'list'];
        if ($this->productId !== '') {
            $payload['product_id'] = $this->productId;
        }
        try {
            return $this->request('store/products', $payload);
        } catch (\Throwable $e) {
            return ['success' => false, 'products' => []];
        }
    }

    public function updateCustomer(string $name, string $email, string $phone, ?string $hardwareId = null): array
    {
        if ($hardwareId === null) {
            $hardwareId = $this->getHardwareId();
        }
        $payload = [
            'action' => 'update',
            'name' => $name,
            'email' => $email,
            'mobile' => $phone,
            'hardware_id' => $hardwareId,
        ];
        return $this->request('customer/register', $payload);
    }
}

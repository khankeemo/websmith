import type { PublisherContext } from '../index';

export function getPhpTemplates(context: PublisherContext): Record<string, string> {
  const apiUrl = process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  const safeName = context.productName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const productId = context.productId.replace(/[^a-zA-Z0-9_-]/g, '');
  return {
    'Client.php': `<?php
namespace WebsmithSDK;

class ApiException extends \\RuntimeException
{
    public function __construct(string $message = '', int $code = 0, ?\\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}

class Client
{
    private string $apiKey;
    private string $apiSecret;
    private string $apiUrl;
    private array $config;

    public function __construct(
        ?string $apiKey = null,
        ?string $apiSecret = null,
        ?string $apiUrl = null
    ) {
        $this->config = $this->loadConfig();
        $this->apiKey = $apiKey ?? $this->config['api']['key'] ?? getenv('WEBSMITH_API_KEY') ?: '';
        $this->apiSecret = $apiSecret ?? $this->config['api']['secret'] ?? getenv('WEBSMITH_API_SECRET') ?: '';
        $this->apiUrl = rtrim($apiUrl ?? $this->config['api']['url'] ?? getenv('WEBSMITH_API_URL') ?: '', '/');
    }

    private function loadConfig(): array
    {
        $path = __DIR__ . '/config/api-config.json';
        if (!file_exists($path)) {
            return [];
        }
        $data = @file_get_contents($path);
        if ($data === false) {
            return [];
        }
        $decoded = json_decode($data, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function sign(
        string $method,
        string $path,
        string $query,
        string $body,
        string $timestamp,
        string $nonce
    ): string {
        $bodyHash = hash('sha256', $body);
        $canonical = $method . '\n' . $path . '\n' . $query . '\n' . $bodyHash . '\n' . $timestamp . '\n' . $nonce;
        $raw = hash_hmac('sha256', $canonical, $this->apiSecret, true);
        return base64_encode($raw);
    }

    private function request(string $method, string $endpoint, ?array $data = null): array
    {
        if ($this->apiUrl === '') {
            throw new ApiException('API URL is not configured. Set WEBSMITH_API_URL or provide api.url in config.');
        }
        if ($this->apiKey === '') {
            throw new ApiException('API key is not configured. Set WEBSMITH_API_KEY or provide api.key in config.');
        }

        $url = $this->apiUrl . $endpoint;
        $body = $data !== null ? json_encode($data) : '';
        $parsedUrl = parse_url($url);
        if ($parsedUrl === false) {
            throw new ApiException("Failed to parse URL: $url");
        }
        $path = $parsedUrl['path'] ?? '/';
        $query = $parsedUrl['query'] ?? '';
        $timestamp = (string) time();
        $nonce = bin2hex(random_bytes(16));
        $signature = $this->sign($method, $path, $query, $body, $timestamp, $nonce);

        $maxRetries = 3;
        $retryDelay = 1;

        for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
            $ch = curl_init($url);
            if ($ch === false) {
                throw new ApiException('Failed to initialize cURL');
            }

            $headers = [
                'X-API-Key: ' . $this->apiKey,
                'X-Timestamp: ' . $timestamp,
                'X-Nonce: ' . $nonce,
                'X-Signature: ' . $signature,
                'Content-Type: application/json',
            ];

            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CUSTOMREQUEST => $method,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_CONNECTTIMEOUT => 10,
                CURLOPT_FAILONERROR => false,
            ]);

            if ($body !== '') {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            }

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($curlError !== '' || $httpCode === 429 || $httpCode >= 500) {
                if ($attempt < $maxRetries - 1) {
                    usleep($retryDelay * 1000000);
                    $retryDelay *= 2;
                    continue;
                }
                $msg = $curlError !== '' ? $curlError : "HTTP $httpCode";
                throw new ApiException("Request failed: $msg");
            }

            $decoded = json_decode($response, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new ApiException('Invalid JSON response from API: ' . json_last_error_msg());
            }
            return $decoded;
        }

        throw new ApiException('Request failed after ' . $maxRetries . ' retries');
    }

    public function validateLicense(string $licenseKey, string $deviceId): array
    {
        return $this->request('POST', '/api/v1/license', [
            'action' => 'validate',
            'license_key' => $licenseKey,
            'hardware_id' => $deviceId,
        ]);
    }

    public function activateLicense(string $licenseKey, string $deviceId, string $deviceName): array
    {
        return $this->request('POST', '/api/v1/license', [
            'action' => 'activate',
            'license_key' => $licenseKey,
            'hardware_id' => $deviceId,
            'device_name' => $deviceName,
        ]);
    }

    public function deactivateLicense(string $licenseKey, string $deviceId): array
    {
        return $this->request('POST', '/api/v1/license', [
            'action' => 'deactivate',
            'license_key' => $licenseKey,
            'hardware_id' => $deviceId,
        ]);
    }

    public function renewLicense(string $licenseKey, ?int $extraDays = null): array
    {
        $payload = [
            'action' => 'renew',
            'license_key' => $licenseKey,
        ];
        if ($extraDays !== null) {
            $payload['extra_days'] = $extraDays;
        }
        return $this->request('POST', '/api/v1/license', $payload);
    }

    public function startTrial(string $email, string $customerName = '', ?array $customerData = null): array
    {
        $payload = [
            'action' => 'start',
            'customer_email' => $email,
            'customer_name' => $customerName,
        ];
        if ($customerData !== null) {
            $payload = array_merge($payload, $customerData);
        }
        return $this->request('POST', '/api/v1/trial', $payload);
    }

    public function checkTrial(string $hardwareId): array
    {
        return $this->request('POST', '/api/v1/trial', [
            'action' => 'status',
            'hardware_id' => $hardwareId,
        ]);
    }

    public function convertTrial(string $hardwareId, string $plan, string $name, string $email): array
    {
        return $this->request('POST', '/api/v1/trial', [
            'action' => 'convert',
            'hardware_id' => $hardwareId,
            'plan' => $plan,
            'customer_name' => $name,
            'customer_email' => $email,
        ]);
    }

    public function bindDevice(string $licenseKey, string $hardwareId, ?string $deviceName = null): array
    {
        $payload = [
            'action' => 'bind',
            'license_key' => $licenseKey,
            'hardware_id' => $hardwareId,
        ];
        if ($deviceName !== null) {
            $payload['device_name'] = $deviceName;
        }
        return $this->request('POST', '/api/v1/device', $payload);
    }

    public function getTrialStatus(string $hardwareId): array
    {
        return $this->request('POST', '/api/v1/trial', [
            'action' => 'status',
            'hardware_id' => $hardwareId,
        ]);
    }

    public function getProducts(): array
    {
        return $this->request('POST', '/api/v1/store/products', ['action' => 'list']);
    }
}

class HardwareFingerprint
{
    public static function generateFingerprint(): array
    {
        $macs = [];
        if (PHP_OS_FAMILY === 'Linux') {
            $dir = '/sys/class/net';
            if (is_dir($dir)) {
                $interfaces = scandir($dir);
                if ($interfaces !== false) {
                    foreach ($interfaces as $iface) {
                        if ($iface === '.' || $iface === '..') {
                            continue;
                        }
                        $addrFile = $dir . '/' . $iface . '/address';
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
            $output = null;
            $exitCode = 0;
            @exec('getmac 2>nul', $output, $exitCode);
            if ($exitCode === 0 && is_array($output)) {
                foreach ($output as $line) {
                    if (preg_match('/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/', $line, $m)) {
                        $macs[] = $m[0];
                    }
                }
            }
        }

        $cpu = php_uname('m');
        $hostname = php_uname('n');
        $combined = $cpu . '|' . $hostname . '|' . implode(':', array_slice($macs, 0, 5));

        return [
            'fingerprint' => hash('sha256', $combined),
            'cpu' => $cpu,
            'hostname' => $hostname,
            'mac_addresses' => $macs,
            'os' => php_uname('s') . ' ' . php_uname('r'),
        ];
    }
}

class CacheManager
{
    private array $config;
    private string $productId;
    private string $cacheDir;
    private string $cacheFile;
    private int $ttlDays;
    private ?array $cache = null;

    public function __construct(array $config)
    {
        $this->config = $config;
        $this->productId = $config['product']['id'] ?? 'unknown';
        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $this->productId);
        $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: '');
        $this->cacheDir = $homeDir !== '' ? $homeDir . '/.websmith/' . $safeName : sys_get_temp_dir() . '/.websmith/' . $safeName;
        $this->cacheFile = $this->cacheDir . '/cache.json';
        $this->ttlDays = $config['license']['cache_ttl_days'] ?? 0;
    }

    private function ensureCacheDir(): void
    {
        if (!is_dir($this->cacheDir)) {
            @mkdir($this->cacheDir, 0700, true);
        }
    }

    private function loadCache(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }
        $this->ensureCacheDir();
        if (!file_exists($this->cacheFile)) {
            $this->cache = [];
            return $this->cache;
        }
        $data = @file_get_contents($this->cacheFile);
        if ($data === false) {
            $this->cache = [];
            return $this->cache;
        }
        $decoded = json_decode($data, true);
        $this->cache = is_array($decoded) ? $decoded : [];
        return $this->cache;
    }

    private function saveCache(): void
    {
        if ($this->cache === null) {
            return;
        }
        $this->ensureCacheDir();
        $tmpFile = $this->cacheDir . '/cache.tmp';
        $written = @file_put_contents($tmpFile, json_encode($this->cache, JSON_PRETTY_PRINT), LOCK_EX);
        if ($written === false) {
            return;
        }
        @rename($tmpFile, $this->cacheFile);
    }

    public function get(string $key): mixed
    {
        $cache = $this->loadCache();
        $entry = $cache[$key] ?? null;
        if ($entry === null) {
            return null;
        }
        if ($this->isExpired($entry)) {
            $this->delete($key);
            return null;
        }
        return $entry['value'] ?? null;
    }

    public function set(string $key, mixed $value): void
    {
        $cache = $this->loadCache();
        $cache[$key] = [
            'value' => $value,
            'cached_at' => time(),
        ];
        $this->cache = $cache;
        $this->saveCache();
    }

    public function delete(string $key): void
    {
        $cache = $this->loadCache();
        if (array_key_exists($key, $cache)) {
            unset($cache[$key]);
            $this->cache = $cache;
            $this->saveCache();
        }
    }

    public function clear(): void
    {
        $this->cache = [];
        $this->saveCache();
    }

    public function isExpired(array $entry): bool
    {
        $cachedAt = $entry['cached_at'] ?? 0;
        $ttlSeconds = $this->ttlDays * 86400;
        return (time() - $cachedAt) > $ttlSeconds;
    }

    public function exists(): bool
    {
        return file_exists($this->cacheFile);
    }

    public function isLicenseStatusValid(): bool
    {
        $cache = $this->loadCache();
        $entry = $cache['license_status'] ?? null;
        if ($entry === null) {
            return false;
        }
        return !$this->isExpired($entry);
    }

    public function getLicenseStatus(): ?array
    {
        return $this->get('license_status');
    }

    public function setLicenseStatus(array $status): void
    {
        $this->set('license_status', $status);
    }

    public function invalidateLicenseStatus(): void
    {
        $this->delete('license_status');
    }

    public function getLicenseKey(): ?string
    {
        return $this->get('license_key');
    }

    public function setLicenseKey(string $key): void
    {
        $this->set('license_key', $key);
    }

}

class LicenseEngine
{
    private Client $client;
    private CacheManager $cache;
    private array $config;
    private array $fingerprint;
    private ?array $licenseData = null;
    private ?string $licenseKey = null;

    public function __construct(?Client $client = null)
    {
        $this->config = $this->loadConfig();
        $this->fingerprint = HardwareFingerprint::generateFingerprint();
        $this->cache = new CacheManager($this->config);
        $this->client = $client ?? new Client();
        $this->initialize();
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

    public function initialize(): ?array
    {
        if ($this->cache->isLicenseStatusValid()) {
            $cached = $this->cache->getLicenseStatus();
            if ($cached !== null) {
                $this->licenseData = $cached;
                if ($this->licenseKey === null && isset($cached['license_key'])) {
                    $this->licenseKey = $cached['license_key'];
                }
                return $cached;
            }
        }
        try {
            $response = $this->client->validateLicense(
                $this->licenseKey ?? '',
                $this->fingerprint['fingerprint']
            );
            $license = $response['license'] ?? $response;
            if (isset($license['status']) && $license['status'] !== '') {
                $this->licenseData = $license;
                if (isset($license['valid']) && $license['valid']) {
                    $this->cache->setLicenseStatus($license);
                }
                return $license;
            }
        } catch (ApiException $e) {
            $cached = $this->cache->getLicenseStatus();
            if ($cached !== null) {
                $this->licenseData = $cached;
                return $cached;
            }
        }
        return null;
    }

    public function validate(?string $licenseKey = null): array
    {
        $key = $licenseKey ?? $this->licenseKey;
        if ($key === null) {
            throw new ApiException('License key is required for validation.');
        }
        $result = $this->client->validateLicense($key, $this->fingerprint['fingerprint']);
        $this->licenseData = $result['license'] ?? $result;
        if (isset($this->licenseData['valid']) && $this->licenseData['valid']) {
            $this->cache->setLicenseStatus($this->licenseData);
        }
        return $result;
    }

    public function activate(string $licenseKey, string $deviceName = ''): array
    {
        $result = $this->client->activateLicense(
            $licenseKey,
            $this->fingerprint['fingerprint'],
            $deviceName
        );
        $this->licenseData = $result['license'] ?? $result;
        $this->licenseKey = $licenseKey;
        $this->cache->setLicenseKey($licenseKey);
        if (isset($this->licenseData['valid']) && $this->licenseData['valid']) {
            $this->cache->setLicenseStatus($this->licenseData);
        }
        return $result;
    }

    public function deactivate(?string $licenseKey = null): array
    {
        $key = $licenseKey ?? $this->licenseKey;
        if ($key === null) {
            throw new ApiException('License key is required for deactivation.');
        }
        $result = $this->client->deactivateLicense($key, $this->fingerprint['fingerprint']);
        $this->cache->invalidateLicenseStatus();
        $this->licenseData = null;
        if ($licenseKey === null) {
            $this->licenseKey = null;
            $this->cache->delete('license_key');
        }
        return $result;
    }

    public function renew(?int $extraDays = null): array
    {
        if ($this->licenseKey === null) {
            throw new ApiException('No license key stored. Activate a license first.');
        }
        $result = $this->client->renewLicense($this->licenseKey, $extraDays);
        $this->licenseData = $result['license'] ?? $result;
        if (isset($this->licenseData['valid']) && $this->licenseData['valid']) {
            $this->cache->setLicenseStatus($this->licenseData);
        }
        return $result;
    }

    public function startTrial(string $email, string $customerName = '', ?array $customerData = null): array
    {
        $result = $this->client->startTrial($email, $customerName, $customerData);
        if (isset($result['license_key'])) {
            $this->licenseKey = $result['license_key'];
            $this->cache->setLicenseKey($result['license_key']);
        }
        $this->licenseData = $result['license'] ?? $result;
        if (isset($this->licenseData['valid']) && $this->licenseData['valid']) {
            $this->cache->setLicenseStatus($this->licenseData);
        }
        return $result;
    }

    public function checkTrial(): array
    {
        return $this->client->checkTrial($this->fingerprint['fingerprint']);
    }

    public function convertTrial(string $plan, string $name, string $email): array
    {
        $result = $this->client->convertTrial(
            $this->fingerprint['fingerprint'],
            $plan,
            $name,
            $email
        );
        if (isset($result['license_key'])) {
            $this->licenseKey = $result['license_key'];
            $this->cache->setLicenseKey($result['license_key']);
        }
        $this->licenseData = $result['license'] ?? $result;
        if (isset($this->licenseData['valid']) && $this->licenseData['valid']) {
            $this->cache->setLicenseStatus($this->licenseData);
        }
        return $result;
    }

    public function bindDevice(?string $deviceName = null): array
    {
        if ($this->licenseKey === null) {
            throw new ApiException('No license key stored. Activate a license first.');
        }
        $result = $this->client->bindDevice(
            $this->licenseKey,
            $this->fingerprint['fingerprint'],
            $deviceName
        );
        if (isset($result['success']) && $result['success']) {
            $this->initialize();
        }
        return $result;
    }

    public function viewHardwareStatus(): array {
        $currentHw = $this->getHardwareId();
        $validateResult = $this->validate();
        $registeredHw = $validateResult['data']['hardware_id'] ?? '';
        return [
            'matched' => $currentHw === $registeredHw,
            'current_hardware_id' => $currentHw,
            'registered_hardware_id' => $registeredHw,
            'message' => 'Hardware replacement requires administrator approval. Please contact support.'
        ];
    }

    public function hasLicenseKey(): bool
    {
        return $this->licenseKey !== null;
    }

    public function isValid(): bool
    {
        if ($this->licenseData === null) {
            return false;
        }
        $status = $this->licenseData['status'] ?? '';
        if ($status !== 'active') {
            return false;
        }
        if (!empty($this->licenseData['expires_at'])) {
            try {
                $expiry = new \\DateTime($this->licenseData['expires_at']);
                if ($expiry < new \\DateTime()) {
                    return false;
                }
            } catch (\\Exception $e) {
                return false;
            }
        }
        return true;
    }

    public function getLicenseInfo(): ?array
    {
        return $this->licenseData;
    }

    public function getLicenseKey(): ?string
    {
        return $this->licenseKey;
    }

    public function getHardwareId(): string
    {
        return $this->fingerprint['fingerprint'];
    }
}

`,
    'composer.json': `{
  "name": "websmith/${safeName}-sdk",
  "description": "SDK for ${context.productName}",
  "version": "${context.kitVersion}",
  "type": "library",
  "require": {
    "php": ">=7.4",
    "ext-curl": "*",
    "ext-json": "*",
    "ext-mbstring": "*"
  },
  "autoload": {
    "psr-4": {
      "WebsmithSDK\\\\": "src/"
    }
  },
  "license": "MIT",
  "authors": [
    {
      "name": "Websmith",
      "email": "${context.supportEmail || 'support@websmithdigital.com'}"
    }
  ],
  "minimum-stability": "stable"
}`,
    'README.md': `# ${context.productName} SDK (PHP)

Official PHP SDK for integrating ${context.productName} license management.

## Requirements

- PHP 7.4 or higher
- ext-curl
- ext-json
- ext-mbstring

## Installation

### Via Composer

\`\`\`bash
composer require websmith/${safeName}-sdk
\`\`\`

### Manual

Place the SDK files in your project and configure autoloading:

\`\`\`json
{
  "autoload": {
    "psr-4": {
      "WebsmithSDK\\\\": "path/to/sdk/"
    }
  }
}
\`\`\`

## Configuration

Create \`config/api-config.json\` in your project root:

\`\`\`json
{
  "api": {
    "url": "${apiUrl}",
    "key": "your-api-key",
    "secret": "your-api-secret",
    "version": "v1"
  },
  "product": {
    "id": "${productId}",
    "name": "${context.productName}"
  },
  "license": {
    "cache_ttl_days": 0
  }
}
\`\`\`

Alternatively, set environment variables:

\`\`\`bash
export WEBSMITH_API_URL="your-api-url"
export WEBSMITH_API_KEY="your-api-key"
export WEBSMITH_API_SECRET="your-api-secret"
\`\`\`

## Quick Start

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;
use WebsmithSDK\\Client;

// Create engine (auto-loads config from config/api-config.json)
$engine = new LicenseEngine();

// Check if license is valid
if ($engine->isValid()) {
    echo "License is active!\\n";
    print_r($engine->getLicenseInfo());
} else {
    echo "No valid license found.\\n";
}
?>
\`\`\`

## Full Lifecycle Examples

### 1. Initialize the SDK

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

// Auto-loads config from __DIR__ . '/config/api-config.json'
$engine = new LicenseEngine();

// Check initialization status
$status = $engine->getLicenseInfo();
if ($status !== null) {
    echo "License status: " . ($status['status'] ?? 'unknown') . "\\n";
}
?>
\`\`\`

### 2. Start a Trial

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

$engine = new LicenseEngine();

$result = $engine->startTrial(
    'user@example.com',
    'John Doe',
    ['company_name' => 'Acme Inc.']
);

if (isset($result['success']) && $result['success']) {
    echo "Trial started successfully!\\n";
    print_r($result);
} else {
    echo "Failed: " . ($result['error'] ?? $result['message'] ?? 'Unknown error') . "\\n";
}
?>
\`\`\`

### 3. Check Trial Status

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

$engine = new LicenseEngine();
$status = $engine->checkTrial();

echo "Trial status: " . ($status['status'] ?? 'unknown') . "\\n";
if (isset($status['expires_at'])) {
    echo "Expires: " . $status['expires_at'] . "\\n";
}
?>
\`\`\`

### 4. Convert Trial to Full License

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

$engine = new LicenseEngine();

$result = $engine->convertTrial(
    'premium_plan',
    'John Doe',
    'user@example.com'
);

if (isset($result['license_key'])) {
    echo "License converted! Key: " . $result['license_key'] . "\\n";
}
?>
\`\`\`

### 5. Activate a License Key

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

$engine = new LicenseEngine();

$result = $engine->activate(
    'LICENSE-KEY-HERE',
    'My Workstation'
);

if ($engine->isValid()) {
    echo "License activated successfully!\\n";
    $info = $engine->getLicenseInfo();
    echo "Expires: " . ($info['expires_at'] ?? 'N/A') . "\\n";
}
?>
\`\`\`

### 6. Validate License

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

$engine = new LicenseEngine();

$result = $engine->validate('LICENSE-KEY-HERE');

if ($engine->isValid()) {
    echo "License is valid!\\n";
} else {
    echo "License is invalid or expired.\\n";
}
?>
\`\`\`

### 7. Check License Status (after activation)

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

$engine = new LicenseEngine();

if ($engine->hasLicenseKey()) {
    echo "License key: " . $engine->getLicenseKey() . "\\n";
}

if ($engine->isValid()) {
    echo "Status: Active\\n";
    print_r($engine->getLicenseInfo());
} else {
    echo "Status: Inactive / Unlicensed\\n";
}
?>
\`\`\`

### 8. Renew a License

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

$engine = new LicenseEngine();

// Must have an activated license
$result = $engine->renew(365); // renew for 365 days

if (isset($result['success']) && $result['success']) {
    echo "License renewed!\\n";
}
?>
\`\`\`

### 9. View Hardware Status

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

$engine = new LicenseEngine();

$status = $engine->viewHardwareStatus();

if ($status['matched']) {
    echo "Hardware ID matches the registered device.\\n";
} else {
    echo "Hardware has changed!\\n";
    echo $status['message'] . "\\n";
}
?>
\`\`\`

### 10. Bind Device

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

$engine = new LicenseEngine();

$result = $engine->bindDevice('Development Machine');

if (isset($result['success']) && $result['success']) {
    echo "Device bound successfully!\\n";
}
?>
\`\`\`

### 11. Deactivate License

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\LicenseEngine;

$engine = new LicenseEngine();

// Deactivate the currently stored license
$result = $engine->deactivate();

// Or deactivate a specific license
// $result = $engine->deactivate('LICENSE-KEY-HERE');

if (isset($result['success']) && $result['success']) {
    echo "License deactivated.\\n";
}
?>
\`\`\`

## API Client (Low-Level)

For direct API access without the engine:

\`\`\`php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\\Client;

$client = new Client();

// Validate license
$result = $client->validateLicense('LICENSE-KEY', 'hardware-id');

// Activate license
$result = $client->activateLicense('LICENSE-KEY', 'hardware-id', 'Device Name');

// Deactivate license
$result = $client->deactivateLicense('LICENSE-KEY', 'hardware-id');

// Start trial
$result = $client->startTrial('user@example.com', 'John Doe');

// Check trial status
$result = $client->checkTrial('hardware-id');

// Convert trial
$result = $client->convertTrial('hardware-id', 'plan_name', 'John Doe', 'user@example.com');

// Bind device
$result = $client->bindDevice('LICENSE-KEY', 'hardware-id', 'Device Name');

// View hardware status
$result = $client->viewHardwareStatus();
?>
\`\`\`

## Error Handling

\`\`\`php
<?php
use WebsmithSDK\\LicenseEngine;
use WebsmithSDK\\ApiException;

$engine = new LicenseEngine();

try {
    $result = $engine->activate('INVALID-KEY', 'My PC');
} catch (ApiException $e) {
    echo "API Error (" . $e->getCode() . "): " . $e->getMessage() . "\\n";
} catch (Exception $e) {
    echo "Unexpected error: " . $e->getMessage() . "\\n";
}
?>
\`\`\`

## Caching

The SDK caches license status locally to reduce API calls and enable offline validation:

- Cache location: \`~/.websmith/<productId>/cache.json\`
- Default TTL: 0 days (no caching by default; configurable via \`license.cache_ttl_days\` in config)
- Atomic writes with file locking (LOCK_EX)
- Automatically invalidated on activation/deactivation/renewal

## Hardware Fingerprinting

The SDK generates a unique hardware fingerprint using:

1. CPU architecture (\`php_uname('m')\`)
2. Hostname (\`php_uname('n')\`)
3. MAC addresses (\`/sys/class/net/*/address\` on Linux, \`getmac\` on Windows)
4. Combined and hashed with SHA-256

## HMAC Request Signing

All API requests are signed using HMAC-SHA256:

\`\`\`
Canonical String: {method}\\n{path}\\n{query}\\n{sha256(body)}\\n{timestamp}\\n{nonce}
Signature: base64(hmac-sha256(canonical, api_secret))
\`\`\`

Headers: \`X-API-Key\`, \`X-Timestamp\`, \`X-Nonce\`, \`X-Signature\`
`,
  };
}

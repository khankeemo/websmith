# ${product_name} SDK (PHP)

Official PHP SDK for integrating ${product_name} license management.

## Requirements

- PHP 7.4 or higher
- ext-curl
- ext-json
- ext-mbstring

## Installation

### Via Composer

```bash
composer require websmith/${package_name}-sdk
```

### Manual

Place the SDK files in your project and configure autoloading:

```json
{
  "autoload": {
    "psr-4": {
      "WebsmithSDK\\": "path/to/sdk/"
    }
  }
}
```

## Configuration

Create `config/api-config.json` in your project root:

```json
{
  "api": {
    "url": "${api_url}",
    "key": "your-api-key",
    "secret": "your-api-secret",
    "version": "v1"
  },
  "product": {
    "id": "${product_id}",
    "name": "${product_name}"
  },
  "license": {
    "cache_ttl_days": 0
  }
}
```

Alternatively, set environment variables:

```bash
export WEBSMITH_API_URL="your-api-url"
export WEBSMITH_API_KEY="your-api-key"
export WEBSMITH_API_SECRET="your-api-secret"
```

## Quick Start

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;
use WebsmithSDK\Client;

// Create engine (auto-loads config from config/api-config.json)
$engine = new LicenseEngine();

// Check if license is valid
if ($engine->isValid()) {
    echo "License is active!\n";
    print_r($engine->getLicenseInfo());
} else {
    echo "No valid license found.\n";
}
?>
```

## Full Lifecycle Examples

### 1. Initialize the SDK

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

// Auto-loads config from __DIR__ . '/config/api-config.json'
$engine = new LicenseEngine();

// Check initialization status
$status = $engine->getLicenseInfo();
if ($status !== null) {
    echo "License status: " . ($status['status'] ?? 'unknown') . "\n";
}
?>
```

### 2. Start a Trial

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

$engine = new LicenseEngine();

$result = $engine->startTrial(
    'user@example.com',
    'John Doe',
    ['company_name' => 'Acme Inc.']
);

if (isset($result['success']) && $result['success']) {
    echo "Trial started successfully!\n";
    print_r($result);
} else {
    echo "Failed: " . ($result['error'] ?? $result['message'] ?? 'Unknown error') . "\n";
}
?>
```

### 3. Check Trial Status

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

$engine = new LicenseEngine();
$status = $engine->checkTrial();

echo "Trial status: " . ($status['status'] ?? 'unknown') . "\n";
if (isset($status['expires_at'])) {
    echo "Expires: " . $status['expires_at'] . "\n";
}
?>
```

### 4. Convert Trial to Full License

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

$engine = new LicenseEngine();

$result = $engine->convertTrial(
    'premium_plan',
    'John Doe',
    'user@example.com'
);

if (isset($result['license_key'])) {
    echo "License converted! Key: " . $result['license_key'] . "\n";
}
?>
```

### 5. Activate a License Key

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

$engine = new LicenseEngine();

$result = $engine->activate(
    'LICENSE-KEY-HERE',
    'My Workstation'
);

if ($engine->isValid()) {
    echo "License activated successfully!\n";
    $info = $engine->getLicenseInfo();
    echo "Expires: " . ($info['expires_at'] ?? 'N/A') . "\n";
}
?>
```

### 6. Validate License

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

$engine = new LicenseEngine();

$result = $engine->validate('LICENSE-KEY-HERE');

if ($engine->isValid()) {
    echo "License is valid!\n";
} else {
    echo "License is invalid or expired.\n";
}
?>
```

### 7. Check License Status (after activation)

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

$engine = new LicenseEngine();

if ($engine->hasLicenseKey()) {
    echo "License key: " . $engine->getLicenseKey() . "\n";
}

if ($engine->isValid()) {
    echo "Status: Active\n";
    print_r($engine->getLicenseInfo());
} else {
    echo "Status: Inactive / Unlicensed\n";
}
?>
```

### 8. Renew a License

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

$engine = new LicenseEngine();

// Must have an activated license
$result = $engine->renew(365); // renew for 365 days

if (isset($result['success']) && $result['success']) {
    echo "License renewed!\n";
}
?>
```

### 9. View Hardware Status

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

$engine = new LicenseEngine();

$status = $engine->viewHardwareStatus();

if ($status['matched']) {
    echo "Hardware ID matches the registered device.\n";
} else {
    echo "Hardware has changed!\n";
    echo $status['message'] . "\n";
}
?>
```

### 10. Bind Device

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

$engine = new LicenseEngine();

$result = $engine->bindDevice('Development Machine');

if (isset($result['success']) && $result['success']) {
    echo "Device bound successfully!\n";
}
?>
```

### 11. Deactivate License

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\LicenseEngine;

$engine = new LicenseEngine();

// Deactivate the currently stored license
$result = $engine->deactivate();

// Or deactivate a specific license
// $result = $engine->deactivate('LICENSE-KEY-HERE');

if (isset($result['success']) && $result['success']) {
    echo "License deactivated.\n";
}
?>
```

## API Client (Low-Level)

For direct API access without the engine:

```php
<?php
require_once 'vendor/autoload.php';

use WebsmithSDK\Client;

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
```

## Error Handling

```php
<?php
use WebsmithSDK\LicenseEngine;
use WebsmithSDK\ApiException;

$engine = new LicenseEngine();

try {
    $result = $engine->activate('INVALID-KEY', 'My PC');
} catch (ApiException $e) {
    echo "API Error (" . $e->getCode() . "): " . $e->getMessage() . "\n";
} catch (Exception $e) {
    echo "Unexpected error: " . $e->getMessage() . "\n";
}
?>
```

## Caching

The SDK caches license status locally to reduce API calls and enable offline validation:

- Cache location: `~/.websmith/<productId>/cache.json`
- Default TTL: 0 days (no caching by default; configurable via `license.cache_ttl_days` in config)
- Atomic writes with file locking (LOCK_EX)
- Automatically invalidated on activation/deactivation/renewal

## Hardware Fingerprinting

The SDK generates a unique hardware fingerprint using:

1. CPU architecture (`php_uname('m')`)
2. Hostname (`php_uname('n')`)
3. MAC addresses (`/sys/class/net/*/address` on Linux, `getmac` on Windows)
4. Combined and hashed with SHA-256

## HMAC Request Signing

All API requests are signed using HMAC-SHA256:

```
Canonical String: {method}\n{path}\n{query}\n{sha256(body)}\n{timestamp}\n{nonce}
Signature: base64(hmac-sha256(canonical, api_secret))
```

Headers: `X-API-Key`, `X-Timestamp`, `X-Nonce`, `X-Signature`

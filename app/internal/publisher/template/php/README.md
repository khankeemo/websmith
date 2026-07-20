# ${product_name} SDK (PHP)

Official PHP SDK for integrating ${product_name} license management.

## Requirements

- PHP 7.4 or higher
- ext-curl
- ext-json
- ext-mbstring
- ext-openssl

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
      "WSD\\SDK\\": "path/to/sdk/"
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
    "public_key": "your-public-api-key",
    "secret": "your-api-secret",
    "version": "v1",
    "timeout": 30000,
    "retry_count": 3
  },
  "product": {
    "id": "${product_id}",
    "name": "${product_name}"
  },
  "trial": {
    "enabled": true,
    "days": ${trial_days}
  },
  "offline": {
    "cache_days": ${offline_days}
  },
  "branding": {
    "company_name": "${company_name}",
    "support_email": "support@websmithdigital.com"
  }
}
```

## Quick Start

```php
<?php
require_once 'vendor/autoload.php';

use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
$status = $engine->initialize();

if ($status->valid) {
    echo "License is active!\n";
} else {
    echo "Status: {$status->status}\n";
}
?>
```

## Full Lifecycle Examples

### 1. Initialize

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
$status = $engine->initialize();
echo "Status: {$status->status}\n";
?>
```

### 2. Start Trial

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
$result = $engine->startTrial('user@example.com', 'John Doe', ['company_name' => 'Acme Inc.']);
if (!empty($result['success'])) {
    echo "Trial started!\n";
}
?>
```

### 3. Check Trial Status

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
$result = $engine->getClient()->getTrialStatus();
echo "Trial status: " . ($result['data']['status'] ?? 'unknown') . "\n";
?>
```

### 4. Convert Trial to License

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
$result = $engine->convertTrial(plan: 'premium', customerName: 'John Doe', customerEmail: 'user@example.com');
if (!empty($result['success'])) {
    echo "License key: " . $result['license_key'] . "\n";
}
?>
```

### 5. Activate License

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
$result = $engine->activate('LICENSE-KEY-HERE');
if (!empty($result['success'])) {
    echo "License activated!\n";
}
?>
```

### 6. Validate License

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
$result = $engine->validate('LICENSE-KEY-HERE');
if ($engine->isValid()) {
    echo "License is valid!\n";
}
?>
```

### 7. Check Status

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
$engine->initialize();
if ($engine->hasLicenseKey()) {
    echo "License key: " . $engine->getLicenseKey() . "\n";
}
$status = $engine->getStatus();
if ($status !== null && $status->valid) {
    echo "Status: Active\n";
}
?>
```

### 8. Renew License

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
// Must have an activated license
$result = $engine->renew(365);
if (!empty($result['success'])) {
    echo "License renewed!\n";
}
?>
```

### 9. Replace Hardware

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
try {
    $result = $engine->replaceHardware();
    echo "Hardware replaced!\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
```

### 10. Bind Device

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
$result = $engine->bindDevice(deviceName: 'Development Machine');
if (!empty($result['success'])) {
    echo "Device bound!\n";
}
?>
```

### 11. Deactivate License

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\LicenseEngine;

$engine = new LicenseEngine();
$result = $engine->deactivate();
if (!empty($result['success'])) {
    echo "License deactivated.\n";
}
?>
```

### 12. Welcome Dialog

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\WelcomeDialog;

$dialog = new WelcomeDialog();
if (!$dialog->isOnboardingComplete()) {
    $result = $dialog->show();
}
?>
```

### 13. Activation Dialog

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\ActivationDialog;

$dialog = new ActivationDialog();
$result = $dialog->show();
if (!empty($result['activated'])) {
    echo "License activated!\n";
}
?>
```

## API Client (Low-Level)

```php
<?php
require_once 'vendor/autoload.php';
use WSD\SDK\ApiClient;

$config = json_decode(file_get_contents('config/api-config.json'), true);
$client = new ApiClient($config);

$result = $client->validateLicense('LICENSE-KEY', 'hardware-id');
$result = $client->activateLicense('LICENSE-KEY', 'hardware-id');
$result = $client->startTrial('user@example.com', 'John Doe');
?>
```

## Error Handling

```php
<?php
use WSD\SDK\LicenseEngine;
use WSD\SDK\ApiError;

$engine = new LicenseEngine();
try {
    $engine->activate('INVALID-KEY');
} catch (ApiError $e) {
    echo "API Error ({$e->getStatusCode()}): {$e->getMessage()}\n";
} catch (\Exception $e) {
    echo "Error: {$e->getMessage()}\n";
}
?>
```

## Caching

Cache location: `sys_get_temp_dir()/.websmith/<productId>/cache.json`
Default TTL: ${offline_days} days (0 = no caching)
Atomic writes with file locking (LOCK_EX)

## Hardware Fingerprinting

SHA-256 hash of CPU → Motherboard → MAC fallback:
1. CPU ID (wmic/sysctl/proc/cpuinfo)
2. Motherboard serial (wmic/dmidecode)
3. MAC addresses (/sys/class/net/getmac)
4. OS info

## HMAC Request Signing

All API requests signed with HMAC-SHA256:

```
Canonical: {method}\n{path}\n{query}\n{sha256(body)}\n{timestamp}\n{nonce}
Signature: base64(hmac-sha256(canonical, secret))
```

Headers: `X-API-Key`, `X-Timestamp`, `X-Nonce`, `X-Signature`

## License

Copyright (c) ${year} ${product_name}

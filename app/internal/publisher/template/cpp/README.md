# ${product_name} — C++ SDK

## Overview

The C++ SDK provides header-only integration with the ${product_name} licensing API. Uses `curl`, `nlohmann/json`, and OpenSSL for HMAC-SHA256 signing.

## Requirements

- CMake >= 3.14
- C++17 compiler (std::filesystem, std::random_device)
- libcurl (development headers)
- nlohmann-json (development headers)
- OpenSSL (development headers)

## Quick Start

```cmake
cmake_minimum_required(VERSION 3.14)
project(MyApp)
find_package(websmith_sdk REQUIRED)
add_executable(myapp main.cpp)
target_link_libraries(myapp websmith_sdk)
```

## Configuration

Create `config/api-config.json`:

```json
{
  "api_url": "${api_url}",
  "timeout": 30,
  "retries": 3,
  "cache_ttl": 0,
  "product_id": "${product_id}"
}
```

## Usage

### Initialize SDK

```cpp
#include <websmith/client.hpp>
using namespace websmith;

json config = loadConfig("config/api-config.json");
LicenseEngine engine("YOUR_API_KEY", "YOUR_API_SECRET", config);
engine.initialize();
```

### Start a Trial

```cpp
auto result = engine.startTrial("user@example.com", "John Doe");
if (result.contains("license")) {
    std::cout << "Trial started\n";
}
```

### Convert Trial to License

```cpp
auto result = engine.convertTrial("pro", "John Doe", "user@example.com");
if (result.contains("license")) {
    std::cout << "License activated!\n";
}
```

### Activate License

```cpp
auto result = engine.activate("LICENSE-KEY-HERE", "My Workstation");
```

### Validate License

```cpp
if (engine.isValid()) {
    std::cout << "License is valid\n";
} else {
    std::cout << "License is invalid or expired\n";
}
```

### Renew License

```cpp
auto result = engine.renew("LICENSE-KEY-HERE");
```

### View Hardware Status

```cpp
auto result = engine.viewHardwareStatus();
if (result["matched"]) {
    std::cout << "Hardware matches\n";
} else {
    std::cout << result["message"] << "\n";
}
```

### Bind Device

```cpp
auto result = engine.bindDevice("LICENSE-KEY-HERE", "My Laptop");
```

### Deactivate License

```cpp
auto result = engine.deactivate("LICENSE-KEY-HERE");
```

### Get License Info

```cpp
json info = engine.getLicenseInfo();
std::cout << "Status: " << info.value("status", "none") << "\n";
std::cout << "Expires: " << info.value("expires_at", "N/A") << "\n";
```

### License Status
```cpp
bool valid = engine.isValid();
std::cout << "License status: " << (valid ? "VALID" : "INVALID/EXPIRED") << "\n";
        break;
    }
    case 4: {
        if (engine.hasLicenseKey()) {
            json cached = engine.getLicenseInfo();
            engine.deactivate(cached.value("key", ""));
        }
        break;
    }
}
```

## API Reference

### LicenseEngine

| Method | Description |
|--------|-------------|
| `initialize()` | Load cached license data |
| `validate(key)` | Validate license with server |
| `activate(key, deviceName)` | Activate license on this device |
| `deactivate(key)` | Deactivate license |
| `renew(key)` | Renew license |
| `startTrial(email, name, data)` | Start a trial |
| `checkTrial()` | Check trial status |
| `convertTrial(plan, name, email)` | Convert trial to paid license |
| `viewHardwareStatus()` | Check if hardware matches registered device |
| `bindDevice(key, deviceName)` | Bind license to current device |
| `hasLicenseKey()` | Check if a license key is cached |
| `isValid()` | Check if current license is active |
| `getLicenseInfo()` | Get cached license data |

### Client

| Method | Description |
|--------|-------------|
| `validateLicense(key, deviceId)` | Validate license |
| `activateLicense(key, deviceId, name)` | Activate license |
| `deactivateLicense(key, deviceId)` | Deactivate license |
| `renewLicense(key, deviceId)` | Renew license |
| `startTrial(email, name, data)` | Start trial |
| `checkTrial(hardwareId)` | Check trial status |
| `convertTrial(hardwareId, plan, name, email)` | Convert trial |
| `bindDevice(key, deviceId, name)` | Bind device |

### CacheManager

| Method | Description |
|--------|-------------|
| `has(key)` | Check if cache entry exists and is fresh |
| `get(key)` | Retrieve cached JSON |
| `set(key, data)` | Store JSON atomically |
| `remove(key)` | Delete cache entry |
| `clear()` | Clear all cached data |

## HMAC Signing

All API requests are signed with HMAC-SHA256. The signature is computed over `timestamp + nonce + body` using the API secret. Headers:

- `X-API-Key` — your public API key
- `X-Timestamp` — current time in milliseconds
- `X-Nonce` — random hex string (64-bit)
- `X-Signature` — HMAC-SHA256 hex digest

## Error Handling

```cpp
try {
    auto result = engine.activate(key, name);
} catch (const ApiException& e) {
    std::cerr << "API error " << e.statusCode() << ": " << e.what() << "\n";
} catch (const std::exception& e) {
    std::cerr << "Error: " << e.what() << "\n";
}
```

## Environment Variables

- `WEBSMITH_API_URL` — override API base URL (default: config file or built-in)
- `HOME` / `USERPROFILE` — used for cache directory (`~/.websmith/<productId>/`)

## Support

Contact ${support_email} for assistance.

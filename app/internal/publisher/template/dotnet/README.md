# ${product_name} — .NET SDK

## Overview

The .NET SDK provides a production-ready client for the ${product_name} licensing API.
It includes HMAC-SHA256 request signing, automatic retry with exponential backoff,
hardware fingerprinting, cache management, and a full license engine.

## Requirements

- .NET 8.0 SDK or later
- `System.Management` package (included)

## Installation

Add the SDK to your project:

```xml
<ProjectReference Include="path/to/websmith-sdk.csproj" />
```

Or add to your solution:
```
dotnet add reference path/to/websmith-sdk.csproj
```

## Configuration

Place `config/api-config.json` in your application root:

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

```csharp
using WebsmithSDK;

var engine = new LicenseEngine();
var status = engine.Initialize();
Console.WriteLine($"Status: {status.Status}");
if (status.Valid)
    Console.WriteLine("License is active!");
```

## Full Lifecycle

### 1. Initialize
```csharp
var engine = new LicenseEngine();
var status = engine.Initialize();
```

### 2. Start Trial
```csharp
var customerData = new Dictionary<string, object> { ["company_name"] = "Acme Inc." };
var result = await engine.StartTrial("user@example.com", "John Doe", customerData);
```

### 3. Check Trial Status
```csharp
var result = await engine.GetClient().GetTrialStatus(engine.GetHardwareId());
```

### 4. Convert Trial to License
```csharp
var result = await engine.ConvertTrial("premium", "John Doe", "user@example.com");
```

### 5. Validate License
```csharp
var result = await engine.Validate("LICENSE-KEY");
bool valid = engine.IsValid();
```

### 6. Activate License
```csharp
var result = await engine.Activate("LICENSE-KEY");
```

### 7. Renew License
```csharp
var result = await engine.Renew(365);
```

### 8. Replace Hardware
```csharp
var result = await engine.ReplaceHardware();
```

### 9. Bind Device
```csharp
var result = await engine.BindDevice("LICENSE-KEY", "My Laptop");
```

### 10. Deactivate License
```csharp
var result = await engine.Deactivate("LICENSE-KEY");
```

### 11. Welcome Dialog
```csharp
var dialog = new WelcomeDialog(client, "${product_name}", true);
if (!dialog.IsOnboardingComplete())
    dialog.Show();
```

### 12. Activation Dialog
```csharp
var dialog = new ActivationDialog(client);
var result = dialog.Show();
if (result.Activated)
    Console.WriteLine("License activated!");
```

## API Endpoints
- `POST /api/v1/license` - License management (validate, activate, deactivate, renew)
- `POST /api/v1/trial` - Trial management (start, status, convert)
- `POST /api/v1/device` - Device management (bind, replace)
- `GET /api/v1/store/products` - List available products

## HMAC Signing
All API requests signed with HMAC-SHA256:
- `X-API-Key` — Your public API key
- `X-Timestamp` — ISO 8601 UTC timestamp
- `X-Nonce` — Unique request identifier (hex)
- `X-Signature` — HMAC-SHA256 of the canonical request

Canonical string format:
```
METHOD\nPATH\nQUERY\nBODY_HASH\nTIMESTAMP\nNONCE
```

## Caching
Cache location: `~/.websmith/<productId>/cache.json`
Default TTL: ${offline_days} days (0 = no caching by default)
Atomic writes with temp file + rename

## Hardware Fingerprinting
SHA-256 hash of:
1. CPU core count + architecture + ID
2. Motherboard serial (WMI on Windows, dmidecode on Linux)
3. MAC addresses of active network interfaces
4. OS version/description

## License

Copyright (c) ${year} ${product_name}

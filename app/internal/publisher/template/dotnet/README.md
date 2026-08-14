# ${product_name} — .NET SDK

## Overview

The .NET SDK provides a production-ready client for the Websmith licensing API.
It includes HMAC-SHA256 request signing, automatic retry with exponential backoff,
hardware fingerprinting, cache management, and a full license engine.

## Installation

1. Add the SDK to your project:

```xml
<ProjectReference Include="path/to/websmith-sdk.csproj" />
```

2. Place `config/api-config.json` in your application root:

```json
{
  "apiKey": "your_api_key",
  "secret": "your_hmac_secret",
  "productId": "${product_id}"
}
```

## Usage

### Initialize

```csharp
using System.IO;
using System.Text.Json;
using WebsmithSDK;

var config = JsonSerializer.Deserialize<JsonElement>(
    File.ReadAllText("config/api-config.json"));

var apiKey = config.GetProperty("apiKey").GetString()!;
var secret = config.GetProperty("secret").GetString()!;
var productId = config.GetProperty("productId").GetString()!;

var client = new Client(apiKey, secret);
var engine = new LicenseEngine(client, productId);
engine.Initialize();
```

### Start Trial

```csharp
var trialResult = await engine.StartTrial("user@example.com", "John Doe");
```

### Check Trial Status

```csharp
var status = await engine.CheckTrial();
```

### Convert Trial to License

```csharp
var result = await engine.ConvertTrial("premium", "John Doe", "user@example.com");
```

### Activate License

```csharp
var result = await engine.Activate("LICENSE-KEY-HERE", "My Workstation");
```

### Validate License

```csharp
if (engine.HasLicenseKey())
{
    var result = await engine.Validate();
    if (engine.IsValid())
        Console.WriteLine("License is valid!");
}
```

### Renew License

```csharp
var result = await engine.Renew();
```

### View Hardware Status

```csharp
var status = engine.ViewHardwareStatus();
Console.WriteLine($"Hardware matched: {status["matched"]}");
Console.WriteLine(status["message"]);
```

### Bind Device

```csharp
var fp = HardwareFingerprint.Generate();
var hardwareId = fp["fingerprint"].ToString();
var result = await engine.BindDevice("LICENSE-KEY", hardwareId, "Laptop-2");
```

### Deactivate License

```csharp
var result = await engine.Deactivate();
```

### Get License Info

```csharp
var info = engine.GetLicenseInfo();
Console.WriteLine(info.GetProperty("status").GetString());
```

## Configuration

| Environment Variable | Description |
|---------------------|-------------|
| `WEBSMITH_API_URL` | Base URL for the Websmith API |

Configuration is loaded from `config/api-config.json` at the application root.

## Cache

The SDK caches license data to `~/.websmith/<productId>/` with a configurable TTL.
Cache entries are written atomically (temp file + rename).

## HMAC-SHA256 Signing

All API requests are signed with HMAC-SHA256 using:
- `X-API-Key` — Your API key
- `X-Timestamp` — Current Unix timestamp
- `X-Nonce` — Unique request identifier
- `X-Signature` — HMAC-SHA256 of `timestamp + nonce + body_hash`

## Error Handling

The SDK throws `ApiException` on non-success HTTP responses with the status code
and response body. Transient errors are automatically retried up to 3 times with
exponential backoff (1s, 2s, 4s).

## Hardware Fingerprint

The fingerprint is a SHA-256 hash of:
1. CPU core count + architecture
2. Motherboard info (WMI on Windows)
3. MAC addresses of active interfaces
4. OS version

# ${product_name} SDK (Deno)

## Version
${kit_version}

## Overview
Production-ready Deno SDK for ${product_name} license management.
Features HMAC-SHA256 signing, automatic retry with backoff, hardware fingerprinting,
offline cache, and a full lifecycle API.

## Installation
Copy the `client.ts` and `deno.json` files into your Deno project.

## Quick Start
```typescript
import { Client, LicenseEngine, HardwareFingerprint } from './client.ts';

// Load config and create engine
const engine = new LicenseEngine();

// Initialize — checks cache first, falls back to API
const status = await engine.initialize();
console.log('Status:', status.status);
console.log('Valid:', engine.isValid());
```

## Full Lifecycle

### Initialize
```typescript
const engine = new LicenseEngine();
const status = await engine.initialize();
if (status.valid) {
  console.log('License active until:', status.expiresAt);
}
```

### Activate License
```typescript
const result = await engine.activate('LICENSE_KEY', 'My Device');
if (result.success) console.log('Activated!');
```

### Start Trial
```typescript
const result = await engine.startTrial('user@example.com', 'John Doe');
if (result.success) console.log('Trial started!');
```

### Check Trial Status
```typescript
const status = await engine.checkTrial();
console.log('Trial days remaining:', status.days_left);
```

### Convert Trial to License
```typescript
const result = await engine.convertTrial('pro-plan');
if (result.success) {
  console.log('License key:', result.license_key);
}
```

### Validate License
```typescript
const result = await engine.validate('LICENSE_KEY');
console.log('Valid:', engine.isValid());
```

### Renew License
```typescript
const result = await engine.renew(); // +30 days (default)
const result = await engine.renew(90); // +90 days
```

### Deactivate License
```typescript
const result = await engine.deactivate();
```

### View Hardware Status
```typescript
const status = await engine.viewHardwareStatus();
console.log('Hardware match:', status.matched);
```

### Bind Device
```typescript
const result = await engine.bindDevice('LICENSE_KEY', 'Workstation');
```

### Check License State
```typescript
if (engine.hasLicenseKey()) {
  console.log('License key present');
}
console.log('Is valid:', engine.isValid());
console.log('Full info:', engine.getLicenseInfo());
```

## Configuration
Place `config/api-config.json` adjacent to your script:
```json
{
  "api": {
    "url": "${api_url}",
    "version": "v1",
    "public_key": "your_public_key",
    "secret": "your_api_secret",
    "timeout": 30000,
    "retry_count": 3
  },
  "product": {
    "id": "your-product-id",
    "name": "${product_name}"
  },
  "offline": {
    "cache_days": 0
  }
}
```

You can also pass a custom config path:
```typescript
const engine = new LicenseEngine('./path/to/api-config.json');
```

## Hardware Fingerprinting
The SDK generates a SHA-256 fingerprint from:
- MAC addresses of non-internal network interfaces (up to 3)
- Deno.build.os + Deno.osRelease()
- Hostname (when available)

```typescript
const hw = new HardwareFingerprint();
const fp = await hw.generate();
console.log('Fingerprint:', fp.fingerprint);
console.log('MACs:', fp.macAddresses);
console.log('OS:', fp.os);
```

## HMAC-SHA256 Signing
All API requests are signed using HMAC-SHA256 with:
- `x-api-key` — Public key identifying the client
- `x-timestamp` — ISO 8601 UTC timestamp
- `x-nonce` — Cryptographically random 32-char hex string
- `x-signature` — `Base64(HMAC-SHA256(message, secret))`
  where `message = method + "\n" + path + "\n" + query + "\n" + bodyHash + "\n" + timestamp + "\n" + nonce`

## Retry with Backoff
The client retries on:
- `429` Rate limit — waits `Retry-After` header seconds
- `5xx` Server errors — exponential backoff: 2s, 4s, 6s
- Timeouts and connection errors — exponential backoff: 2s, 4s, 6s

All configurable via `api.retry_count` in config (default: 3).

## Offline Cache
License status is cached locally at `~/.websmith/<product-id>/cache.json`
with atomic writes (write to `.tmp`, rename to `.json`).
Corrupt cache files are preserved as `.corrupt` for debugging.
TTL is configurable via `offline.cache_days` (default: 0).

## Permissions
Run with:
```bash
deno run --allow-net --allow-env --allow-sys --allow-read --allow-write --allow-run client.ts
```

## Error Handling
```typescript
import { ApiError } from './client.ts';

try {
  await engine.activate('INVALID_KEY');
} catch (err) {
  if (err instanceof ApiError) {
    console.error('API Error:', err.statusCode, err.message);
  } else {
    console.error('Error:', err);
  }
}
```

## Direct API Client Usage
```typescript
import { Client, CacheManager, HardwareFingerprint } from './client.ts';

const config = JSON.parse(Deno.readTextFileSync('./config/api-config.json'));
const cache = new CacheManager(config);
const hw = new HardwareFingerprint();
const client = new Client(config, hw, cache);

const result = await client.validateLicense();
console.log(result);
```

## API Endpoints
- `POST /api/v1/license` — License management (validate, activate, deactivate, renew)
- `POST /api/v1/trial` — Trial management (start, status, convert)
- `POST /api/v1/device` — Device management (bind)

## License
Generated by Websmith License API Center
Copyright (c) ${year}

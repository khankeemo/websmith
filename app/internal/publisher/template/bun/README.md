# ${product_name} SDK (Bun)

Full-featured Bun SDK for license validation, trial management, hardware binding, and device activation.

## Installation

```bash
bun add ${package_name}
```

Or copy `client.js` directly into your project.

## Configuration

Create `config/api-config.json`:

```json
{
  "apiKey": "your_api_key",
  "apiUrl": "${api_url}",
  "cacheDir": "./cache",
  "cacheTtl": 0
}
```

All fields are optional. The API URL falls back to `process.env['WEBSMITH_API_URL']` then the build-time URL.

## Lifecycle

### Initialize

```javascript
import { LicenseEngine } from './client.js';

const engine = new LicenseEngine();
const { apiKey, baseUrl } = await engine.initialize();
console.log('SDK ready:', baseUrl);
```

### Start Trial

```javascript
const result = await engine.startTrial('user@example.com', 'Jane Doe');
console.log('Trial started:', result);
```

### Check Trial

```javascript
const status = await engine.checkTrial();
console.log('Trial status:', status);
```

### Convert Trial

```javascript
const result = await engine.convertTrial('premium', 'Jane Doe', 'user@example.com');
console.log('Converted:', result);
```

### Activate License

```javascript
const result = await engine.activate('LICENSE-KEY-HERE', 'My Machine');
console.log('Activated:', result);
```

### Validate License

```javascript
const result = await engine.validate('LICENSE-KEY-HERE');
console.log('Valid:', engine.isValid());
```

### Renew License

```javascript
const result = await engine.renew('LICENSE-KEY-HERE');
console.log('Renewed:', result);
```

### View Hardware Status

```javascript
const result = await engine.viewHardwareStatus();
console.log('Hardware matched:', result.matched);
```

### Bind Device

```javascript
const result = await engine.bindDevice('LICENSE-KEY-HERE', 'Work Laptop');
console.log('Device bound:', result);
```

### Deactivate License

```javascript
const result = await engine.deactivate('LICENSE-KEY-HERE');
console.log('Deactivated:', result);
```

### Check License Status

```javascript
engine.hasLicenseKey();   // true / false
engine.isValid();         // true / false
engine.getLicenseInfo();  // { license_key, status, expires_at, ... }
```

## Low-Level Client

```javascript
import { Client, ApiError } from './client.js';

const client = new Client('your_api_key');
const res = await client.validateLicense('LICENSE-KEY', 'hardware-id');
```

All requests are HMAC-SHA256 signed and retried with exponential backoff (3 retries).

## Hardware Fingerprint

```javascript
import { HardwareFingerprint } from './client.js';

const fp = await HardwareFingerprint.generate();
console.log(fp.fingerprint); // SHA-256 of cpu|motherboard|macs|platform|release
```

## Cache

```javascript
import { CacheManager } from './client.js';

const cache = new CacheManager('./cache', 0);
await cache.set('license', { status: 'active' });
const data = await cache.get('license');
```

Writes are atomic (temp file + rename).

## Error Handling

```javascript
import { Client, ApiError } from './client.js';

const client = new Client('key');
try {
  await client.validateLicense('bad-key', 'hwid');
} catch (err) {
  if (err instanceof ApiError) {
    console.error(err.status, err.body);
  }
}
```

## License

MIT — ${product_name}

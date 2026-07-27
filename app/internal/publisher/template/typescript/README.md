# {{PRODUCT_NAME}} SDK
## {{SDK_VERSION}}

## Installation

```bash
npm install {{PACKAGE_NAME}}
```

## Quick Start

```typescript
import { LicenseEngine } from '{{PACKAGE_NAME}}';

const engine = new LicenseEngine();
const status = await engine.initialize();

if (status.valid) {
  console.log(`License ${status.status} — ${status.days_remaining} day(s) remaining`);
} else {
  console.log(`Status: ${status.status} — ${status.message}`);
  // Activate: await engine.activate("LICENSE_KEY")
  // Trial:    await engine.startTrial("user@example.com")
}
```

## License

Copyright (c) {{YEAR}} {{COMPANY_NAME}}

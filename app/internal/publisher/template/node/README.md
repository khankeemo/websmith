# ${product_name} SDK
## ${kit_version}

## Installation

```bash
npm install ${package_name}
```

## Quick Start

```javascript
const { LicenseEngine } = require('${package_name}');

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

Copyright (c) ${year} ${company_name}

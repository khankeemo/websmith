# ${product_name} SDK
## ${kit_version}

## Installation

```bash
pip install ${package_name}
```

## Quick Start

```python
from ${package_name} import LicenseEngine, LicenseStatus

engine = LicenseEngine()
status = engine.initialize()

if status.valid:
    print(f"License {status.status} — {status.days_remaining} day(s) remaining")
else:
    print(f"Status: {status.status} — {status.message}")
    # Activate: engine.activate("LICENSE_KEY")
    # Trial:    engine.start_trial(email="user@example.com")
```

## License

Copyright (c) ${year} ${product_name}

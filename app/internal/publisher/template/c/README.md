# ${product_name} SDK
## ${kit_version}

## Requirements

- C11 compatible compiler (gcc, clang, MSVC)
- OpenSSL (libssl, libcrypto)
- libcurl
- GNU Make or compatible

## Building

```bash
make
```

Or with custom flags:

```bash
make CC=gcc CFLAGS="-std=c11 -O2 -I/usr/local/include" LDFLAGS="-L/usr/local/lib -lssl -lcrypto -lcurl"
```

## Quick Start

```c
#include "license_engine.h"
#include <stdio.h>

int main() {
    LicenseEngine* engine = wsd_engine_new("config/api-config.json");
    LicenseStatus* status = wsd_initialize(engine);

    if (status && status->valid) {
        printf("License %s - %d day(s) remaining\n",
               status->status, status->days_remaining);
    } else {
        printf("Status: %s - %s\n",
               status ? status->status : "error",
               status ? status->message : "unknown");
    }

    wsd_engine_free(engine);
    return 0;
}
```

## API

All functions return a JsonMap* with at minimum a "success" field.
Free returned maps with wsd_json_free().

## License

Copyright (c) ${year} ${product_name}

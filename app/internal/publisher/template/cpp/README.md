# ${product_name} SDK
## ${kit_version}

## Requirements

- C++17 compatible compiler
- CMake 3.14+
- OpenSSL (libssl, libcrypto)
- libcurl
- nlohmann/json (optional, built-in JSON parser used otherwise)

## Building

```bash
mkdir build && cd build
cmake ..
cmake --build .
```

## Quick Start

```cpp
#include "license_engine.h"
#include <iostream>

int main() {
    LicenseEngine engine("config/api-config.json");
    LicenseStatus status = engine.initialize();

    if (status.valid) {
        std::cout << "License " << status.status
                  << " - " << status.days_remaining << " day(s) remaining"
                  << std::endl;
    } else {
        std::cout << "Status: " << status.status
                  << " - " << status.message << std::endl;
    }
    return 0;
}
```

## License

Copyright (c) ${year} ${product_name}

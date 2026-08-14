# ${product_name} SDK (Go)

## Version
${kit_version}

## Package Structure

```
${module_slug}-sdk/
  config/
    api-config.json        # Generated API configuration
  client.go                # HTTP client with HMAC-SHA256 signing
  hardware.go              # Hardware fingerprint generation
  cache.go                 # File-based cache with atomic writes
  license.go               # License engine (orchestrates all operations)
  go.mod                   # Module definition
  go.sum                   # Dependency checksums (generated)
```

## Configuration

The SDK loads configuration from `config/api-config.json` or falls back to the
`WEBSMITH_API_URL` environment variable. The config file is generated during
publishing and includes your API endpoints, keys, and product settings.

```json
{
  "api": {
    "url": "${api_url}",
    "version": "v1",
    "public_key": "your_api_key",
    "secret": "your_api_secret",
    "timeout": 30000
  },
  "product": {
    "id": "prod_xxx",
    "name": "${product_name}"
  }
}
```

## Initialization

```go
package main

import (
	"fmt"
	"log"

	"github.com/websmith/${module_slug}-sdk"
)

func main() {
	engine, err := websmith.NewLicenseEngine("config/api-config.json")
	if err != nil {
		log.Fatalf("Failed to initialize: %v", err)
	}
	if err := engine.Initialize(); err != nil {
		log.Fatalf("Failed to initialize engine: %v", err)
	}
	fmt.Println("SDK initialized successfully")
}
```

## Trial Lifecycle

### Start a Trial

```go
func startTrial(engine *websmith.LicenseEngine) {
	data := map[string]interface{}{
		"product_id": "prod_xxx",
		"source":     "cli",
	}
	result, err := engine.StartTrial("user@example.com", "John Doe", data)
	if err != nil {
		log.Fatalf("Trial start failed: %v", err)
	}
	fmt.Printf("Trial started: %v\n", result)
}
```

### Check Trial Status

```go
func checkTrial(engine *websmith.LicenseEngine) {
	result, err := engine.CheckTrial()
	if err != nil {
		log.Fatalf("Trial check failed: %v", err)
	}
	fmt.Printf("Trial status: %v\n", result)
}
```

### Convert Trial to License

```go
func convertTrial(engine *websmith.LicenseEngine) {
	result, err := engine.ConvertTrial("premium", "John Doe", "user@example.com")
	if err != nil {
		log.Fatalf("Trial conversion failed: %v", err)
	}
	fmt.Printf("Trial converted: %v\n", result)
}
```

## License Operations

### Activate a License

```go
func activateLicense(engine *websmith.LicenseEngine) {
	result, err := engine.Activate("LICENSE-KEY-HERE", "My Workstation")
	if err != nil {
		log.Fatalf("Activation failed: %v", err)
	}
	fmt.Printf("License activated: %v\n", result)
	fmt.Printf("Is valid: %v\n", engine.IsValid())
}
```

### Validate a License

```go
func validateLicense(engine *websmith.LicenseEngine) {
	result, err := engine.Validate("LICENSE-KEY-HERE")
	if err != nil {
		log.Fatalf("Validation failed: %v", err)
	}
	fmt.Printf("License data: %v\n", result)
	fmt.Printf("Has license key: %v\n", engine.HasLicenseKey())
	fmt.Printf("License info: %v\n", engine.GetLicenseInfo())
}
```

### Renew a License

```go
func renewLicense(engine *websmith.LicenseEngine) {
	result, err := engine.Renew("LICENSE-KEY-HERE")
	if err != nil {
		log.Fatalf("Renewal failed: %v", err)
	}
	fmt.Printf("License renewed: %v\n", result)
}
```

### Bind a Device

```go
func bindDevice(engine *websmith.LicenseEngine) {
	result, err := engine.BindDevice("LICENSE-KEY-HERE", "Secondary Laptop")
	if err != nil {
		log.Fatalf("Device binding failed: %v", err)
	}
	fmt.Printf("Device bound: %v\n", result)
}
```

### View Hardware Status

```go
func viewHardwareStatus(client *websmith.ApiClient) {
	currentHw := websmith.GetHardwareId()
	validateResult, _ := client.Validate("YOUR_LICENSE_KEY")
	validateData := validateResult["data"].(map[string]interface{})
	registeredHw, _ := validateData["hardware_id"].(string)
	matched := currentHw == registeredHw
	fmt.Printf("Hardware matched: %v\n", matched)
	fmt.Printf("Current: %s, Registered: %s\n", currentHw, registeredHw)
	fmt.Println("Hardware replacement requires administrator approval. Please contact support.")
}
```

### Deactivate a License

```go
func deactivateLicense(engine *websmith.LicenseEngine) {
	result, err := engine.Deactivate("LICENSE-KEY-HERE")
	if err != nil {
		log.Fatalf("Deactivation failed: %v", err)
	}
	fmt.Printf("License deactivated: %v\n", result)
}
```

## Complete Example

```go
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/websmith/${module_slug}-sdk"
)

var licenseKey = os.Getenv("LICENSE_KEY")

func main() {
	engine, err := websmith.NewLicenseEngine("config/api-config.json")
	if err != nil {
		log.Fatalf("Failed to initialize: %v", err)
	}

	// Activate if license key is provided
	if licenseKey != "" {
		result, err := engine.Activate(licenseKey, "primary")
		if err != nil {
			log.Fatalf("Activation failed: %v", err)
		}
		fmt.Printf("Activated: %v\n", result)
	}

	// Validate
	if engine.HasLicenseKey() {
		_, err := engine.Validate(licenseKey)
		if err != nil {
			log.Printf("Validation error: %v", err)
		}
		fmt.Printf("License valid: %v\n", engine.IsValid())
		fmt.Printf("License info: %v\n", engine.GetLicenseInfo())
	}
}
```

## API Endpoints

- `POST /api/v1/license` — License management (validate, activate, deactivate, renew, bind_device)
- `POST /api/v1/trial` — Trial management (start, status, convert)
- `POST /api/v1/countries` — Country codes
- `POST /api/v1/status` — API health check

## License

Generated by Websmith License API Center  
Copyright (c) ${year}

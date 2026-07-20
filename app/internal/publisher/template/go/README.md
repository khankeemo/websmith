# ${product_name} SDK (Go)

## Version
${kit_version}

## Package Structure
```
${package_name}/
├── config/
│   └── api-config.json        # API configuration
├── assets/
│   ├── badge.svg              # Status badge icon
│   └── logo.svg               # Product logo
├── widgets/
│   ├── entry.go               # Widget type definitions
│   ├── activation_button.go   # Activation button widget
│   ├── dashboard_widget.go    # Dashboard display widget
│   ├── settings_widget.go     # Settings panel widget
│   └── status_widget.go       # Status indicator widget
├── wsd.go                     # Core types and config loading
├── activation.go              # Activation dialog
├── cache.go                   # File-based cache with atomic writes
├── client.go                  # HTTP client with HMAC-SHA256 signing
├── crypto.go                  # HMAC-SHA256 signing utilities
├── device_replace.go          # Device replacement dialog
├── hardware.go                # Hardware fingerprint generation
├── license_engine.go          # License engine (orchestrates all operations)
├── renewal.go                 # License renewal dialog
├── welcome.go                 # Interactive welcome dialog
├── go.mod                     # Module definition
├── go.sum                     # Dependency checksums (generated)
└── manifest.json              # SDK manifest
```

## Configuration

The SDK loads configuration from `config/api-config.json` or falls back to the
`WEBSMITH_API_URL` environment variable.

```json
{
  "api": {
    "url": "${api_url}",
    "version": "v1",
    "public_key": "${api_public_key}",
    "secret": "${api_secret}",
    "timeout": 30000
  },
  "product": {
    "id": "${product_id}",
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

    "${modulePath}"
)

func main() {
    engine, err := wsd.NewLicenseEngine("config/api-config.json")
    if err != nil {
        log.Fatalf("Failed to initialize: %v", err)
    }
    status := engine.Initialize()
    fmt.Printf("Status: %s, Valid: %v\n", status.Status, status.Valid)
}
```

## Trial Lifecycle

### Start a Trial

```go
func startTrial(engine *wsd.LicenseEngine) {
    customerData := map[string]interface{}{
        "source": "cli",
    }
    result, err := engine.StartTrial("user@example.com", "John Doe", customerData)
    if err != nil {
        log.Fatalf("Trial start failed: %v", err)
    }
    fmt.Printf("Trial started: %v\n", result)
}
```

### Check Trial Status

```go
func checkTrial(engine *wsd.LicenseEngine) {
    status := engine.Initialize()
    if status != nil {
        fmt.Printf("Trial status: %s, days left: %d\n", status.Status, status.DaysRemaining)
    }
}
```

### Convert Trial to License

```go
func convertTrial(engine *wsd.LicenseEngine) {
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
func activateLicense(engine *wsd.LicenseEngine) {
    result, err := engine.Activate("LICENSE-KEY-HERE")
    if err != nil {
        log.Fatalf("Activation failed: %v", err)
    }
    fmt.Printf("License activated: %v\n", result)
    fmt.Printf("Has license key: %v\n", engine.HasLicenseKey())
}
```

### Validate a License

```go
func validateLicense(engine *wsd.LicenseEngine) {
    result, err := engine.Validate("LICENSE-KEY-HERE")
    if err != nil {
        log.Fatalf("Validation failed: %v", err)
    }
    fmt.Printf("License data: %v\n", result)
}
```

### Renew a License

```go
func renewLicense(engine *wsd.LicenseEngine) {
    result, err := engine.Renew()
    if err != nil {
        log.Fatalf("Renewal failed: %v", err)
    }
    fmt.Printf("License renewed: %v\n", result)
}
```

### Replace Hardware

```go
func replaceHardware(engine *wsd.LicenseEngine) {
    result, err := engine.ReplaceHardware()
    if err != nil {
        log.Fatalf("Hardware replacement failed: %v", err)
    }
    fmt.Printf("Hardware replaced: %v\n", result)
}
```

### Bind a Device

```go
func bindDevice(engine *wsd.LicenseEngine) {
    result, err := engine.BindDevice("LICENSE-KEY-HERE", "Workstation-1")
    if err != nil {
        log.Fatalf("Device binding failed: %v", err)
    }
    fmt.Printf("Device bound: %v\n", result)
}
```

### Deactivate a License

```go
func deactivateLicense(engine *wsd.LicenseEngine) {
    result, err := engine.Deactivate("LICENSE-KEY-HERE")
    if err != nil {
        log.Fatalf("Deactivation failed: %v", err)
    }
    fmt.Printf("License deactivated: %v\n", result)
}
```

## Welcome Dialog

```go
func showWelcome(engine *wsd.LicenseEngine) {
    dialog := wsd.NewWelcomeDialog(engine, "${product_name}")
    result := dialog.Show()
    fmt.Printf("Welcome result: %v\n", result)
}
```

## Activation Dialog

```go
func showActivation(engine *wsd.LicenseEngine) {
    dialog := wsd.NewActivationDialog(engine, "${product_name}")
    result := dialog.Show()
    if activated, ok := result["activated"].(bool); ok && activated {
        fmt.Println("License activated successfully!")
    }
}
```

## Widgets

```go
import (
    "github.com/websmith/sdk"
    "github.com/websmith/sdk/widgets"
)

func useWidgets(engine *wsd.LicenseEngine) {
    dashboard := widgets.NewDashboard(engine)
    fmt.Print(dashboard.Render())

    status := widgets.NewStatus(engine)
    fmt.Println(status.GetStatusLine())
}
```

## HMAC Request Signing

All API requests are signed using HMAC-SHA256:

1. Generate ISO 8601 UTC timestamp and random nonce
2. Compute SHA-256 of JSON body
3. Build message: `{method}\n{path}\n{query}\n{body_hash}\n{timestamp}\n{nonce}`
4. Compute HMAC-SHA256 with `api_secret`
5. Send headers: `X-API-KEY`, `X-TIMESTAMP`, `X-NONCE`, `X-SIGNATURE`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/license` | License management (validate, activate, deactivate, renew) |
| `POST /api/v1/trial` | Trial management (start, status, convert) |
| `POST /api/v1/device` | Device management (bind, replace) |
| `POST /api/v1/customer/register` | Customer registration |
| `GET  /api/v1/store/products` | Product listing |

## License

Generated by Websmith License API Center
Copyright (c) ${year}

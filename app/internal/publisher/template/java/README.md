# ${product_name} SDK (Java)

## Version
${kit_version}

## Requirements
- Java 11+
- Apache Maven 3.6+
- Gson 2.10.1 (included via Maven)

## Installation

### Via Maven
Add the following dependency to your `pom.xml`:
```xml
<dependency>
  <groupId>com.websmith</groupId>
  <artifactId>${package_name}-sdk</artifactId>
  <version>${kit_version}</version>
</dependency>
```

### Manual
Compile the source files with Gson on your classpath:
```
javac -cp gson-2.10.1.jar *.java -d out
```

## Configuration
Create `config/api-config.json` in your working directory:
```json
{
  "api": {
    "public_key": "YOUR_PUBLIC_API_KEY",
    "secret": "YOUR_API_SECRET",
    "url": "${api_url}",
    "version": "v1",
    "timeout": 30000,
    "retry_count": 3
  },
  "product": {
    "id": "${product_id}",
    "name": "${product_name}"
  },
  "trial": {
    "enabled": true,
    "days": ${trial_days}
  },
  "offline": {
    "cache_days": ${offline_days}
  },
  "branding": {
    "company_name": "${company_name}",
    "support_email": "support@websmithdigital.com"
  }
}
```

## Quick Start
```java
import com.websmith.sdk.LicenseEngine;
import com.websmith.sdk.LicenseEngine.LicenseStatus;

public class Main {
    public static void main(String[] args) {
        LicenseEngine engine = new LicenseEngine();
        LicenseStatus status = engine.initialize();
        System.out.println("Status: " + status.status);
        if (status.valid) {
            System.out.println("License is active!");
        }
    }
}
```

## Full Lifecycle

### 1. Initialize
```java
LicenseEngine engine = new LicenseEngine();
LicenseStatus status = engine.initialize();
```

### 2. Start Trial
```java
com.google.gson.JsonObject data = new com.google.gson.JsonObject();
data.addProperty("company_name", "Acme Inc.");
engine.startTrial("user@example.com", "John Doe", data);
```

### 3. Check Trial Status
```java
engine.getClient().getTrialStatus(engine.getHardwareId());
```

### 4. Convert Trial to License
```java
engine.convertTrial("premium", "John Doe", "user@example.com");
```

### 5. Validate License
```java
engine.validate("LICENSE_KEY");
boolean valid = engine.isValid();
```

### 6. Activate License
```java
engine.activate("LICENSE_KEY");
```

### 7. Renew License
```java
engine.renew(365);
```

### 8. Replace Hardware
```java
engine.replaceHardware();
```

### 9. Bind Device
```java
engine.bindDevice("LICENSE_KEY", "My Laptop");
```

### 10. Deactivate License
```java
engine.deactivate("LICENSE_KEY");
```

### 11. Welcome Dialog
```java
ApiClient client = new ApiClient();
WelcomeDialog dialog = new WelcomeDialog(client, "${product_name}", true);
if (!dialog.isOnboardingComplete()) {
    dialog.show();
}
```

### 12. Activation Dialog
```java
ActivationDialog dialog = new ActivationDialog(client);
ActivationDialog.ActivationDialogResult result = dialog.show();
if (result.activated) {
    System.out.println("License activated!");
}
```

## API Endpoints
- `POST /api/v1/license` - License management (validate, activate, deactivate, renew)
- `POST /api/v1/trial` - Trial management (start, status, convert)
- `POST /api/v1/device` - Device management (bind, replace)
- `GET /api/v1/store/products` - List available products

## HMAC Signing
All API requests signed using HMAC-SHA256:
- `X-API-Key` - Public API key
- `X-Timestamp` - ISO 8601 UTC timestamp
- `X-Nonce` - UUID v4 nonce
- `X-Signature` - Base64-encoded HMAC-SHA256 signature

Canonical string format:
```
METHOD\nPATH\nQUERY\nBODY_HASH\nTIMESTAMP\nNONCE
```

## License

Copyright (c) ${year} ${product_name}

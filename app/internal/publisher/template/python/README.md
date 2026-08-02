# Websmith Digital Python SDK Template

## Overview

This is the Python SDK template for the Universal License Platform. It contains all necessary components for license management, authentication, and customer workflows. This template is part of the broader Websmith Digital SDK ecosystem and follows the platform's architecture and implementation standards.

## Folder Structure

The Python SDK template includes the following mandatory modules:

### Core SDK Components
- `__init__.py` - Package initialization and exports
- `activation.py` - License activation workflow
- `cache.py` - Local cache management
- `client.py` - API client with HMAC authentication
- `communication.py` - Universal conversation engine
- `config.py` - Configuration loading
- `crypto.py` - Cryptographic utilities
- `hardware.py` - Hardware detection and fingerprinting
- `license_engine.py` - License validation and management engine
- `live_log.py` - Event logging utilities
- `notifications.py` - System notifications
- `reactivation.py` - License reactivation workflow
- `renewal.py` - License renewal workflow
- `sales.py` - Sales enquiry workflow
- `single_instance.py` - Process locking
- `support.py` - Support request workflow
- `trial.py` - Trial management workflow
- `universal_email_dialog.py` - Universal email dialog component
- `universal_license_center.py` - Main license center UI
- `universal_restart_dialog.py` - Application restart dialog
- `universal_success_dialog.py` - Success operation dialog
- `validation.py` - Input validation utilities
- `welcome.py` - Onboarding workflow

### Supporting Components
- `assets/` - Brand assets and logos
- `config/` - API configuration files
- `docs/` - Documentation and implementation guides

## Runtime Components

The SDK provides the following key runtime components:

### License Engine
The central component for license initialization, validation, and state management. Handles activation, renewal, trial management, and all license-related operations through a unified interface.

**Key Features:**
- License validation and verification
- Hardware fingerprint detection and binding
- Trial management (creation, conversion, expiry)
- State management and caching
- Decision engine for license status determination

### Hardware Detector
Detects and fingerprints system hardware for license binding. Collects CPU, motherboard, and OS information to ensure secure hardware-based license validation.

**Key Features:**
- System hardware identification
- Fingerprint generation
- License binding validation
- Hardware replacement tracking

### API Client
Secure HTTP client with HMAC authentication for all backend communications. Manages API keys, request signing, rate limiting, and error handling for all platform interactions.

**Key Features:**
- HMAC request signing
- Rate limiting
- Error handling and retries
- API key management
- Connection management

### Cache Manager
Local persistence layer for offline support and message queuing. Stores license status, hardware IDs, and queued communications with TTL-based expiration.

**Key Features:**
- Offline support
- Message queuing
- State persistence
- TTL-based expiration
- Cache invalidation

### Universal License Center (ULC)
The primary customer-facing interface for license management. Provides dashboard, license status display, workflow buttons, and integrates with all backend services.

**Key Features:**
- Customer dashboard
- License status display
- Workflow automation
- Email integration
- Notification system

### Universal Email Dialog (UED)
The single email component for all request categories (support, sales, activation, renewal, etc.). Automatically populates customer information, handles attachments, and supports rich text editing.

**Key Features:**
- Auto-population: Customer name, email, product, plan, license key, hardware ID
- Attachments: Supports SDK ZIP, images, PDF, other files (max 5, 10MB each)
- Rich Text Editor: Subject, formatted message with character counter
- Universal Validation: Email format, required fields, file size limits
- Universal Application: Support, sales, activation, renewal, reactivation, general request workflows

## Activation Flow

The activation workflow follows a structured process:

1. **License Key Entry** - Customer enters license key
2. **Validation** - System validates key format and existence
3. **OTP Verification** - Sends OTP to registered email
4. **OTP Entry** - Customer enters received OTP
5. **Hardware Validation** - Checks license against hardware fingerprint
6. **Activation** - Activates license on validated hardware
7. **Success Dialog** - Displays success with restart option

**API Endpoints:**
- `POST /api/v1/license-engine/activate` - License activation
- `POST /api/v1/license-engine/validate` - License validation

## Trial Flow

The trial management process includes:

1. **Registration** - Customer provides name, email, mobile
2. **OTP Verification** - Email confirmation
3. **Trial Creation** - Generates trial license
4. **Hardware Binding** - Associates trial with device
5. **Access** - Customer gains trial access
6. **Auto-convert** - Automatic trial-to-paid conversion (if configured)

**API Endpoints:**
- `POST /api/v1/license-engine/start-trial` - Trial creation
- `POST /api/v1/license-engine/convert-trial` - Trial conversion

## Renewal Flow

License renewal involves:

1. **Renewal Request** - Customer initiates renewal
2. **Plan Selection** - Choose renewal plan and duration
3. **Validation** - Verifies license eligibility
4. **Payment Processing** - Handles payment for renewal
5. **License Update** - Updates license with new terms
6. **Success Notification** - Confirms renewal completion

**API Endpoints:**
- `POST /api/v1/license-engine/renew` - License renewal
- `POST /api/v1/license-engine/send-renewal-request` - Renewal request

## Reactivation Flow

Device replacement or reactivation:

1. **Reactivation Request** - Customer requests license transfer
2. **Hardware Validation** - Verifies old and new hardware
3. **Approval Process** - Reviews and approves reactivation
4. **License Update** - Binds license to new hardware
5. **Notification** - Informs customer of reactivation status

**API Endpoints:**
- `POST /api/v1/license-engine/send-reactivation-request` - Reactivation request
- `POST /api/v1/license-engine/reactivate` - Reactivation

## UniversalEmailDialog

The UniversalEmailDialog provides a consistent email interface for all customer communications:

**Core Features:**
- **Auto-population**: Customer name, email, product, plan, license key, hardware ID
- **Attachments**: SDK ZIP, images, PDF, other files (max 5, 10MB each)
- **Rich Text Editor**: Subject, formatted message with character counter
- **Validation**: Email format, required fields, file size limits
- **Universal Application**: Support, sales, activation, renewal, reactivation, general request workflows

**Request Categories:**
- Support
- Sales
- General Request
- Activation Request
- Renewal Request
- Reactivation Request
- License Request

## License Validation

License validation includes:

**Key Validation:**
- License key format validation
- License existence verification
- License status checking (active, expired, deactivated)

**Hardware Validation:**
- Hardware fingerprint matching
- Device binding verification
- License ownership confirmation

**Expiry Validation:**
- Expiry date verification
- License term validation
- Renewal eligibility check

**Device Validation:**
- Device count limits enforcement
- Hardware binding validation
- Concurrent device management

## API Endpoints

### Internal API (admin-only)

- `POST /internal/backend/communication/send` - Send emails with attachments
- `GET /internal/backend/admin/communication/history` - Email conversation history
- `GET /internal/backend/admin/sdk/latest-job` - SDK job information

### Public API (customer-facing)

- `GET /api/v1/checkout/config` - Checkout configuration
- `POST /api/v1/checkout` - Create pending order
- `POST /api/v1/checkout/pay` - Process payment
- `GET /api/v1/checkout/orders?email=` - Customer order history
- `POST /api/v1/license-engine/activate` - License activation
- `POST /api/v1/license-engine/validate` - License validation
- `POST /api/v1/license-engine/start-trial` - Trial creation
- `POST /api/v1/license-engine/renew` - License renewal
- `POST /api/v1/license-engine/send-renewal-request` - Renewal request
- `POST /api/v1/license-engine/send-reactivation-request` - Reactivation request

## Configuration

Configuration is loaded from `api-config.json`:

**Product Configuration:**
- Product details (ID, name, description)
- API settings (URL, version, timeout)
- Store configuration (software store URL)
- Trial settings (enabled, duration, requirements)

**License Configuration:**
- License settings (hardware binding, max devices)
- Branding (colors, company name, emails)
- UI settings (theme, language, position)

**Feature Configuration:**
- Feature flags (trial, license, hardware_binding, etc.)

**Configuration Loading:**
- Load from local file or environment variables
- Override with per-product settings
- Validate configuration before use

## Developer Integration

### Quick Start

1. Copy generated SDK zip to your project
2. Configure `api-config.json` with your product details
3. Initialize LicenseEngine with config path
4. Create UniversalLicenseCenter instance
5. Call `show()` to display license center
6. Implement business logic for license operations

### Key Components to Import

```python
from .license_engine import LicenseEngine
from .universal_license_center import UniversalLicenseCenter
from .activation import activate_license
from .renewal import renew_license
from .trial import start_trial
```

### Example Usage

```python
# Initialize engine
engine = LicenseEngine(config_path="path/to/api-config.json")

# Create license center
ulc = UniversalLicenseCenter(config_path="path/to/api-config.json")

# Show license center
result = ulc.show()
if result.get('action') == 'launch':
    # Application unlocked, launch main application
    launch_application()
```

### SDK Structure

The Python SDK provides the following key components:

**License Management:**
- LicenseEngine: Core license validation and management
- HardwareDetector: Hardware fingerprint and binding
- CacheManager: Local persistence and state management

**Customer Interface:**
1. UniversalLicenseCenter: Main customer interface
2. UniversalEmailDialog: Email communication
3. UniversalSuccessDialog: Success notifications
4. UniversalRestartDialog: Application restart

**Workflow Components:**
- activation: License activation
- renewal: License renewal
- trial: Trial management
- reactivation: License reactivation
- sales: Sales enquiries
- support: Support requests
- communication: Universal conversation engine
- notifications: System notifications

## Packaging Notes

### Generated SDK Structure

The SDK is packaged as a ZIP file containing:

- All Python source files
- Configuration examples
- Documentation
- Sample projects
- License files
- README.md (this file)

### Validation Process

Before generation, the SDK undergoes comprehensive validation:

1. **File Existence Check**: All mandatory modules present
2. **Syntax Validation**: Python syntax checked
3. **Import Verification**: All imports resolve correctly
4. **Export Validation**: Module exports are correct
5. **Placeholder Replacement**: All placeholders replaced with configuration values
6. **Hardcoded Value Check**: No hardcoded company names, URLs, or email addresses
7. **Duplicate Detection**: No duplicate business logic

### Version Synchronization

All versions must remain synchronized:

- SDK Version
- Product Version
- Runtime Version
- Generated SDK Version

Any version mismatch causes generation to fail.

## Technical Notes

### Architecture

The Python SDK follows the platform architecture:

- **Master Implementation Document**: Source of truth for architecture
- **Language Templates**: Implementation source of truth
- **SDK Publisher**: Generation, validation, packaging
- **Generated SDK**: Customer output only

### Dependencies

The SDK depends on:

- **Standard Library**: datetime, json, os, sys, platform, tkinter, etc.
- **Third-Party**: None (pure Python implementation)

### Testing

Generated SDK undergoes language-specific validation:

- **Python**: Syntax check and import verification
- **Type checking**: Optional, based on project configuration
- **Runtime testing**: Module imports and basic functionality

### Error Handling

All errors follow the standard error handling rules:

- **User-friendly messages**: No technical details exposed
- **Specific error codes**: Machine-readable error codes
- **Graceful degradation**: Non-critical failures don't stop operations
- **Logging**: All errors logged appropriately

## Support

For issues with the SDK template:

1. Check the generated SDK logs for detailed error information
2. Review the Master Implementation Document for architectural details
3. Verify all configuration values are correctly set
4. Ensure the api-config.json file is properly formatted
5. Contact Websmith Digital support for assistance

## License

See LICENSE file for licensing information.

## Copyright

© 2026 Websmith Digital. All rights reserved.

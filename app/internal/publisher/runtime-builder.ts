/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/internal/publisher/runtime-builder.ts
 * Purpose: Generates package files directly (no fs.cp)
 * Author: Websmith
 *
 * OPTIMIZATION:
 * - Replaced fs.cp() with direct file generation
 * - Reduces I/O operations on Vercel serverless
 * - Prevents hanging on network storage
 * ---------------------------------------------------------
 */

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { PublisherContext } from './index';
import { ApiConfig } from './config-builder';
import { RuntimeInfo } from './runtime-selector';
import { getRuntimeTemplates } from './runtimes/index';

export interface RuntimeBuildOptions {
  context: PublisherContext;
  apiConfig: ApiConfig;
  runtime: RuntimeInfo;
}



// ============================================================
// DOCS TEMPLATES
// ============================================================

const DOCS_TEMPLATES: Record<string, string> = {
  'README.md': `# WSD SDK — PRODUCT_NAME

## What Is WSD SDK?

WSD SDK is a complete plug-and-play license system. Copy the folder, add a dashboard widget, add an activation button, and run your application.

No additional licensing code is required.

## Folder Structure

\`\`\`
WSD_SDK_PROJECTNAME_PRODUCTID/

├── __init__.py
├── client.py
├── cache.py
├── crypto.py
├── hardware.py
├── license_engine.py
├── welcome.py
├── activation.py
├── renewal.py
├── device_replace.py
├── manifest.json

├── widgets/
│   ├── dashboard_widget.py
│   ├── settings_widget.py
│   ├── status_widget.py
│   └── activation_button.py

├── config/
│   └── api-config.json

├── assets/
│   ├── logo.svg
│   └── badge.svg

└── docs/
    ├── README.md
    ├── QUICK_START.md
    ├── DEVELOPER_INTEGRATION_GUIDE.md
    ├── LICENSE_UI.md
    ├── API_REFERENCE.md
    ├── SECURITY.md
    ├── ARCHITECTURE.md
    └── TROUBLESHOOTING.md
\`\`\`

## 3-Minute Integration

\`\`\`python
from WSD_SDK_PROJECTNAME_PRODUCTID.license_engine import LicenseEngine
from WSD_SDK_PROJECTNAME_PRODUCTID.widgets.dashboard_widget import LicenseWidget
from WSD_SDK_PROJECTNAME_PRODUCTID.widgets.activation_button import ActivationButton

engine = LicenseEngine()
LicenseWidget(parent).build()
ActivationButton(parent, engine).build()
engine.initialize()
\`\`\`

## Dashboard

Import:

\`\`\`python
from WSD_SDK_PROJECTNAME_PRODUCTID.widgets.dashboard_widget import LicenseWidget
\`\`\`

Place in top-right corner.

## Settings

Import:

\`\`\`python
from WSD_SDK_PROJECTNAME_PRODUCTID.widgets.settings_widget import SettingsWidget
\`\`\`

Place under: \`Settings > License\`

## Detailed Documentation

| Document | Purpose |
|----------|---------|
| \`QUICK_START.md\` | 5-step integration |
| \`DEVELOPER_INTEGRATION_GUIDE.md\` | Full architecture & integration |
| \`LICENSE_UI.md\` | UI components reference |
| \`API_REFERENCE.md\` | All SDK methods & fields |
| \`SECURITY.md\` | Security rules & constraints |
| \`ARCHITECTURE.md\` | System architecture |
| \`TROUBLESHOOTING.md\` | Common issues & solutions |
`,
  'QUICK_START.md': `# Quick Start Guide

## 1. Copy SDK Folder

Copy \`WSD_SDK_PROJECTNAME_PRODUCTID/\` into your project.

## 2. Import License Engine

\`\`\`python
from WSD_SDK_PROJECTNAME_PRODUCTID.license_engine import LicenseEngine
from WSD_SDK_PROJECTNAME_PRODUCTID.widgets.dashboard_widget import LicenseWidget
from WSD_SDK_PROJECTNAME_PRODUCTID.widgets.activation_button import ActivationButton
from WSD_SDK_PROJECTNAME_PRODUCTID.widgets.settings_widget import SettingsWidget
\`\`\`

## 3. Add Dashboard Widget

\`\`\`python
widget = LicenseWidget(parent)
widget.build()
\`\`\`

Place in the top-right corner of your dashboard.

## 4. Add Activation Button

\`\`\`python
btn = ActivationButton(parent, engine)
btn.build()
\`\`\`

## 5. Add Settings Widget

\`\`\`python
settings = SettingsWidget(parent, engine)
settings.build()
\`\`\`

Place under: \`Settings > License\`

## 6. Run

\`\`\`bash
pip install requests
python main.py
\`\`\`

That is all. No additional licensing code is required.
`,
  'DEVELOPER_INTEGRATION_GUIDE.md': `# WSD Universal License Control System — Developer Integration Guide

## Purpose

The SDK is a complete plug-and-play license system. The host application must never implement OTP UI, activation forms, trial logic, hardware binding, renewal, device replacement, database access, or license validation.

The SDK owns everything.

## Architecture

\`\`\`
Application
├── main.py
├── dashboard.py
├── settings.py
├── sidebar.py
└── screens/
        │
        ▼
WSD_SDK_PROJECTNAME_PRODUCTID/
├── welcome.py
├── activation.py
├── renewal.py
├── device_replace.py
├── license_engine.py
├── client.py
├── hardware.py
├── cache.py
├── widgets/
│   ├── dashboard_widget.py
│   ├── settings_widget.py
│   ├── status_widget.py
│   └── activation_button.py
        │
        ▼
Websmith Internal API
        │
        ▼
PostgreSQL
\`\`\`

## Startup Workflow

Developers only do:

\`\`\`python
from WSD_SDK_PROJECTNAME_PRODUCTID.license_engine import LicenseEngine

engine = LicenseEngine()
status = engine.initialize()
\`\`\`

The SDK internally performs:

\`\`\`
Application start
        ↓
Load cache
        ↓
Check onboarding
        ↓
Check trial
        ↓
Check license
        ↓
Validate hardware
        ↓
Open application
\`\`\`

If any step fails, the application blocks.

## Welcome Dialog

**File:** \`welcome.py\`

**Purpose:** First-time onboarding for trial users.

**UI:**

\`\`\`
Name:      [_______________]
Email:     [_______________]
Mobile:    [_______________]
Country:   [_______________]
Company:   [_______________]

[Send OTP]
[Verify OTP]
\`\`\`

**API Flow:**

\`\`\`
POST /api/v1/auth/otp/send
        ↓
POST /api/v1/auth/otp/verify
        ↓
POST /api/v1/customer/register
        ↓
POST /api/v1/trial
\`\`\`

**Security Rule:** Closing the Welcome dialog must close the entire application.

**Important:** Developers must never open \`welcome.py\` manually. It is triggered automatically by \`engine.initialize()\` when no customer or trial exists.

## Dashboard Integration

**Placement:** Top-right corner of your dashboard.

\`\`\`
┌──────────────────────────────────────────┐
│ Dashboard                                │
│                                          │
│                         ┌─────────────┐  │
│                         │ License     │  │
│                         │ Active      │  │
│                         │ 7 days left │  │
│                         └─────────────┘  │
└──────────────────────────────────────────┘
\`\`\`

**Import:**

\`\`\`python
from WSD_SDK_PROJECTNAME_PRODUCTID.widgets.dashboard_widget import LicenseWidget
\`\`\`

**Usage:**

\`\`\`python
LicenseWidget(parent)
\`\`\`

**Contents:**
- Trial active / Licensed indicator
- Remaining days
- Expiry date
- Hardware status

**Auto-refresh:** Every 60 seconds.

## Settings Integration

**Placement:** \`Settings > License\`

\`\`\`
┌────────────────────────────┐
│ License                    │
├────────────────────────────┤
│ Product                    │
│ SDK Version                │
│ Runtime                    │
│ Hardware ID                │
│ Status                     │
│ Expiry                     │
│ Remaining Days             │
│                            │
│ [Activate]                 │
│ [Renew]                    │
│ [Replace Device]           │
│ [Refresh]                  │
│ [Open Welcome]             │
└────────────────────────────┘
\`\`\`

**Import:**

\`\`\`python
from WSD_SDK_PROJECTNAME_PRODUCTID.widgets.settings_widget import SettingsWidget
\`\`\`

## Activation Flow

**File:** \`activation.py\`

**Import:**

\`\`\`python
from WSD_SDK_PROJECTNAME_PRODUCTID.activation import ActivationDialog
\`\`\`

**Usage:**

\`\`\`python
ActivationDialog().show()
\`\`\`

**Workflow:**

\`\`\`
User opens activation dialog
        ↓
Generate hardware fingerprint
        ↓
Enable license textbox
        ↓
Enter license key
        ↓
Fetch license details
        ↓
Show:
  • Plan
  • Expiry
  • Devices
  • Remaining days
        ↓
Activate
        ↓
Bind hardware
        ↓
Refresh cache
\`\`\`

**UI:**

\`\`\`
┌──────────────────────────────────┐
│ Activate License                 │
├──────────────────────────────────┤
│ Product                          │
│ Version                          │
│                                  │
│ Hardware ID                      │
│ Device name                      │
│                                  │
│ License key                      │
│                                  │
│ Plan                             │
│ Expiry                           │
│ Devices                          │
│                                  │
│ [Activate]                       │
│ [Renew]                          │
│ [Replace Device]                 │
└──────────────────────────────────┘
\`\`\`

## Renewal

**File:** \`renewal.py\`

**APIs:**
- \`GET  /api/v1/plans\` — fetch available plans
- \`POST /api/v1/license/renew\` — renew license

**Rules:**
- SDK only displays plans and pricing.
- Backend owns pricing, plans, and business rules.

## Device Replacement

**File:** \`device_replace.py\`

**API:** \`POST /api/v1/license/replace-device\`

**Workflow:**

\`\`\`
Old hardware
        ↓
Generate new hardware
        ↓
Confirm replacement
        ↓
Refresh status
\`\`\`

## Widgets

| Widget | Import | Placement |
|--------|--------|-----------|
| \`LicenseWidget\` | \`widgets.dashboard_widget\` | Dashboard top-right |
| \`SettingsWidget\` | \`widgets.settings_widget\` | Settings > License |
| \`ActivationButton\` | \`widgets.activation_button\` | Any toolbar |
| \`StatusWidget\` | \`widgets.status_widget\` | Status bar |

## Backend APIs

### OTP
- \`POST /api/v1/auth/otp/send\`
- \`POST /api/v1/auth/otp/verify\`

### Trial
- \`POST /api/v1/trial\`
- \`POST /api/v1/trial/status\`

### Customer
- \`POST /api/v1/customer/register\`

### License
- \`POST /api/v1/license\`
- \`GET  /api/v1/license/details\`
- \`POST /api/v1/license/renew\`
- \`POST /api/v1/license/replace-device\`

### Plans
- \`GET /api/v1/plans\`

### Countries
- \`GET /api/v1/countries\`

### Status
- \`GET /api/v1/status\`

## Security Rules

The SDK must never:
- Access PostgreSQL directly
- Execute SQL
- Know table names
- Contain pricing
- Contain plan logic
- Bypass hardware validation

Everything flows through:

\`\`\`
SDK
    ↓
Websmith Internal API
    ↓
PostgreSQL
\`\`\`

## Integration Checklist

- [ ] Copy SDK folder into project
- [ ] Import dashboard widget
- [ ] Import activation dialog
- [ ] Add settings page
- [ ] Run application

No other licensing code should be required.
`,
  'LICENSE_UI.md': `# License UI Components

## Welcome Dialog

**File:** \`welcome.py\`

Handles trial onboarding on first launch.

**Fields:** Name, Email, Mobile, Country, Company

**Buttons:** Send OTP, Verify OTP

**Flow:**
1. Collect customer information
2. Send OTP to email
3. Verify OTP code
4. Register customer
5. Start trial automatically
6. Bind hardware automatically

**Security:** Closing the Welcome dialog closes the entire application.

## Activation Dialog

**File:** \`activation.py\`

Handles license key activation for purchased licenses.

**Displays:**
- Product name and version
- Hardware ID and device name
- License key text field
- Plan name, expiry date, remaining days, device count

**Buttons:** Activate, Renew, Replace Device

**Flow:**
1. Generate hardware fingerprint automatically
2. Enable license textbox (disabled until hardware is ready)
3. Enter license key
4. Fetch license details automatically
5. Click Activate
6. Hardware binds automatically
7. Cache refreshes

## Renewal Dialog

**File:** \`renewal.py\`

Handles license renewal.

**Displays:**
- Current plan and expiry
- Available plans from API

**API:**
- \`GET /api/v1/plans\`
- \`POST /api/v1/license/renew\`

## Device Replacement Dialog

**File:** \`device_replace.py\`

Handles transferring a license to another machine.

**Displays:**
- Old hardware ID
- New hardware ID (auto-generated)
- Device name field

**API:** \`POST /api/v1/license/replace-device\`

## Widgets

### LicenseWidget
- **File:** \`widgets/dashboard_widget.py\`
- **Placement:** Dashboard top-right corner
- **Contents:** License status, remaining days, expiry, hardware status
- **Auto-refresh:** Every 60 seconds

### SettingsWidget
- **File:** \`widgets/settings_widget.py\`
- **Placement:** Settings > License
- **Contents:** Full license details panel with action buttons

### StatusWidget
- **File:** \`widgets/status_widget.py\`
- **Placement:** Status bar
- **Contents:** Compact status indicator with colored icon

### ActivationButton
- **File:** \`widgets/activation_button.py\`
- **Placement:** Any toolbar
- **Contents:** One-click activation button

## Recommended UI Structure

\`\`\`
Settings
  └── License
       ├── Status
       ├── Product
       ├── SDK Version
       ├── Runtime
       ├── Hardware ID
       ├── Expiry
       ├── Remaining Days
       ├── [Activate]
       ├── [Renew]
       ├── [Replace Device]
       ├── [Refresh]
       └── [Open Welcome]
\`\`\`
`,
  'API_REFERENCE.md': `# API Reference

All endpoints are called through the \`ApiClient\` class. The SDK never queries the database directly.

## Authentication

Every request requires API Key + HMAC-SHA256 signature. The \`ApiClient\` handles all headers automatically.

## Client Methods

| Method | HTTP | API Endpoint | Description |
|--------|------|-------------|-------------|
| \`send_otp()\` | POST | \`/api/v1/auth/otp/send\` | Send OTP to email |
| \`verify_otp()\` | POST | \`/api/v1/auth/otp/verify\` | Verify OTP code |
| \`store_customer()\` | POST | \`/api/v1/customer/register\` | Register customer |
| \`start_trial()\` | POST | \`/api/v1/trial\` | Start trial |
| \`get_trial_status()\` | POST | \`/api/v1/trial\` | Check trial status (action: status) |
| \`convert_trial()\` | POST | \`/api/v1/trial\` | Convert trial to license |
| \`validate_license()\` | POST | \`/api/v1/license\` | Validate license |
| \`activate_license()\` | POST | \`/api/v1/license\` | Activate license |
| \`deactivate_license()\` | POST | \`/api/v1/license\` | Deactivate license |
| \`get_license_details()\` | POST | \`/api/v1/license/details\` | Get license info |
| \`get_license_history()\` | POST | \`/api/v1/license/history\` | Get license timeline |
| \`renew_license()\` | POST | \`/api/v1/license/renew\` | Renew license |
| \`replace_device()\` | POST | \`/api/v1/device\` | Replace device (action: replace) |
| \`bind_device()\` | POST | \`/api/v1/device\` | Bind device |
| \`reset_device()\` | POST | \`/api/v1/device\` | Reset device |
| \`get_plans()\` | GET | \`/api/v1/plans\` | List plans |
| \`get_countries()\` | GET | \`/api/v1/countries\` | List countries |
| \`get_status()\` | GET | \`/api/v1/status\` | API health status |
| \`get_notifications()\` | GET | \`/api/v1/notifications\` | User notifications |

## Engine Methods

| Method | Description |
|--------|-------------|
| \`initialize()\` | Check license/trial status (cache fallback) |
| \`get_status()\` | Get cached \`LicenseStatus\` object |
| \`activate(key)\` | Activate license with hardware binding |
| \`deactivate(key)\` | Deactivate license on current device |
| \`start_trial(email)\` | Start trial with OTP verification flow |
| \`check_trial()\` | Check trial status |
| \`convert_trial(plan)\` | Convert active trial to paid license |
| \`send_otp(email)\` | Send verification OTP |
| \`verify_otp(email, code)\` | Verify OTP code |
| \`store_customer(data)\` | Register customer details |
| \`get_license_details(key)\` | Fetch license details |
| \`get_license_history(key)\` | Fetch license audit timeline |
| \`renew(plan_id)\` | Renew license |
| \`replace_hardware()\` | Move license to current (new) hardware |
| \`bind_device(key)\` | Bind license to current device |
| \`get_plans()\` | Get available plans for product |
| \`get_countries()\` | Get country list |
| \`get_api_status()\` | Get API health |
| \`get_notifications()\` | Get user notifications |
| \`refresh()\` | Force re-initialize from API |
| \`clear_cache()\` | Clear local license cache |

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| \`INVALID_API_KEY\` | 401 | API key not found |
| \`RATE_LIMIT_EXCEEDED\` | 429 | Too many requests |
| \`PRODUCT_MISMATCH\` | 403 | Key belongs to different product |
| \`LICENSE_NOT_FOUND\` | 404 | License key doesn't exist |
| \`LICENSE_EXPIRED\` | 403 | License has expired |
| \`LICENSE_REVOKED\` | 403 | License revoked |
| \`MAX_DEVICES_EXCEEDED\` | 403 | Device limit reached |

## Security Rules

- The SDK **never** accesses PostgreSQL directly
- The SDK **never** executes SQL
- The SDK **never** knows database table names
- The SDK **never** contains pricing
- The SDK **never** contains plan logic

## LicenseStatus Fields

| Field | Type | Description |
|-------|------|-------------|
| \`valid\` | bool | License or trial is valid |
| \`status\` | str | Current status string |
| \`expires_at\` | str/None | Expiry date |
| \`days_remaining\` | int | Days until expiry |
| \`plan\` | str/None | Current plan name |
| \`plan_id\` | str/None | Current plan ID |
| \`hardware_id\` | str/None | Bound hardware ID |
| \`device_name\` | str/None | Bound device name |
| \`trial_active\` | bool | Trial in progress |
| \`license_active\` | bool | License active |
| \`max_devices\` | int | Max allowed devices |
| \`device_count\` | int | Current device count |
| \`license_key\` | str/None | Active license key |
| \`message\` | str | Human-readable status |
| \`product\` | str/None | Product name |
| \`product_version\` | str/None | Product version |
`,
  'SECURITY.md': `# Security Guide

## Core Principle

The SDK must never access the database. All data flows through the Websmith Internal API.

\`\`\`
SDK
    ↓
Websmith Internal API
    ↓
PostgreSQL
\`\`\`

## What the SDK Must Never Do

- Execute SQL
- Know database table names
- Access PostgreSQL directly
- Contain pricing or plan logic
- Store API secrets in plain text
- Bypass hardware validation
- Cache license keys permanently
- Expose OTP codes

## Startup Security Flow

\`\`\`
Application start
        ↓
Load cache
        ↓
Check onboarding
        ↓
Check trial
        ↓
Check license
        ↓
Validate hardware
        ↓
Allow access
\`\`\`

The application must block at any failed step.

## Hardware Security

- No hardware fingerprint → activation and trial buttons disabled
- Hardware mismatch → license invalid, application blocks
- Hardware fingerprint is generated locally and never stored on disk in plain text
- Device replacement requires API verification

## OTP Security

- OTP codes expire after 10 minutes
- OTP codes are single-use (verified = true prevents reuse)
- Wrong OTP codes are rejected with \`"Invalid OTP code"\`
- Already-used OTP codes return \`"OTP code already used"\`
- Rate limiting applies to both send and verify endpoints

## Trial Security

- One trial per email address
- Trial expiry is enforced server-side
- Closing the Welcome dialog must close the application
- Failed OTP verification blocks trial start

## License Security

- License validation requires internet connectivity
- Hardware binding is enforced on every validation
- Expired licenses are rejected server-side
- Revoked licenses are rejected server-side
- License key reuse across devices is prevented

## Cache Security

- Cache is stored locally for offline status display
- Cache must never contain secrets or raw API keys
- Cache corruption forces re-validation from server

## Enforcement

All security rules are enforced by the Websmith Internal API. The SDK is a client — it requests, the API enforces.
`,
  'ARCHITECTURE.md': `# Architecture

## System Overview

\`\`\`
┌─────────────────────────────────────────────────────┐
│ Developer Application                               │
│  ┌───────────────────────────────────────────────┐  │
│  │ WSD SDK                                       │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │ Welcome │ │Activation│ │Device Replace  │  │  │
│  │  │ Dialog  │ │ Dialog   │ │ Dialog        │  │  │
│  │  └─────────┘ └──────────┘ └───────────────┘  │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │Renewal  │ │ License  │ │  Widgets      │  │  │
│  │  │ Dialog  │ │ Engine   │ │  (4 widgets)  │  │  │
│  │  └─────────┘ └──────────┘ └───────────────┘  │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │Hardware │ │  Cache   │ │  API Client   │  │  │
│  │  │ Manager │ │  Manager │ │  (HMAC auth)  │  │  │
│  │  └─────────┘ └──────────┘ └───────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS + HMAC
                       ▼
┌─────────────────────────────────────────────────────┐
│ Websmith Internal API                                │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ Auth     │ │ License  │ │ Trial             │   │
│  │ (OTP)    │ │ (CRUD)   │ │ (Management)      │   │
│  └──────────┘ └──────────┘ └───────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ Customer │ │ Plans    │ │ Admin             │   │
│  │ (Store)  │ │ (Pricing)│ │ (Dashboard)       │   │
│  └──────────┘ └──────────┘ └───────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ SQL
                       ▼
┌─────────────────────────────────────────────────────┐
│ PostgreSQL (Neon)                                    │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ customers│ │ licenses │ │ trials             │   │
│  ├──────────┤ ├──────────┤ ├───────────────────┤   │
│  │ products │ │ plans    │ │ activations        │   │
│  ├──────────┤ ├──────────┤ ├───────────────────┤   │
│  │ otp_     │ │ audit_   │ │ developer_api_keys │   │
│  │ verif.   │ │ logs     │ │                    │   │
│  └──────────┘ └──────────┘ └───────────────────┘   │
└─────────────────────────────────────────────────────┘
\`\`\`

## SDK Components

| Component | File | Responsibility |
|-----------|------|----------------|
| License Engine | \`license_engine.py\` | Orchestrates all license operations |
| API Client | \`client.py\` | HTTP client with HMAC signing |
| Cache Manager | \`cache.py\` | Local status cache |
| Hardware Detector | \`hardware.py\` | Machine fingerprint |
| Crypto Utils | \`crypto.py\` | HMAC signature generation |
| Welcome Dialog | \`welcome.py\` | Trial onboarding UI |
| Activation Dialog | \`activation.py\` | License activation UI |
| Renewal Dialog | \`renewal.py\` | License renewal UI |
| Device Replace | \`device_replace.py\` | Device transfer UI |
| Dashboard Widget | \`widgets/dashboard_widget.py\` | Status display |
| Settings Widget | \`widgets/settings_widget.py\` | License management |
| Status Widget | \`widgets/status_widget.py\` | Compact indicator |
| Activation Button | \`widgets/activation_button.py\` | Quick activation |

## Data Flow

### Trial Onboarding
\`\`\`
User enters info → Send OTP → Verify OTP → Register Customer → Start Trial → Bind Hardware
\`\`\`

### License Activation
\`\`\`
User enters key → Fetch details → Verify → Activate → Bind Hardware → Cache Status
\`\`\`

### Startup
\`\`\`
Load cache → Check onboarding → Check trial → Check license → Validate hardware → Open app
\`\`\`

### Renewal
\`\`\`
Fetch plans → Select plan → Renew → Update cache
\`\`\`

### Device Replacement
\`\`\`
Old hardware → New hardware → Confirm → Replace → Refresh
\`\`\`

## Technology Stack

- **Client SDK:** Python 3.8+
- **API:** Next.js serverless (Vercel)
- **Database:** PostgreSQL (Neon)
- **Auth:** HMAC-SHA256 request signing
- **Cache:** Local JSON file
- **Hardware ID:** CPU + machine fingerprint
`,
  'TROUBLESHOOTING.md': `# Troubleshooting

## Common Issues

### "api-config.json not found"
Ensure the \`config/\` directory with \`api-config.json\` is inside the SDK folder. This file is generated automatically when you publish your product.

### "Cannot generate hardware fingerprint"
The SDK could not identify stable hardware. Ensure:
- CPU identifier is accessible
- Administrator/root privileges on some systems
- Not running in a restrictive container or sandbox

### License activation fails
- Check internet connectivity
- Verify the license key is correct
- Ensure the license key has not already been activated on another device
- Contact support if the issue persists

### OTP not received
- Check spam/junk folder
- Ensure email address is correct
- Wait a few minutes and try again
- Contact support if the issue persists

### API connection timeout
- Check internet connectivity
- Verify the API URL in \`api-config.json\`
- Firewall may be blocking outbound connections

### Cache corruption
If the cache becomes corrupted, delete \`~/.websmith/<product_id>/\` and restart the application. The SDK will re-validate with the server.

### Trial does not start
- OTP must be verified before trial can start
- Ensure all required fields (name, email, mobile) are provided
- Check that hardware fingerprint was generated successfully

### Device replacement fails
- Both old and new hardware must be accessible
- New hardware fingerprint must be generated before replacement
- Internet connection is required

## Security Warnings

- No hardware ID → activation disabled
- Invalid hardware → all license controls disabled
- User closes onboarding → application must close
- Failed OTP → application must block
- Failed trial → application must block
- Invalid license → application must block

## Support

Contact: support@websmithdigital.com
`,
};

// ============================================================
// ASSET TEMPLATES
// ============================================================

const ASSET_TEMPLATES = {
  'badge.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="#6366f1"/>
  <text x="50" y="55" text-anchor="middle" fill="white" font-family="sans-serif" font-size="12">OK</text>
</svg>`,
  'logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50">
  <text x="0" y="30" font-family="sans-serif" font-size="24" fill="#6366f1">SDK</text>
  <text x="0" y="45" font-family="sans-serif" font-size="12" fill="#666">License Client</text>
</svg>`
};

// ============================================================
// RUNTIME BUILDER CLASS
// ============================================================

export class RuntimeBuilder {
  private tempRoot: string;

  constructor() {
    this.tempRoot = '';
  }

  async build(options: RuntimeBuildOptions): Promise<string> {
    const { context, apiConfig, runtime } = options;
    const displayName = (context.productName || 'Toolkit').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9_\-]/g, '') || 'Toolkit';
    const tmpDir = process.env.WEBSMITH_TEMP_DIR || process.env.TMPDIR || process.env.TEMP || '/tmp';
    this.tempRoot = path.resolve(tmpDir, displayName);
    const sdkDirName = `WSD_SDKToolkit_${displayName}`;
    const packageDir = path.join(this.tempRoot, sdkDirName);

    await fs.mkdir(this.tempRoot, { recursive: true });
    await fs.mkdir(packageDir, { recursive: true });

    try {
      await this.generateRuntimeFiles(packageDir, context, runtime.name);
      await this.writeConfig(packageDir, apiConfig);
      await this.generateDocs(packageDir);
      await this.generateAssets(packageDir);
      await this.generateReadme(packageDir, context, runtime.name);

      return packageDir;

    } catch (error) {
      await this.cleanup(packageDir);
      throw error;
    }
  }

  private async generateRuntimeFiles(packageDir: string, context: PublisherContext, runtimeName: string): Promise<void> {
    const templates = getRuntimeTemplates(runtimeName, context);

    for (const [filename, content] of Object.entries(templates)) {
      const filePath = path.join(packageDir, filename);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  private async writeConfig(packageDir: string, apiConfig: ApiConfig): Promise<void> {
    const configDir = path.join(packageDir, 'config');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, 'api-config.json'),
      JSON.stringify(apiConfig, null, 2),
      'utf-8'
    );
  }

  private async generateDocs(packageDir: string): Promise<void> {
    const docsDir = path.join(packageDir, 'docs');
    await fs.mkdir(docsDir, { recursive: true });
    for (const [filename, content] of Object.entries(DOCS_TEMPLATES)) {
      await fs.writeFile(path.join(docsDir, filename), content, 'utf-8');
    }
  }

  private async generateAssets(packageDir: string): Promise<void> {
    const assetsDest = path.join(packageDir, 'assets');
    await fs.mkdir(assetsDest, { recursive: true });

    for (const [filename, content] of Object.entries(ASSET_TEMPLATES)) {
      await fs.writeFile(path.join(assetsDest, filename), content);
    }
  }

  private getInstallCommand(runtime: string, pkgDir: string): string {
    switch (runtime) {
      case 'python': return `pip install ${pkgDir}`;
      case 'node':
      case 'bun':
      case 'deno': return `npm install ${pkgDir}`;
      case 'php': return `composer require ${pkgDir}`;
      case 'java': return `mvn install ${pkgDir}`;
      case 'dotnet': return `dotnet add package ${pkgDir}`;
      case 'go': return `go get ${pkgDir}`;
      case 'rust': return `cargo add ${pkgDir}`;
      default: return `# See package-specific instructions for ${runtime}`;
    }
  }

  private getDbTableSection(): string {
    return `## Database Tables

The SDK communicates with the following Neon PostgreSQL tables managed by Websmith Internal API:

| Table | Description |
|-------|-------------|
| \`products\` | Product definitions (\`id\`, \`name\`, \`slug\`, \`runtime\`, \`version\`) |
| \`plans\` | Pricing plans per product (\`id\`, \`product_id\`, \`duration_days\`, \`max_devices\`) |
| \`customers\` | Registered customers (\`id\`, \`email\`, \`full_name\`, \`company\`, \`country_code\`, \`mobile\`, \`email_verified\`) |
| \`otp_verifications\` | One-time passwords for email verification (\`id\`, \`email\`, \`otp_code\`, \`verified\`, \`expires_at\`) |
| \`trial_templates\` | Trial configuration templates (\`id\`, \`days\`, \`max_devices\`) |
| \`trials\` | Active trials (\`id\`, \`customer_id\`, \`hardware_id\`, \`expires_at\`) |
| \`licenses\` | License records (\`id\`, \`license_key\`, \`customer_id\`, \`expires_at\`, \`status\`) |`;
  }

  private getWelcomeFlowSection(pkgDir?: string): string {
    const dir = pkgDir || 'sdk_package';
    return `## Welcome Flow

When a customer runs the application for the first time, the SDK orchestrates this flow:

\`\`\`
Application starts
        ↓
LicenseEngine.initialize()
        ↓
No license/trial found
        ↓
Welcome dialog opens
        ↓
Customer enters email
        ↓
Send OTP
        ↓
Verify OTP
        ↓
Select country
        ↓
Enter name + mobile
        ↓
Create customer row in Neon PostgreSQL
        ↓
Start trial (trials row + otp_verifications updated)
        ↓
Application opens
\`\`\`

**Rules:**
- Close dialog (X) → \`sys.exit(0)\` — entire application closes
- OTP not verified → Start Trial button stays disabled
- OTP verified + dialog closed before trial → application exits
- Trial created → application opens normally

**Integration pattern:**

\`\`\`python
from ${dir} import LicenseEngine, WelcomeDialog

engine = LicenseEngine()
status = engine.initialize()
if not status.valid:
    result = WelcomeDialog(engine._client).show()
    if result.get("skipped") and not result.get("onboarding_complete"):
        import sys
        sys.exit(0)  # User closed dialog or declined
    status = engine.initialize()  # Re-check after onboarding
\`\`\``;
  }

  private getExampleSection(runtime: string, title: string, code: string): string {
    return `### ${title}\n\n\`\`\`${runtime}\n${code}\n\`\`\`\n`;
  }

  private buildPythonExamples(pkgDir: string, productName?: string): string {
    const sections = [
      this.getExampleSection('python', 'Initialize & Validate',
`from ${pkgDir} import LicenseEngine

engine = LicenseEngine()
status = engine.initialize()
if status.valid:
    print(f"License valid until {status.expires_at}")
elif status.status == "trial":
    print(f"Trial active, {status.days_remaining} days remaining")
else:
    print(f"Status: {status.status} - {status.message}")`),

      this.getExampleSection('python', 'Start Trial',
`engine = LicenseEngine()
result = engine.start_trial("user@example.com", customer_name="John Doe")
if result.get("success"):
    print("Trial started successfully")
    status = engine.get_status()
    print(f"Days remaining: {status.days_remaining}")`),

      this.getExampleSection('python', 'Convert Trial to License',
`engine = LicenseEngine()
engine.initialize()

try:
    result = engine.convert_trial(plan="premium")
    if result.get("success"):
        print("Trial converted to license")
except RuntimeError as e:
    print(f"No active trial: {e}")`),

      this.getExampleSection('python', 'Activate License',
`engine = LicenseEngine()
result = engine.activate("XXXXX-XXXXX-XXXXX-XXXXX")
if result.get("success"):
    print("License activated")
    print(f"Plan: {engine.get_status().plan}")`),

      this.getExampleSection('python', 'Renew License',
`engine = LicenseEngine()
status = engine.initialize()
if not status.valid:
    print("Please activate your license first")
    engine.activate("XXXXX-XXXXX-XXXXX-XXXXX")

try:
    result = engine.renew()
    if result.get("success"):
        print("License renewed")
except ValueError as e:
    print(f"Activation required: {e}")`),

      this.getExampleSection('python', 'Replace Hardware',
`engine = LicenseEngine()
status = engine.initialize()

try:
    result = engine.replace_hardware()
    if result.get("success"):
        print("Hardware replaced")
except ValueError:
    print("Please re-enter your license key")
    engine.activate("XXXXX-XXXXX-XXXXX-XXXXX")
    result = engine.replace_hardware()`),

      this.getExampleSection('python', 'Show Welcome Dialog',
`from ${pkgDir} import LicenseEngine, WelcomeDialog

engine = LicenseEngine()
status = engine.initialize()
if not status.valid:
    result = WelcomeDialog(engine._client, product_name="${productName || 'MyApp'}").show()
    if result.get("onboarding_complete"):
        print("Onboarding done for:", result["email"])
        status = engine.initialize()
        print(f"Trial active: {status.days_remaining} days")
    elif result.get("skipped"):
        print("Onboarding skipped — application will close")
        import sys
        sys.exit(0)`),

      this.getExampleSection('python', 'Deactivate License',
`engine = LicenseEngine()
engine.initialize()

try:
    result = engine.deactivate()
    if result.get("success"):
        print("License deactivated on this device")
except ValueError as e:
    print(f"Error: {e}")`),

      this.getExampleSection('python', 'Bind Device',
`engine = LicenseEngine()
engine.initialize()

try:
    result = engine.bind_device(device_name="Workstation-1")
    if result.get("success"):
        print("Device bound")
except ValueError as e:
    print(f"Activation required: {e}")`),
    ];

    return sections.join('\n');
  }

  private getExampleCode(runtime: string, className: string): string {
    const examples: Record<string, string> = {
      node: `const { LicenseEngine } = require('${className}');

const engine = new LicenseEngine();
const status = await engine.initialize();
if (status.valid) {
  console.log('License valid until', status.expires_at);
} else {
  console.log('Status:', status.status, '-', status.message);
}`,
      go: `import "${className}"

func main() {
    engine := license.NewEngine()
    status := engine.Initialize()
    if status.Valid {
        log.Printf("License valid until %s", status.ExpiresAt)
    }
}`,
    };
    return examples[runtime] || `// Initialize the SDK
const engine = new LicenseEngine();
const status = engine.initialize();
console.log(status);`;
  }

  private async generateReadme(packageDir: string, context: PublisherContext, runtimeName: string): Promise<void> {
    const displayName = (context.productName || 'Toolkit').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9_\-]/g, '') || 'Toolkit';
    const pkgDir = `WSD_SDKToolkit_${displayName}`;
    const installCmd = this.getInstallCommand(runtimeName, pkgDir);
    const examples = runtimeName === 'python' ? this.buildPythonExamples(pkgDir, context.productName) : this.getExampleCode(runtimeName, pkgDir);

    const readmeContent = `# Universal License Control SDK — ${context.productName}

**Version:** ${context.kitVersion} | **Runtime:** ${runtimeName}

This is a **Universal License Control SDK** generated by Websmith Internal API.
It is NOT product-specific, NOT language-specific, and NOT platform-specific.
It works with any application, on any operating system, in any supported runtime.

---

## Overview

\`\`\`
Application
    ↓
SDK (this package)
    ↓
Websmith Internal API
    ↓
Neon PostgreSQL
\`\`\`

The SDK manages the complete license lifecycle: trial activation, OTP verification,
license validation, activation, deactivation, renewal, hardware binding, and device replacement.

---

## Installation

\`\`\`bash
${installCmd}
\`\`\`

## Quick Start

${examples}

## Configuration

The SDK reads configuration from \`config/api-config.json\`. This file is auto-generated
during publish and contains all product settings: API endpoints, branding, trial settings,
feature flags, and security parameters.

### Config Structure

\`\`\`json
{
  "product": { "id": "<from_products>", "name": "<from_products>", "version": "<from_products>" },
  "api": { "url": "<env_WEBSMITH_API_URL>", "public_key": "<from_developer_api_keys>", "secret": "<generated>" },
  "trial": { "enabled": <from_sdk_runtime_settings>, "days": <from_sdk_runtime_settings> },
  "license": { "max_devices": <from_sdk_runtime_settings>, "hardware_binding": true },
  "offline": { "enabled": true, "cache_days": <from_sdk_runtime_settings> }
}
\`\`\`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| \`POST /api/v1/license\` | License management (validate, activate, deactivate, renew) |
| \`POST /api/v1/trial\` | Trial management (start, status, convert) |
| \`POST /api/v1/device\` | Device management (bind, replace, reset) |
| \`POST /api/v1/auth/otp/send\` | Send OTP for email verification |
| \`POST /api/v1/auth/otp/verify\` | Verify OTP code |
| \`POST /api/v1/customer/register\` | Register customer with onboarding data |
| \`GET /api/v1/countries\` | Get list of supported countries |
| \`GET /api/v1/status\` | API health check |

## HMAC Request Signing

All API requests are signed using HMAC-SHA256:

1. Generate ISO 8601 UTC timestamp and UUID v4 nonce
2. Create message: \`{method}\\n{path}\\n{query}\\n{sha256(body)}\\n{timestamp}\\n{nonce}\`
3. Compute HMAC-SHA256 with \`api_secret\` from config
4. Send headers: \`x-api-key\`, \`x-timestamp\`, \`x-nonce\`, \`x-signature\`

${this.getDbTableSection()}

${this.getWelcomeFlowSection(pkgDir)}

## SDK Architecture

The SDK follows this layered architecture:

\`\`\`
┌─────────────────────────────────────────────┐
│               Your Application               │
├─────────────────────────────────────────────┤
│  WelcomeDialog  │  Widgets  │  LicenseEngine │
├─────────────────────────────────────────────┤
│  CacheManager    │   HardwareFingerprint     │
├─────────────────────────────────────────────┤
│          ApiClient (HMAC-signed)             │
├─────────────────────────────────────────────┤
│       Websmith Internal API (REST)           │
├─────────────────────────────────────────────┤
│              Neon PostgreSQL                 │
└─────────────────────────────────────────────┘
\`\`\`

## Developer Responsibilities

- ✅ Call \`engine.initialize()\` on application startup
- ✅ Handle the \`WelcomeDialog\` for new customer onboarding
- ❌ Do NOT hardcode trial days, country lists, or license rules
- ❌ Do NOT bypass OTP verification
- ❌ Do NOT patch or modify generated SDK files

## License

Copyright (c) ${new Date().getFullYear()} ${context.productName}
Generated by Websmith License API Center
`;

    const readmePath = path.join(packageDir, 'README.md');
    await fs.writeFile(readmePath, readmeContent, 'utf-8');
  }

  async cleanup(packageDir: string): Promise<void> {
    if (!packageDir) return;
    try {
      const resolvedDir = path.resolve(packageDir);
      const resolvedRoot = path.resolve(this.tempRoot);
      if (resolvedDir.startsWith(resolvedRoot)) {
        await fs.rm(resolvedDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
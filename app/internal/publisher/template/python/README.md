# Python SDK for {{PRODUCT_NAME}}

This directory contains the Python language template for the Universal License Platform.

## Mandatory Modules

- `license_engine.py` — Startup decision engine, license validation, state management
- `hardware.py` — Hardware fingerprint detection
- `cache.py` — Local persistence, offline support, message queue
- `client.py` — HMAC-signed API client
- `crypto.py` — Cryptographic utilities
- `activation.py` — License activation workflow
- `renewal.py` — License renewal workflow
- `reactivation.py` — License reactivation workflow
- `trial.py` — Trial management workflow
- `communication.py` — Universal conversation engine
- `notifications.py` — System notifications
- `support.py` — Support request workflow
- `sales.py` — Sales enquiry workflow
- `config.py` — Configuration loading, branding
- `universal_license_center.py` — Main customer-facing GUI
- `welcome.py` — Onboarding workflow
- `__init__.py` — Package initialisation

## Placeholder Standard

All templates use `{{PLACEHOLDER}}` tokens replaced at generation time.

| Placeholder | Source |
|-------------|--------|
| `{{PRODUCT_NAME}}` | `product.name` from api-config.json |
| `{{PRODUCT_ID}}` | `product.id` from api-config.json |
| `{{API_URL}}` | `api.url` from api-config.json |
| `{{SDK_VERSION}}` | `SDK_VERSION` environment variable |
| `{{RUNTIME_TYPE}}` | Runtime identifier |
| `{{SUPPORT_EMAIL}}` | `branding.support_email` from config |
| `{{SALES_EMAIL}}` | `branding.sales_email` from config |
| `{{COMPANY_NAME}}` | `branding.company_name` from config |
| `{{WEBSITE_URL}}` | `branding.website_url` from config |
| `{{PRIMARY_COLOR}}` | `branding.primary_color` from config |
| `{{TRIAL_DAYS}}` | `product.trial_days` from config |
| `{{MAX_DEVICES}}` | `plan.max_devices` from config |
| `{{SENDER_NAME}}` | `branding.sender_name` from config |

## Template Validation

Generation fails if:
- Any mandatory module is missing
- Any placeholder remains unreplaced
- Any hardcoded company name, URL, or email address exists
- Duplicate implementation exists in both template and runtime generator

## Architecture

```
Language Template (this directory)
  ↓
Runtime Generator (orchestration only)
  ↓
Generated SDK (output only)
```

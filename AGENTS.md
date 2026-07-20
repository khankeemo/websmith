# AGENTS.md — Summary

## Build
`npm run build` — compiles with 0 TS errors, 194 pages generated

## Deploy
`vercel --prod --yes` — production alias: `https://websmith-z.vercel.app`

## Password Reset Fix (Phase 12)
- Reset route no longer forwards to MongoDB backend (broken Brevo/api.websmithdigital.com)
- Instead stores bcrypt-hashed password in PostgreSQL `customers` table
- Login flow: tries MongoDB first, if that fails falls back to local `/api/auth/fallback-login` which checks `customers.password_hash`
- Tables: added `password_hash` (TEXT) and `role` (TEXT DEFAULT 'user') columns to `customers` via `ALTER TABLE ADD COLUMN IF NOT EXISTS` at runtime

## Phase Summary

### Phase 1 — Universal Trial System
- `trial_templates` table: added `is_system_default`, `max_devices`
- Seed: system default template (`is_system_default = true`)
- Backend CRUD: protection against deleting system default
- UI: badge, max_devices field, set default button, clone action
- Deployed

### Phase 2 — Trial Lifecycle
- Public trial API: fixed double `client.release()`, audit logging on convert, `expired_at` column
- Backend trial start: `getTrialDuration` uses template `duration_days` fallback, audit logging
- Backend trial status: auto-expire + upgrade dialog for expired trials
- SDK runtimes: unified `POST /api/v1/trial` with `action` param; fixed params (hardware_id, email, plan, name)

### Phase 3 — SDK Inspection
- Go: added `time` import, `expires_at` check in `IsValid()`
- Rust: added `chrono` dep, `device_name` in activate, `activate()`/`deactivate()` methods
- C++: added `<chrono>`, `<iomanip>`, ISO 8601 expiry parsing
- All 14 runtimes present; core validation/hardware binding works; advanced features (offline cache, replay protection, clock rollback, purchase dialog) are architectural gaps

### Phase 4 — Customer History
- Added renewals query (renewal_history → licenses join)
- Added email history query (notification_logs)
- Renewals Table and Email History section on customer detail page
- API Keys and SDK Downloads skipped (no customer_email in those tables)

### Phase 5 — Email System
- Removed duplicate email template seeding from `lib/backend-db/index.ts`
- Kept richer seed route (12 templates with `plain_text`)

### Phase 6 — Internal API Cleanup
- All 79 backend routes, 35 API pages, 24 components inventoried
- None obviously unused

### Phase 7 — Duplicate Logic
- Consolidated API key generation to central `generateApiKey()` from `core/utils/validation-system.ts`

### Phase 8 — Database Cleanup
- No demo data found; no cleanup needed

### Phase 9 — Legacy References
- Removed `Demo` OAuth fallback from `oauthService.ts` and `auth/callback/page.tsx`
- Zero references to `prod_zemmacos`, `ZEMmacOS`, `ControlKit`, `WebsmithControlKit`, `Demo`, `Sample`, `Example`

### Phase 10 — Full QA
- 9 pages inspected (dashboard, products, trials, trial-templates, licenses/generate, customers, hardware, logs, analytics)
- All pass: loading, empty, error states; proper TypeScript types; no hardcoded refs

### OTP Diagnostics (Phase 13)
- OTP send/verify both return 400 in deployed env; no code regression found in route files
- Added `console.log`/`console.warn` diagnostic logging to OTP send (body keys, email value, validation failure reason) and OTP verify (disambiguate "already used" vs "invalid")
- Vercel build output shows `ƒ Proxy (Middleware)` but no `middleware.ts` exists in repo — likely Vercel project-level proxy rule
- Key suspects: missing `BREVO_API_KEY`/`SENDER_EMAIL` in Vercel env vars, or Vercel proxy intercepting POST requests
- Next: check Vercel function logs for `[OTP send]` messages after testing WelcomeDialog flow

## Phase 11 — Public Software Store
- Public API endpoint `/api/v1/store/products` — dynamic product listing from DB
- Public API endpoint `/api/v1/store/enquiries` — checkout enquiry submission
- Premium store UI: Framer Motion animations, glassmorphism, hover effects, grid/list toggle
- Product detail page `/software-store/product/[id]` with left/right layout
- Checkout page with customer info, billing, order summary, payment method placeholders
- Payment result pages: success, failed, pending
- Cart with localStorage persistence, quantity controls, deduplication
- Wishlist with localStorage persistence, move-to-cart
- Search, category/platform filters, sort (newest/price/name)
- Skeleton loading, empty state, error state with retry
- Admin software listing functions migrated to separate service file

## Key Commands
- Build: `npm run build` (0 TS errors, 191 pages)
- Dev: `npm run dev`
- Deploy: `vercel --prod --yes`
- Test: `npm test` (14 SDK validator tests)
- Test: `npm run test:generation` (SDK validator tests)
- Test All: `node --experimental-strip-types tests/sdk-generation/validator.test.mjs; node --experimental-strip-types tests/sdk-generation/pipeline.test.mjs` (180 total tests)
- Git: `git add -A && git commit -m "msg"`

## Phase 14 — SDK Generator Hardening
- **Validation pipeline**: Added 6th stage `validate-sdk` to publisher pipeline (`sdk-validator.ts`). Automatically runs `py_compile`, config/manifest integrity checks, import resolution, and bare-except detection after ZIP creation. Job fails if validation errors are found.
- **QA tests**: Created `tests/sdk-generation/validator.test.mjs` — 11 tests covering empty packages, missing config/manifest, config integrity, import warnings, Python syntax errors, and valid packages.
- **README generator**: Rewritten with full lifecycle examples (initialize, trial, convert, activate, renew, replace hardware, welcome dialog, deactivate, bind device). HMAC signing documentation included.
- **Static templates removed**: `app/internal/publisher/templates/` deleted (were unused by pipeline, dangerous as stale reference). `runtime-selector.ts` cleaned up — removed `absolutePath`, `templateDir`, `copyTemplate()`, `copyDirectory()`, `createMinimalTemplate()`.
- **Python runtime hardened**: All 7 generated files (`__init__.py`, `client.py`, `crypto.py`, `hardware.py`, `cache.py`, `license_engine.py`, `welcome.py`) rewritten to match static template quality:
  - `client.py`: HMAC-SHA256 signing, retry logic, config-driven
  - `crypto.py`: Full HMAC-SHA256 with timestamp/nonce/body-hash matching backend
  - `hardware.py`: CPU→Motherboard→MAC fallback per ADR-001, cross-platform
  - `cache.py`: Config-driven TTL, atomic writes, corrupt preservation
  - `license_engine.py`: Config-path based initialization, `convert_trial()`, `replace_hardware()`, `bind_device()`
  - `welcome.py`: `tk.Toplevel()` (not `Tk()`), branding from config, no hardcoded India/colors
- **Config builder**: Added `secret` field to `ApiSettings` for HMAC signing
- **Runtime builder**: Temp path configurable via `WEBSMITH_TEMP_DIR`/`TMPDIR`/`TEMP`, runtime-aware README commands
- **HMAC contract**: Documented in `config-builder.ts` header — all v1 endpoints require HMAC-SHA256; algorithm matches backend exactly

## Architecture Notes
- All validations: `core/utils/validation-system.ts`
- All DB schema: `lib/backend-db/index.ts`
- Public API: `app/api/v1/` (signature + API key auth)
- Internal Backend: `app/internal/backend/` (JWT auth via proxy.ts)
- Internal UI: `app/internal/api/`
- SDK Templates: `app/internal/publisher/runtimes/`
- License states: `status` (raw authoritative), `inactive_reason` (human-readable)
- Trial countdown starts on first activation, not generation
- All URLs from env vars, no hardcoded domains
- Emails via Brevo from `support@websmithdigital.com`
- SDK ZIP naming: `wsd_toolkit_<productName>_<packageId>.zip`

## Phase 15 — Multi-Runtime Hardening (All 14 Runtimes)
- **Validator enhanced**: `checkReadme` now verifies all 14 lifecycle sections (Initialize & Validate, Start Trial, Convert Trial, Activate, Renew, Replace Hardware, Welcome Dialog, Deactivate, Bind Device, HMAC, API Endpoints, Configuration)
- **Non-Python compilation checks added**: `validateNode()` (`node --check`), `validateTypeScript()` (`tsc --noEmit`), `validatePhp()` (`php -l`), `validateJava()` (`javac`), `validateDotNet()` (`dotnet build`), `validateGo()` (`go vet`), `validateRust()` (`cargo check`), `validateCpp()` (`g++ -fsyntax-only`), `validateC()` (`gcc -fsyntax-only`), `validateBun()` (`bun build --check`), `validateDeno()` (`deno check`), `validateJavaScript()` (`node --check`)
- **All 12 non-Python runtimes hardened** for full parity with Python:
  - **Node.js**: HMAC-SHA256, exponential backoff retry, config-driven endpoints, CPU→Motherboard→MAC fallback, CacheManager, full LicenseEngine (all 11 lifecycle methods), WelcomeDialog, comprehensive README
  - **TypeScript**: same hardening + proper types + tsconfig
  - **Bun**: ESM module, Bun-native file I/O, full parity
  - **Deno**: Deno-native APIs, full parity
  - **JavaScript (browser)**: Web Crypto HMAC, `fetch()` (no XMLHttpRequest), canvas fingerprint, localStorage CacheManager, DOM-based WelcomeDialog
  - **PHP**: OpenSSL HMAC, curl retry, exec-based hardware detection, all classes in namespace
  - **Java**: Gson config, `javax.crypto.Mac` HMAC, WMI+sysfs hardware, full cache+engine+engine+WelcomeDialog (6 files)
  - **.NET (C#)**: C# 10+, `HMACSHA256`, WMI hardware, atomic cache, full parity
  - **Go**: Config loading, `crypto/hmac`, `go vet` clean, all methods in separate files (client/hardware/cache/license/welcome)
  - **Rust**: `hmac`+`sha2` crates, `machine_uid`+`mac_address` hardware, module structure (lib.rs + cache.rs), `cargo check` ready
  - **C++**: OpenSSL `HMAC()`, real hardware fingerprint (procfs/WMI), `CacheManager` with `<filesystem>`, RAII via `unique_ptr`, full parity
  - **C (ANSI C11)**: Complete rewrite — `client.h` + `client.c` with full implementation, OpenSSL HMAC, real hardware fingerprint, cache ring buffer, license engine, welcome dialog, makefile with `-lssl -lcrypto`
- Build: **0 TS errors, 191 pages**
- Tests: **11/11 pass**

## Phase 15b — Full Database Audit (Final)
- **38 tables audited**, 31 fully used, 1 deprecated (`wishlist` — no backend API serves it, UI uses localStorage), 4 cascade-only retained
- **7 genuinely dead columns**: `products.public_product_id`, `licenses.customer_username`, `customers.company_name`, `customers.last_login`
- **3 columns kept** despite low read usage: `customers.country_code` (OTP/SMS), `customers.hardware_id` (device binding), `countries.dial_code` (SDK country selectors)
- **10 write-only trials columns kept** as valuable audit fields (sdk_version, runtime_type, activation_source, trial_template_id, suspicious_flag/reason/logged_at, notified_admin, reset_attempts)
- **sdk_runtime_settings**: `product_id` TEXT type enforced, unique index added
- **Forbidden hardcoded values**: zero occurrences of `7`/`1`/`30` defaults in generated output (values come from `sdk_runtime_settings` via publisher context)
- **Widget decision**: Option B — completely removed from README, generator, and all runtime templates (0 widget references across all 13 runtime files + runtime-builder.ts)
- **Pipeline validated**: 180 tests (14 validator + 166 pipeline static analysis) all pass; deployed API health/store/OTP endpoints respond correctly
- **Deliverables**: `database-audit-report.md`, `unused-tables-report.md`, `column-audit-report.md`, `migration-report.md`
- **Build**: 0 TS errors, 191 pages

## Phase 16 — Full E2E Validation With Real Neon DB
- **Migration applied**: `sdk_runtime_settings.product_id` UUID → TEXT, unique index created
- **3 demo products seeded**: Python, Node, Java — each with plans, API keys, and `sdk_runtime_settings` (trial_duration_days=14, device_limit=3, offline_grace_days=7)
- **SDK generation via publisher pipeline**: All 3 SDKs generated successfully through the live `/api/upstash/workflow` endpoint:
  - Python: 17.9 KB, 15 files, config values read from DB
  - Node: 10.7 KB, 10 files, config values read from DB
  - Java: 15.8 KB, 14 files, config values read from DB
- **Config validation**: All 3 api-config.json files contain correct values — `trial.days=14`, `max_devices=3`, `offline_days=7` — no hardcoded `7`/`1`/`30`
- **No widget references**: Zero in all 3 generated SDKs
- **Trial → License → Activation flow tested for all 3 products** via `/api/v1/trial` and `/api/v1/license` endpoints:
  - ✅ Trial start (14 days from sdk_runtime_settings)
  - ✅ Trial status check
  - ✅ Trial conversion (license key generation, plan binding, max_devices=3)
  - ✅ License activation (status=active)
- **Hardcoded value fixes applied**:
  - `publish-product/route.ts`: defaults now read from `sdk_runtime_settings` before fallback to body values
  - `trial/route.ts:265`: `let trialDuration = 7` → reads `sdk_runtime_settings` first, then `trial_templates`, then 14
- **Build**: 0 TS errors, 191 pages
- **Pipeline tests**: 180 pass (14 validator + 166 static analysis)
- **Cleanup**: All demo data removed from production Neon
- **Deliverables**: `sdk-execution-report.md`

## Phase 17 — Universal License Activation System
- **Backend**: `POST /internal/backend/activation/activate` — admin activation without OTP (JWT auth)
- **Backend**: `GET /internal/backend/activation/search` — search by email or license_key, returns customer/hardware/trial/plans data
- **UI Page**: `/internal/api/activation` — full activation workflow
  - Search customer by email or license key
  - Hardware detection: shows "Unable to detect hardware" with disabled controls if no hardware found
  - Hardware verified banner enables full activation form
  - Editable customer fields (name, email, phone) with email-update propagation
  - Trial info display (started, ends, days remaining, status)
  - Plan dropdown from DB, license key input, activation status
  - Plan cards with selection, existing activation info
  - Refresh and Activate License buttons
- **Dashboard**: "Activate License" button in Quick Actions
- **Sidebar**: "Activation" link under LICENSES section
- **Hardware lock**: Only applies to activation UI, NOT to OTP/trial/welcome/onboarding/dashboard/settings
- **Tables used**: customers, licenses, plans, devices (activations), hardware
- **Build**: 0 TS errors, 194 pages

## Remaining Architectural Gaps (not blocking)
- Replay protection, clock rollback detection, purchase dialog still missing across all 14 runtimes (per-runtime template enhancement needed)
- `sdk_jobs` uses fragile `LIKE` text match for product ID in payload JSON; `audit_logs` uses `LIKE` text match for message — both may miss records with non-standard formatting
- Customer page cannot show API Keys or SDK Downloads (no `customer_email` column in those tables)
- `license-api.ts` client routes fixed to `/internal/backend/`

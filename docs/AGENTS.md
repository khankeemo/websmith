# AWS-01 Always-Read Rule — WebSmith Repo

This file is registered as a **global opencode instruction** (via
`opencode.json` → `instructions`) so it is loaded on every task in this
repository. Keep it in permanent sync with
`docs/UNIVERSAL_LICENSE_PLATFORM_IMPLEMENTATION.md` — the master single-source-of-truth
implementation document.

## Rule 0 — ALWAYS READ THE FINAL MD FILES FIRST

Before creating, modifying, or deleting **any** code, config, template, route,
or documentation in this repository:

1. **Always read `docs/UNIVERSAL_LICENSE_PLATFORM_IMPLEMENTATION.md`** (the
   master implementation document) first for the domain you are touching.
2. Read this `docs/AGENTS.md` for the standing AWS-01 rules.
3. Do not write code from assumptions. If the request does not match the
   documented architecture, **update the documentation first**, then write code.
4. The markdown files are the source of truth — never let code and docs diverge.

## Rule ALWAYS-UPDATE — KEEP THE MD FILES CURRENT

- Every time a **rule, architecture, workflow, or AWS-01 behavior changes**,
  update **BOTH** this `docs/AGENTS.md` and
  `docs/UNIVERSAL_LICENSE_PLATFORM_IMPLEMENTATION.md` on the same task.
- Never finish a task that changed behavior without recording it in the final
  md files.
- `docs/UNIVERSAL_LICENSE_PLATFORM_IMPLEMENTATION.md` must always reflect the
  current state of the platform (progress entries included).

## AWS-01 Communications Center — Non-Negotiable Invariants

Keep these in sync with the master doc (see its AWS-01 / Phase 3 section):

- **UI/UX-only scope**: the Communications upgrades must never alter the sending
  (SMTP), receiving (IMAP), queue, schema, auth, or notification engines/APIs.
- **Public storefront is untouchable**: `www.websmithdigital.com/software-store`
  (PostgreSQL `products` + `/api/v1/store/*` + `/api/v1/checkout/*`). Never edit
  it; it is the working public storefront.
- **Built-in mailboxes** (`support@`, `sales@`, `no-reply@`) are app-config
  defaults; enabling/disabling is an app-config toggle + `mailboxes.is_enabled` —
  never delete accounts.
- **Never render mailbox passwords in plaintext**: mask stored credentials
  (`********`) and strip blank/masked passwords from PATCH payloads so edits do
  not wipe stored credentials.
- **Unread is derived**: count = conversations with customer replies newer than
  the last admin reply / `admin_read_at` (GREATEST subquery). Stats handler is
  `force-dynamic`.
- **Add Mailbox workflow** (see master doc Phase 5 "Add Mailbox Workflow Fix"):
  new mailboxes are verified (IMAP + SMTP) **before** they are saved via
  `POST /internal/backend/mailboxes/test-connection` (reuses the same
  `imap`/`nodemailer` connection logic as `[id]/test`; never changes the SMTP/IMAP
  implementations). Verification failure → the UI blocks the save and shows the
  specific reason; success saves through the unchanged `POST /internal/backend/
  mailboxes`. All mailbox events log to `audit_logs`
  (`mailbox_created`, `mailbox_create_failed`, `mailbox_connection_test`), readable
  via `GET /internal/backend/logs`. The error/success toast must always stay above
  open modals (`z-[100]`).
- **Architecture hierarchy**: Master Doc → Language Templates → SDK Publisher →
  Generated SDK. Never edit Generated SDKs directly; never embed business logic
  in runtime generators.

## AWS-01 ULC Event Messaging & Activation Rules (Final)

See master doc **SECTION 0B** (Event Messaging & Activation Rules). Always honour:

- **Rule 1** — the backend `/internal/backend/license/status` API is the single source of
  truth; never compute license/plan/days/validity locally except absent-optional fallbacks.
  All Activation / Renewal / Validate entry routes (internal AND `/api/v1/*`) must call the
  shared `resolveGlobalLicenseStatus()` service in `lib/license/serializer.ts` — routes MUST
  NOT query the database or make business decisions on their own. The universal response
  (status/reason/actions/message + proper HTTP code) is returned to the SDK, which only
  renders it. Activation requires `ACTIVE`/`TRIAL_ACTIVE`; renewal requires `ACTIVE`/`EXPIRED`.
- **Rule 2** — hardware binding is permanent; never unbind/re-bind/clear it locally; a
  hardware mismatch only invalidates the cached `license_status` key. Message: "Hardware
  replacement requires administrator approval."
- **Rule 3** — a **fresh** license activation clears the old cached license state
  (license/plan/customer/expiry/activation) then reloads from the backend; preserve only the
  hardware ID and the offline message queue.
- **Rules 4 & 9** — every user-visible message is also written to the shared `LiveLog` (and the
  external forwarder); UI and LiveLog stay in sync per flow (startup/trial/activation/renewal/
  refresh/hardware/communication/general).
- **Rule 5** — pass through real server messages verbatim; never substitute a generic local
  string for a server-provided message.
- **Rule 6** — show a live "working…" progress state for any operation expected to take >1s.
- **Rule 7** — successful trial/activation/renewal always shows the `SuccessDialog` summary.
- **Rule 8** — errors explain what / why / next; avoid bare "Error"/"Failed"/"Unknown".
- **Rule 10** — run the 14 end-to-end validation scenarios before delivery.

## SDK V2 Single-State Architecture (Python Template)

See master doc **SECTION 0C**. Never regress:

- **One controller**: `LicenseEngine` (`license_engine.py`) is the **only** module that
  talks to the API, owns cache state, runs workflows, and mutates license state.
- **client.py is transport-only** — no `CacheManager`, no decision logic. UI modules
  (`universal_license_center.py`, `welcome.py`, `trial.py`, `activation.py`, `renewal.py`,
  `reactivation.py`, `communication.py`, dialogs) must never access `client`/`cache`/`_client`
  directly — they use engine methods (`validate_license_key`, `send_otp`, `verify_otp`,
  `mark_onboarding_complete`, `persist_runtime_state`, `flush_cache`, …).
- **Event-driven UI**: the ULC re-renders only from `LicenseStatusChanged` /
  `workflow.progress` events; success paths never call `_refresh_ui()` manually. Use the
  canonical 16-stage list from `WorkflowProgress` — never invent new stage strings.
- **GlobalStateMachine**: `workflow_progress.py` owns the single global state machine
  (`IDLE/VALIDATING/OTP_SENT/OTP_VERIFIED/PROCESSING/REFRESHING/COMPLETED/FAILED`);
  transitions are driven only by `LicenseEngine` (workflow guard + validate/send_otp/
  verify_otp/refresh/`_apply_fresh_state`), every `set()` emits `workflow.state` on
  `EventBus` and logs `WORKFLOW_STATE`. Exported via package `__init__.py`.
- **Automatic OTP (LOCKED §10)**: validation success immediately triggers
  `engine.send_otp()` — no manual Send OTP step; countdown timer + Resend OTP on expiry.
- **Renewal is payment-first**: ULC renewal path is Validate → Auto OTP → Verify OTP →
  Payment Confirmation (`_confirm_payment_dialog`, dummy payment — no provider contacted) →
  `engine.renew()` (extends the EXISTING license; never creates a replacement) → engine
  refresh → LicenseStatusChanged → success dialog. Renewal must NOT show the legacy
  "Renewal request submitted, our team will contact you" communication step.
- **UED is the sole email path for license/reactivation flows**: backend routes under
  `licenses/renewal-request`, `licenses/reactivation/submit`,
  `reactivation-requests/[id]/reject`, `reactivation-requests/[id]/approve` must use
  `sendEmail()` from `@/lib/email/brevo` (never a raw Brevo fetch). Auth (password-reset)
  and ticket-resolution routes keep their own senders and are intentionally NOT part of
  the Communications Center UED scope (AWS-01 auth/notification invariant).
- **No dead duplicate template code**: `renew_license_dialog.py` was deleted; `renewal.py`
  is the single renewal module. Never re-add duplicate renewal/communication dialog logic.
- **New foundation modules** (`event_bus.py`, `workflow_progress.py`, `dialog_manager.py`)
  are registered in `runtimes/python.ts` `MANDATORY_FILES` — never delete them.
- Engine `_workflow(...)` guard: every workflow logs `WORKFLOW_START`/`COMPLETE`/`ERROR`
  exactly once per stage and serializes under one RLock.
- Keep SECTION 0C in sync here and in the master doc (Rule ALWAYS-UPDATE).

## SDK Enterprise Enhancement Suite (Python Template)

See master doc **SECTION 0D** (20 enterprise areas). Never regress:

- **One owner per concern**: `session.py` (SessionManager), `permissions.py`
  (PermissionEngine), `config_manager.py` (ConfigManager), `feature_flags.py`
  (FeatureFlags), `offline_mode.py` (OfflineMode), `idempotency.py` (IdempotencyManager),
  `timeout_rules.py` (TimeoutRules), `communication_queue.py` (CommunicationQueue),
  `notification_center.py` (NotificationCenter), `error_catalog.py` (ErrorCatalog),
  `security.py` (SecurityRules), `migration.py` (MigrationRunner), `health_check.py`
  (HealthCheck), `metrics.py` (MetricsCollector), `version_compat.py`
  (VersionCompatibility), `support_workflow.py`, `rollback.py` (RollbackCoordinator).
- **These are utility/derivation layers, NOT controllers** — only `LicenseEngine`
  talks to the API / owns cache / mutates state. UI reads via engine accessors
  (`engine.session()`, `engine.permissions()`, `engine.can_activate()`, …).
- **Config reads** go through `ConfigManager` only; nobody calls
  `json.load(api-config.json)` directly. **Timeouts** come from `TimeoutRules`.
- **Idempotency**: every mutating workflow carries an idempotency key; repeated clicks
  produce ONE operation. **Security**: never store OTP/secret/password/token in
  plaintext; cache/hardware/customer encrypted at rest.
- **Encryption-at-rest is wired**: `cache.py` `enable_security(fingerprint)` is called
  from the engine `__init__`/`initialize`; writes are `ENCRYPTED:`-prefixed and fail
  closed when Fernet is unavailable; legacy plaintext cache files still load and upgrade
  on the next save; `license.key` is encrypted too. `CommunicationQueue` owns the
  engine's `_process_message_queue` flush (deliver callback → `client.create_communication`).
- **Fingerprint is versioned** (`v{n}:<hash>`); version mismatch re-verifies against
  the backend, never local re-bind. **Migration** v1→v2 preserves cache/license/
  customer/queue.
- All new modules registered in `runtimes/python.ts` `MANDATORY_FILES` and exported
  from `__init__.py`. Keep SECTION 0D in sync here and in the master doc.

## SDK Universal Activation UI + Shared UI Kit (Python Template)

See master doc **SECTION 0E**. Never regress:

- **One shared Tkinter UI kit**: `ui_styles.py` owns all theme tokens and reusable
  widgets (`COL`/`FONT`, `_rrect`, `GradientHeader`, `StyledButton`, `RoundedEntry`,
  `Card`, `SectionLabel`, `Subtitle`, `StatusPill`, `ProgressBar`, `GlobalMessage`);
  registered in `runtimes/python.ts` `MANDATORY_FILES` + exported from `__init__.py`.
  All screen builders draw only from this kit.
- **Activation dialog** (`_show_key_flow_dialog` in `universal_license_center.py`,
  formerly `activation.py`) is a contained step machine (`key` → `otp` → `final`)
  using `_set_phase`, `GradientHeader` card, shared `format_timer` countdown,
  `StatusPill` + `ProgressBar` progress, and `GlobalMessage`.
- **ULC activation form visual (compact colorful modern):** the visible activation
  UI in `universal_license_center.py` is a custom compact layer over classic
  tkinter — small centered card/container (subtle 1px border + primary 3px top
  accent), `_UVInput` rectangular textbox with slightly rounded corners and an
  accent focus ring (NO oval/pill shapes), `_UVButton` flat colourful buttons
  (primary/success/ghost) with a simple colour-only hover, `_UVPhase` plain text
  status line (no oval/Stupid badge), `_UVBar` thin 8px progress. No gradients,
  glow, shadows or animation. `docs/UI.MD` is used for structure/visual reference
  only. Visual layer only: the activation/renewal workflow, auto-OTP, 5-minute
  OTP timer, GlobalMessage, success dialog + SDK restart and engine delegation
  stay unchanged. Their API mirrors `RoundedEntry`/`StyledButton`
  (`.get`/`.state`/`.entry`, `.set_state`/`.set_text`/`._command`, `.start`/
  `.stop`) so handlers never change. Never remove fields, merge/hide controls,
  rename callbacks, or change button behaviour.
- **`activation.py` is the full standalone Activation UI again (ROLLBACK)**: it was
  rolled back from a thin re-export to the standalone `ActivationDialog` window
  (Hardware / Customer / Trial / License cards, Refresh + Activate actions, OTP
  step, GlobalMessage-driven status, restart confirmation). It still delegates to
  `LicenseEngine` (`validate_license_key`, `send_otp`, `verify_otp`, `activate`,
  `refresh`) and resolves every message through `GlobalMessage` — no raw
  `client`/`cache` decision logic. `open_activation_dialog(center)` opens it.
  Keep it a UI-layer module (SECTION 0C engine-first, no duplicate backend logic).
- Internal APIs/vars must never clobber tk.Canvas internals (use `_pw`, never
  overwrite `_w`); keep the engine surface (`_active_*`) unchanged per SECTION 0C.
- Runtime-guarded via `python -m py_compile` + headless Tk construction smoke test;
  keep `test:generation` 6/6 and `test:multi-runtime` 13/13 green. Keep SECTION 0E
  in sync here and in the master doc.

## SDK Multi-Runtime Parity (All 13 Runtimes)

Both docs are in sync. Never regress:

- **Every generated client must expose `getProducts` + `getTrialStatus`** (per-runtime
  casing: camelCase for node/typescript/javascript/bun/php/java; `GetProducts`/
  `GetTrialStatus` for go/dotnet; `get_products`/`get_trial_status` for python,
  rust and the `websmith_*`-prefixed C client) — these are the method names the
  production `SDKValidator` (`app/internal/publisher/sdk-validator.ts:323-376`)
  requires in the `validate-sdk` stage (`app/internal/publisher/index.ts:754`), which
  fails generation if missing. Implement against the real endpoints: `POST
  /api/v1/store/products` `{action:"list"}` and `POST /api/v1/trial`
  `{action:"status", hardware_id}` (POST works for every runtime's request helper;
  the store route also supports GET).
- **Runtime generators import `PublisherContext` as `import type`** from `../index`
  (type-only, elided at runtime) so `tests/sdk-generation/multi-runtime.test.mjs`
  can import them under `--experimental-strip-types` without resolving the heavy
  `../index` graph. Never change it to a value import.
- **`tests/sdk-generation/multi-runtime.test.mjs` is the parity guard**: it generates
  all 13 runtimes through the real generators, writes a minimal `api-config.json` +
  `manifest.json` (`kit_version` required), and runs `SDKValidator.validate()` against
  each package. Run via `npm run test:multi-runtime`; it is part of `npm test`.
  When editing any runtime generator, re-run it — all 13 must stay `valid: true`.
- **Full fidelity over string-presence**: the validator checks `content.includes(method)`,
  but new methods must be real working calls, not placeholder strings.
- Keep this rule in sync with the master doc progress table (OPERATIONAL QA row).

## Public Website Contact & Social Media Settings (Manage Page)

Keep in sync with the master doc **SECTION 0.15**:

- **Single record, no new tables/endpoints**: all contact + social data lives in
  the MongoDB `settings` collection document `key: "contact_info"`, served by the
  existing `/api/settings/public/contact_info` endpoint (`GET` public; `PUT`/
  `PATCH` admin-only).
- **Fields**: `headquarters`, `email` (Contact/Support), `sales_email`, `no_reply_email`,
  `hr_email`, `phone` (existing) + `mobile_number`, `landline_number`, `whatsapp_url`,
  `facebook_url`, `instagram_url`, `linkedin_url`, `x_url`, `youtube_url` (added).
  Never create another table/collection or a new endpoint for these.
- **Validation lives in shared `lib/site-settings.ts`**: URL hosts are strictly
  validated (facebook.com, instagram.com, linkedin.com, x.com/twitter.com,
  youtube.com, wa.me); the API rejects invalid links with 400, and the admin UI
  validates before submit. Never bypass these checks.
- **WhatsApp special handling**: admins may enter `https://wa.me/<number>` or a
  plain number — plain numbers are always normalized to
  `https://wa.me/<digits>` before saving; visitors always open that URL.
- **Empty = hidden**: public footer/contact/landing render a platform icon only
  when its URL is non-empty (`target="_blank" rel="noopener noreferrer"`); never
  render placeholder/empty icons. Mobile/Landline items render only when set.
- **No hardcoded social URLs**: never re-add socials to `core/config/publicSite.ts`
  or any public component; everything must come from the database record.
- **Admin Manage Page** (`/admin/manage-page`): Contact Information card order is
  Headquarters Address → Contact Email → Sales Email → No-Reply Email → HR Email →
  Mobile Number → Fixed/Landline Number → Primary Contact Number; Social Media
  Links card sits below it; the single Save Changes button persists all fields
  together. Do not redesign the admin UI.
- **Backward compatibility**: `headquarters`/`phone` fall back to previous
  defaults only when the saved value is empty.

## Internal API Side Nav — License Management (Sidebar Restructure)

Keep `components/internal-api/Sidebar.tsx` aligned (presentation only):

- **License Management** section owns **Licenses** (License Center
  `/internal/api/licenses/generate`, Generate License
  `/internal/api/sales/purchase`), **Device & Lifecycle** (Hardware
  `/internal/api/hardware`, Activations `/internal/api/activation`, Renewals
  `/internal/api/licenses/renewals`, Reactivations
  `/internal/api/reactivation-requests`), **Trials** (Trial Dashboard, Trial Templates).
- **No standalone "Hardware Management" section** and **no "Generate License" under
  Sales & Payments** — both live only under License Management.
- **Renewals page** (`/internal/api/licenses/renewals`) mounts the existing UI-only
  `RenewalsTab` component from `app/internal/api/licenses/generate/tabs/` — no new
  business logic, no duplicated logic there. Reactivations points to the admin request
  list, never the customer-facing activation center.
- Do not add dedicated per-page routes/icons/names beyond this regroup; nav routes,
  icons, permissions and active-route semantics are fixed/unchanged.## Universal Buy & Renew Portal (Internal API Only)

Keep in sync with the master doc **SECTION 0.16**. Do not regress:

- **Customer-facing standalone pages** `/internal/api/buy` and `/internal/api/renew` live inside the Internal API but are rendered as standalone full-screen pages — NO admin sidebar, NO admin navigation, NO admin login gate. `app/internal/api/layout.tsx` treats them like auth pages via the `isPortalPage` flag. Changing them must not change the admin dashboard for any other route.
- **No public/private data exposure**: the pages talk ONLY to the public portal backend `/api/portal/*` (catalog, OTP, license info, order create/pay). They never expose the admin products API, customer APIs, license-management APIs, internal IDs, or DB info. The browser never receives internal/DB data.
- **Server-side validation on every step** — never trust the browser/localStorage/UI: Product+Plan (+License for renew) are re-resolved from the DB by `lib/store/checkout.ts createPendingOrder()` (server prices), OTP is enforced server-side (`lib/portal/otp.ts hasVerifiedPortalOtp`) BEFORE any pending order is created, and renewal eligibility comes from `resolveGlobalLicenseStatus()` (Rule 1).
- **One payment workflow**: the portal REUSES `createPendingOrder()` (order creation) and, for fresh purchases, the store's `fulfillOrder()` — every store/buy flow shares logic, no second payment implementation. Renewal uses `lib/store/renewal.ts` (extends the existing row; never creates a new license) which shares the same order → payment → invoice architecture.
- **Buy generates a NEW license** (`fulfillOrder`); **Renew EXTENDS the existing license** (plan / `duration_days` / `expiry_date` / `last_renewed_at` / `renewal_history`) — never a replacement. The renewal license key is bound to the order SERVER-SIDE in `orders.notes` and re-read at pay time (never trusted from the client).
- **OTP before payment where applicable**: buy and renew both require a verified OTP (purpose `purchase`) before `order/create` succeeds.
- **Public storefront untouchable**: `/api/v1/store/*` and `/api/v1/checkout/*` are re-used read-only (catalog + checkout config); they are never modified. `lib/store/checkout.ts` is imported/called, never edited.
- **SDK integration**: `Buy License` opens `store.buy_url`; `Renew License` opens `store.renew_url` (config/api-config.json) via `config.get_buy_url/get_renew_url` and `ULC._open_store/_open_renew_portal`. No placeholder URLs.
- **Publisher auto-populates portal URLs during SDK generation**: `ConfigBuilder` (`app/internal/publisher/config-builder.ts`) always writes a `store` section into the generated `config/api-config.json`, deriving `buy_url`/`renew_url` (and `url`) from the configured API base URL (`WEBSMITH_API_URL`/`NEXT_PUBLIC_API_URL`), i.e. `<base>/internal/api/buy`, `<base>/internal/api/renew`, `<base>/software-store`. No hardcoding, no placeholders, no empty strings. `sdk-validator.ts` fails generation if `store.buy_url`/`store.renew_url` are missing/empty.
- Keep this rule in sync with the master doc SECTION 0.16.

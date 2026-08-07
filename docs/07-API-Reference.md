# 07 — API Reference

Two API surfaces:

1. **Public API v1** — `app/api/v1/*`, consumed by generated SDKs and the public
   storefront. Authentication is per-request via `X-API-Key` (+ optional HMAC).
2. **Internal API** — `app/internal/backend/*`, consumed by the API Center pages.
   Authentication via the API Center JWT (`proxy.ts`).

## Public API v1

### Security model

Every protected public route follows the same pattern:

1. `X-API-Key` header → `validateApiKey` (`lib/public-api/auth.ts`) against
   `developer_api_keys`: rejects unknown key (`INVALID_API_KEY`), non-`active`
   (`API_KEY_INACTIVE`), or expired (`API_KEY_EXPIRED`). Confirms the product is
   active and records `last_used_at`.
2. **HMAC signature** (optional, checked when `X-Timestamp`, `X-Nonce`, and
   `X-Signature` are all present; `lib/public-api/signature.ts`):
   - Canonical message = `method\npath\nquery\nbodyHash\ntimestamp\nnonce`
     (`bodyHash` = sha256 hex of the JSON body).
   - Signature = base64 HMAC-SHA256 of the message using the API key as secret.
   - Timestamp window: `PUBLIC_API_SIGNATURE_TTL` (default **300 s**).
   - Nonce replay protection via the `public_api_nonces` table (`DUPLICATE_NONCE`).
   - Missing any header → `MISSING_HEADERS`.
3. **Rate limiting** (`lib/public-api/rate-limit.ts`, Upstash Redis): key
   `ratelimit:<apiKeyId>:<endpoint>` (default 1000, 60 s window); IP fallback
   `ratelimit:ip:<ip>:<endpoint>` (5000). Response headers `X-RateLimit-Limit`,
   `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
4. **Audit** (`lib/public-api/audit.ts`): writes `api_request_logs` when
   `PUBLIC_API_AUDIT_ENABLED === 'true'`; sensitive fields redacted.

### License engine

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/license` | Actions: `validate`, `activate`, `deactivate`, `renew`. Product isolation enforced (`validateProductMatch`). Status comes from the shared Global License Status service — no business logic here. |
| GET | `/api/v1/license` | API info/health. |
| POST | `/api/v1/license/deactivate` | Customer device deactivation. |
| GET | `/api/v1/license/details/[licenseKey]` | License details for the renewal dialog. |
| POST | `/api/v1/license/verify-renewal` | Renewal eligibility check (status via shared service). |
| POST | `/api/v1/license/available-plans` | List plans for renewal (HMAC-signed). |
| POST | `/api/v1/license/send-renewal-request` | Send renewal-request email (HMAC-signed). |

#### Universal status contract (Activation / Renewal / Validate entry)

Every activation, renewal, validation, and renewal-eligibility request resolves
status through the **single** Global License Status service
(`lib/license/serializer.ts` → `resolveGlobalLicenseStatus`). Routes never query
the database or decide status themselves. The response always includes:

- `status` — canonical universal status: `NO_CUSTOMER`, `TRIAL_ACTIVE`,
  `TRIAL_EXPIRED`, `ACTIVE`, `INACTIVE`, `REVOKED`, `EXPIRED`.
- `code` — machine code (`CUSTOMER_NOT_FOUND`, `TRIAL_ACTIVE`, `TRIAL_EXPIRED`,
  `LICENSE_ACTIVE`, `LICENSE_INACTIVE`, `LICENSE_REVOKED`, `LICENSE_EXPIRED`).
- `reason` — why the state exists.
- `message` — user-facing message for the SDK to render verbatim.
- `actions` — allowed next actions (`activate`, `use`, `renew`, `purchase`,
  `contact_support`, `register`).

HTTP codes are meaningful — never `200` for an invalid state:

| State | HTTP | actions |
|---|---|---|
| `NO_CUSTOMER` | 404 | `register` |
| `TRIAL_ACTIVE` | 200 | `use`, `activate` |
| `TRIAL_EXPIRED` | 409 | `purchase`, `contact_support` |
| `ACTIVE` | 200 | `activate`, `use`, `renew` |
| `INACTIVE` | 403 | `contact_support` |
| `REVOKED` | 403 | `contact_support` |
| `EXPIRED` | 409 | `renew` |

The SDK only renders this response; it never decides eligibility. Activation
requires `ACTIVE`/`TRIAL_ACTIVE`; renewal requires `ACTIVE`/`EXPIRED`.

### Trial / device

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/trial` | Actions: `start`, `status`, `convert`. |
| GET | `/api/v1/trial` | API info. |
| POST | `/api/v1/device` | Actions: `bind`, `reset`, `replace`. |
| GET | `/api/v1/device` | API info. |

### Requests / support / communication

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/request` | Universal request: `BUY, RENEW, SUPPORT, ACTIVATION, DEVICE_REPLACEMENT, HARDWARE, GENERAL` (anonymous allowed). |
| GET | `/api/v1/request` | Request history by `?email=` or `?request_id=`. |
| POST | `/api/v1/reactivations` | Request license reactivation (emails support). |
| POST | `/api/v1/support` | Create support request. |
| POST | `/api/v1/support/[requestId]/reply` | Reply to a support request. |
| GET | `/api/v1/support/[requestId]/messages` | Support message history. |
| POST | `/api/v1/communication/create` | Create a conversation (category-routed). |
| GET | `/api/v1/communication/list` | List communications. |
| GET | `/api/v1/communication/[id]` | Communication detail. |
| POST | `/api/v1/communication/[id]/reply` | Reply (category → email template map). |
| POST | `/api/v1/communication/[id]/attach` | Attach file (MIME whitelist, max 5 files × 10 MB). |

### Auth / notifications

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/otp/send` | Generate + email an OTP (`otp_verifications`). |
| POST | `/api/v1/auth/otp/verify` | Verify an OTP. |
| GET | `/api/v1/notifications` | Customer notifications by `?customer_email=`. |
| GET | `/api/v1/notifications/unread-count` | Unread count by `?customer_email=`. |
| POST | `/api/v1/notifications/read` | Mark one notification read. |

### Store / checkout / misc

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/store/products` | Public product + plan listing (no API key). |
| POST | `/api/v1/store/products` | Same listing (action `list`). |
| POST | `/api/v1/store/enquiries` | Create a sales enquiry. |
| POST | `/api/v1/checkout` | Create a PENDING order (no payment). |
| GET | `/api/v1/checkout/config` | Checkout config (countries/states/cities). |
| POST | `/api/v1/checkout/address` | Smart address lookup. |
| POST | `/api/v1/checkout/pay` | Payment capture (dummy gateway in dev). |
| GET | `/api/v1/checkout/orders` | Purchase history by `?email=`. |
| GET | `/api/v1/countries` | Supported countries. |
| GET | `/api/v1/status` | Health/service/version. |
| POST | `/api/v1/customer/register` | Register customer with onboarding data. |
| GET | `/api/v1/admin/requests` | List universal requests (`?status=`, `?request_type=`). |
| PUT | `/api/v1/admin/requests` | Update request (status, notes, reply). |

## Internal API (`/internal/backend`)

All internal routes are JWT-gated by `proxy.ts`. Public allow-list exceptions are in
`proxy.ts` `PUBLIC_PATHS` (auth flows, health, store products, license/trial
activation endpoints, test-sms, admin trials/trial-templates/cleanup).

### Auth (API Center)

| Method | Path | Purpose |
|---|---|---|
| POST | `.../api/auth/login` | Login (bcrypt + JWT). |
| POST | `.../api/auth/register` | Create admin account. |
| POST | `.../api/auth/logout` | Logout. |
| GET | `.../api/auth/verify` | Validate JWT, refresh user data. |
| POST | `.../api/auth/verify-otp` | Verify OTP. |
| POST | `.../api/auth/forgot-password` | Send password-reset OTP. |
| POST | `.../api/auth/reset-password` | Reset password with OTP. |

### API Center notifications

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `.../api/notifications` | List / create inbox notifications. |
| GET/PUT/DELETE | `.../api/notifications/[id]` | Get / mark-read / delete one. |
| PUT | `.../api/notifications/mark-read` | Mark all read. |
| GET | `.../api/notifications/unread-count` | Unread count. |

### Communications

| Method | Path | Purpose |
|---|---|---|
| GET/DELETE | `.../communications/conversations` | List (filters + pagination) / purge trash. |
| GET | `.../communications/conversations/stats` | Inbox/sent/waiting/failed/queued/unread stats. |
| GET/DELETE/PATCH/POST | `.../communications/conversations/[id]` | Detail / delete / restore, read, archive / retry. |
| GET | `.../communications/delivery-logs` | `notification_logs` viewer. |
| GET/POST | `.../communications/folders` | List / create folders. |
| PATCH/DELETE | `.../communications/folders/[id]` | Update / soft-delete (system folders protected). |
| GET | `.../communications/queue` | Message queue list. |
| POST | `.../communications/queue/process` | Deliver due queue batch. |
| GET/POST | `.../communications/settings` | Get / save communications settings (`system_settings`). |

### Mailboxes

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `.../mailboxes` | List / create (duplicate email rejected). |
| POST | `.../mailboxes/test-connection` | Verify un-saved IMAP+SMTP credentials. |
| GET/PATCH/DELETE | `.../mailboxes/[id]` | Detail / update / delete (passwords masked). |
| POST | `.../mailboxes/[id]/disable` / `enable` | Toggle enabled. |
| POST | `.../mailboxes/[id]/set-default` | Set default sender. |
| POST | `.../mailboxes/[id]/send` | Send email via mailbox SMTP; queues on failure. |
| POST | `.../mailboxes/[id]/send-test` | Test email. |
| POST | `.../mailboxes/[id]/sync` | IMAP sync INBOX → conversations/messages. |
| POST | `.../mailboxes/[id]/test` | Test stored mailbox connections. |
| GET | `.../mailboxes/[id]/logs` | Paginated sync logs. |

### Admin

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `.../admin/api-keys` | List / create public API keys. |
| POST | `.../admin/api-keys/[id]/revoke` | Revoke a key. |
| POST | `.../admin/api-keys/[id]/rotate` | Rotate a key secret. |
| GET/POST | `.../admin/event-config` | Event notification config (GET seeds defaults; PUT upserts toggles). |
| GET/POST/PATCH/DELETE | `.../admin/invoices` / `[id]` | Invoice CRUD + actions (send-email, mark-paid, generate-license, cancel, archive). |
| GET/PUT | `.../admin/payment-config` | Payment settings (provider, keys, currency, tax). |
| POST | `.../admin/create-license` | Manually create a license (triggers `license_created`). |
| POST | `.../admin/reset-device` / `replace-device` | Device ops (`device_reset` / `device_changed`). |
| GET/POST | `.../admin/store/gateways` | List / seed payment gateway registry. |
| GET/POST | `.../admin/products`, `.../admin/products/[id]/plans` | Product/plan management. |
| GET | `.../admin/trials`, `.../admin/trials/trial-templates` | Trials management (public allow-list). |
| GET | `.../admin/dashboard`, `.../admin/revenue`, `.../admin/stats/products` | Reporting. |
| POST | `.../admin/sms/send`, `GET/PUT .../admin/sms/templates` | SMS send + templates. |
| GET | `.../logs` | Audit log viewer. |

### Store

| Method | Path | Purpose |
|---|---|---|
| GET/POST/DELETE | `.../store/cart` | Cart by `session_id` (+items). |
| GET/POST | `.../store/coupons` | List / create coupons. |
| GET/POST | `.../store/enquiries` | List / create sales enquiries. |
| GET/PUT | `.../store/gateways` | List / configure gateways. |
| GET/POST | `.../store/invoices` | List / create invoices. |
| GET/POST | `.../store/orders` | List / create orders. |
| GET | `.../store/orders/[id]/items` / `payments` | Order line items / payments. |
| GET/POST | `.../store/products` | List products + active plans. |
| GET/POST | `.../store/subscriptions` | List / create subscriptions. |

### License / trial (internal)

| Method | Path | Purpose |
|---|---|---|
| GET | `.../license/status` | **Single source of truth** license status by `hardware_id` — delegates to shared `resolveGlobalLicenseStatus()`. |
| GET/POST | `.../licenses/validate`, `activate`, `deactivate`, `reactivation`(+`/submit`) | License operations (public allow-list). `validate`/`activate` resolve status via the shared service; `activate` rejects unless `ACTIVE`/`TRIAL_ACTIVE`. |
| POST | `.../licenses/renew`, `.../licenses/[key]` ops | Renewal + per-key operations. `renew` resolves status via the shared service and rejects unless `ACTIVE`/`EXPIRED`. |
| POST | `.../trials/start`, `status`, `convert`, `register`, `analyze`, `journey`, `suspicious` | Trial operations (public allow-list). |

### Health

| Method | Path | Purpose |
|---|---|---|
| GET | `.../health` | Health check. |
| POST | `.../test-sms` | Send test SMS. |

## Errors

- Public API errors return machine-readable codes: `INVALID_API_KEY`,
  `API_KEY_INACTIVE`, `API_KEY_EXPIRED`, `PRODUCT_MISMATCH`, `MISSING_HEADERS`,
  `DUPLICATE_NONCE`, plus validation/not-found errors from each handler.
- Internal API responses use `{ success: boolean, error?: string, data? }`.

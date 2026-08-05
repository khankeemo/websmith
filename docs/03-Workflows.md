# 03 — Workflows

End-to-end flows across the platform. All endpoint references resolve in
`07-API-Reference.md`.

## 1. SDK generation (publisher workflow)

```mermaid
sequenceDiagram
    participant Admin as API Center admin
    participant PUB as Publisher (index.ts)
    participant DB as Neon PostgreSQL
    participant Q as Upstash QStash
    participant JOB as SDK job runner

    Admin->>PUB: POST publish (productId, apiKey, runtime, options)
    PUB->>DB: validate product + API key (validator.ts)
    PUB->>DB: fetch plans + active countries
    Note over PUB,JOB: stages: validate → config → runtime → manifest → zip → validate-sdk
    PUB->>Q: enqueue SDK job (sdk_jobs pending)
    Q->>JOB: POST /api/upstash/workflow
    JOB->>JOB: run stages with checkpoint/resume + persisted artifacts
    JOB->>DB: update stage_metrics / stage_errors / stage_artifacts
    JOB->>DB: completeJob (zip path, checksum, packageId)
    Note over JOB: on timeout, next worker resumes from last checkpoint
```

- Only completed stages are skipped on resume; the `runtime` stage is re-run if the
  ephemeral `/tmp` output directory is missing.
- Success cleans the temp directory; failure records the failing stage and marks the
  job failed (`failJob`). Both paths write `api_request_logs`.

## 2. Trial flow

```mermaid
sequenceDiagram
    participant C as Customer (SDK)
    participant V1 as /api/v1
    participant OTP as /api/v1/auth/otp
    participant DB as Database

    C->>V1: POST /api/v1/trial { action: 'start', name, email, mobile, hardware_id }
    V1->>DB: create trial (trial_templates apply)
    V1-->>C: trial created (has_trial, status active)
    C->>OTP: POST /api/v1/auth/otp/send (email)
    OTP-->>C: OTP email (Brevo)
    C->>OTP: POST /api/v1/auth/otp/verify
    OTP->>DB: verify otp_verifications row
    V1->>DB: bind hardware_id to trial
    Note over V1: auto-convert to paid runs when configured + after expiry
    V1->>DB: audit + notification (trial_started)
```

- SDK detection uses `has_trial` **and** `status === 'active'` (bug fix history: the API
  returns `has_trial`, not `active`).
- Trial status is read from the backend; the cache is never authoritative.

## 3. License activation flow

```mermaid
sequenceDiagram
    participant C as Customer (SDK)
    participant V1 as /api/v1/license
    participant OTP as /api/v1/auth/otp
    participant DB as Database

    C->>V1: POST /api/v1/license { action: 'validate', license_key, hardware_id }
    V1->>DB: validate key + product isolation + hardware match
    V1-->>C: validation result (or PRODUCT_MISMATCH / NOT_FOUND)
    C->>V1: POST /api/v1/license { action: 'activate', license_key, hardware_id }
    V1->>OTP: send + verify OTP (email)
    V1->>DB: activation row (activations), hardware binding, status → active
    Note over C: fresh activation clears cached license state, preserves hardware_id
    V1-->>C: success (SuccessDialog with restart option)
    V1->>DB: audit + notification (activation_success)
```

- Hardware binding is **permanent**; a hardware mismatch invalidates only the cached
  status and surfaces "Hardware replacement requires administrator approval."
- After activation the SDK reloads live status from
  `GET /internal/backend/license/status`.

## 4. Renewal flow

```mermaid
sequenceDiagram
    participant C as Customer (SDK)
    participant V1 as /api/v1
    participant DB as Database

    C->>V1: POST /api/v1/license/verify-renewal { license_key }
    V1->>DB: eligibility check (status, expiry)
    C->>V1: POST /api/v1/license/available-plans { license_key }
    V1-->>C: plans
    C->>V1: POST /api/v1/license { action: 'renew', license_key, plan_id }
    V1->>DB: extend expiry, renewal_history row
    V1->>DB: audit + notification (license_renewed)
```

## 5. Checkout / purchase flow

```mermaid
sequenceDiagram
    participant S as Storefront (public)
    participant V1 as /api/v1/store + /api/v1/checkout
    participant CHK as lib/store/checkout.ts
    participant DB as Database

    S->>V1: GET /api/v1/store/products (public, no API key)
    S->>V1: POST /api/v1/checkout { items, customer, coupon_code }
    CHK->>DB: loadTaxConfig (payment_config)
    CHK->>DB: resolve prices server-side (products/plans)
    CHK->>DB: validateCoupon + increment current_uses
    CHK->>DB: upsertCustomer + insert orders(status pending) + order_items
    CHK-->>S: order (pending) + totals
    S->>V1: POST /api/v1/checkout/pay { order_number }
    CHK->>DB: fulfillOrder (transaction) → generate license(s) + customer_licenses
    CHK->>DB: insert payments (method "Test (Development)" for dummy gateway)
    CHK->>DB: orders → completed, insert invoices(status paid)
    CHK->>DB: create communication_conversation + message
    CHK->>DB: notifications (payment_success, license_created)
```

- **Invariant**: no payment → no license (license generation lives inside
  `fulfillOrder`, `lib/store/checkout.ts:363`).
- The checkout defaults to the **dummy gateway** (`payment_gateway = 'dummy'`); no real
  payment provider is integrated (see `04-Roadmap.md`).

## 6. Add a mailbox (admin workflow)

```mermaid
sequenceDiagram
    participant A as Admin (Communications > Mailboxes)
    participant BE as /internal/backend/mailboxes
    participant IMAP as imap + nodemailer

    A->>BE: POST test-connection { provider, imap_*, smtp_* }
    BE->>IMAP: verify IMAP (login) + SMTP (transport verify) in parallel
    BE-->>A: { imap: ok/fail(reason), smtp: ok/fail(reason), overall }
    alt verification failed
        Note over A,BE: UI blocks save, inline error shows exact IMAP/SMTP reasons
        BE-->>DB: audit mailbox_create_failed
    else verification passed
        A->>BE: POST /internal/backend/mailboxes (persist)
        BE->>DB: insert mailbox (duplicate email rejected, default sender handled)
        BE-->>A: created
        BE-->>DB: audit mailbox_created
    end
```

- Audit events: `mailbox_connection_test`, `mailbox_created`, `mailbox_create_failed`
  (readable at `GET /internal/backend/logs`).
- Error/success toasts render above open modals (`z-[100]`).
- Passwords are masked (`********`) and never rendered in plaintext; masked/blank
  passwords are stripped from PATCH payloads.

## 7. Communications: inbound email → conversation

1. `POST /internal/backend/mailboxes/[id]/sync` runs an IMAP sync of INBOX (UNSEEN).
2. Messages are parsed (`mailparser`), mapped to a `communication_conversations` row
   (by category, customer email, subject heuristics).
3. `conversation_messages` rows are inserted; `mailbox_sync_logs` and
   `connection_status`/`last_sync` are updated.
4. The API Center's auto-sync loop repeats this for every enabled mailbox every 45 s.

## 8. Support / sales / universal request flow

- SDK / customer posts `POST /api/v1/request` (types `BUY, RENEW, SUPPORT, ACTIVATION,
  DEVICE_REPLACEMENT, HARDWARE, GENERAL`) or `POST /api/v1/communication/create`.
- The communication is category-routed to the matching conversation folder and emails
  the right mail account (support vs sales) via `EMAIL_ROUTES`/`TYPE_CATEGORY` maps.
- Customers can follow up via `[id]/reply` and attach files
  (`[id]/attach` — MIME whitelist, 5 files × 10 MB).
- Admins reply inside the Communications Center; delivery is queued if SMTP fails.

## Related docs

- `02-Architecture.md`
- `06-Administrator-Guide.md`
- `07-API-Reference.md`
- `09-AWS-01-Rules.md` (Rules 1–10 ULC event messaging, Rule 10 validation scenarios)

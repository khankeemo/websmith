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
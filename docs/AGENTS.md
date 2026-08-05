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
- **Architecture hierarchy**: Master Doc → Language Templates → SDK Publisher →
  Generated SDK. Never edit Generated SDKs directly; never embed business logic
  in runtime generators.
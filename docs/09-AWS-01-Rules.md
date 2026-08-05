# 09 — AWS-01 Rules Reference

This is a condensed, navigable reference. The authoritative text lives in
`UNIVERSAL_LICENSE_PLATFORM_IMPLEMENTATION.md` (§ "AWS-01 — Mandatory Execution
Rules") and `AGENTS.md`. Never change a rule here without updating both of those.

## Governance

- **Rule 0 — ALWAYS READ THE FINAL MD FILES FIRST.** Before creating/modifying/deleting
  any code, config, template, route, or doc: read the master implementation document
  for the domain, read `AGENTS.md`, and do not write code from assumptions.
- **Rule ALWAYS-UPDATE.** Every time a rule, architecture, workflow, or behavior
  changes, update **both** `AGENTS.md` and the master doc on the same task. Docs must
  never lag behind code.

## Mandatory Execution Rules (1–19)

1. **Architecture First** — Read the master doc before starting; verify the work
   matches the documented architecture; if not, update the document first. Code is
   never the source of truth.
2. **No Assumptions** — never assume tables, fields, routes, request/response formats,
   env vars, runtime behavior, imports, exports, dependencies, business logic,
   workflows, configuration, or SDK behavior. Stop, verify, ask.
3. **MD Files Are the Source of Truth** — if implementation differs from docs, update
   docs first, then code.
4. **Dependency Verification** — before removing/changing any file, verify imports,
   exports, barrel exports, runtime generators, templates, generated SDK, language
   generators, build references, documentation references.
5. **Verify Before Coding** — confirm architecture/database/API/publisher/generated
   SDK/runtime/documentation match, then code.
6. **Architecture Hierarchy** — Master Doc → Language Templates → SDK Publisher →
   Generated SDK. Never edit generated SDKs; never embed business logic in runtime
   generators; templates are the only implementation source; configuration is injected
   by the publisher; generation fails on duplicate implementation or runtime drift.
7. **Documentation First** — new workflow/endpoint/table/env var/cache key/email
   template/runtime behavior/business rule ⇒ update the master doc (get approval if
   required) before implementing.
8. **Completion Verification** — a task is complete only when: build passes; syntax,
   import, and runtime verification pass for all affected languages; fresh SDK
   generates without errors; generated SDKs pass language validation; internal API
   verified for success and failure; no schema drift; email (incl. OTP + failure
   logging + mail-address routing) verified; store verified if affected; master doc
   updated; progress updated; commit only on green; Vercel deployed; production
   verified post-deployment.
9. **Never Guess** — below 100% confidence: stop, don't invent, don't approximate,
   verify first.
10. **Always Report Progress** — every completed task reports Completed / Remaining /
    Blockers / Percentage / Next.
11. **Template-First Architecture** — every runtime implementation exists only in
    templates; generators orchestrate; one business logic → one implementation; fail on
    duplicates or drift.
12. **UI Freeze** — production UI is frozen; no redesign/resize/move/rename/remove
    without updating the master doc first.
13. **Syntax Verification** — verify syntax/imports/exports/runtime generation/generated
    SDK for every affected language before completion.
14. **Template Integrity** — generators only load templates, replace placeholders,
    validate, package; never inline-generated code, business logic, or duplicated
    template implementations.
15. **Temporary Files Cleanup** — no temp/debug/scratch files left behind; production
    branches and packages contain zero temporary artifacts.
16. **Completed Task Verification** — generated SDK must pass language-specific
    validation (Python: syntax + imports; TypeScript: compilation + imports; others:
    syntax + exports) before marking complete.
17. **Dialog Ownership** — only one primary licensing dialog at a time; closing the
    primary closes all children; no hidden or orphan dialogs.
18. **Close Behaviour** — closing ULC when it is the only window: stop workers, destroy
    all SDK dialogs and the hidden root, flush cache, exit cleanly; no orphan processes
    or surviving background threads.
19. **Architecture Freeze** — after Phase 15: no architecture, UI, or workflow redesign,
    no runtime drift, no new dialog types.

## ULC Event Messaging & Activation Rules (final)

Source: master doc **SECTION 0B**; mirrored in `AGENTS.md`.

1. Backend `GET /internal/backend/license/status` is the single source of truth; never
   compute license/plan/days/validity locally except absent-optional fallbacks.
2. Hardware binding is permanent; never unbind/re-bind/clear it locally; a hardware
   mismatch only invalidates the cached `license_status` key. Message: "Hardware
   replacement requires administrator approval."
3. A **fresh** license activation clears the old cached license state
   (license/plan/customer/expiry/activation) then reloads from the backend; preserve
   only the hardware ID and the offline message queue.
4. & 9. Every user-visible message is also written to the shared `LiveLog` (and the
   external forwarder); UI and LiveLog stay in sync per flow.
5. Pass through real server messages verbatim; never substitute a generic local string
   for a server-provided message.
6. Show a live "working…" progress state for operations expected to take >1 s.
7. Successful trial/activation/renewal always shows the `SuccessDialog` summary.
8. Errors explain what / why / next; avoid bare "Error"/"Failed"/"Unknown".
10. Run the 14 end-to-end validation scenarios before delivery.

## Communications Center invariants

- UI/UX-only scope: never alter SMTP/IMAP, queue, schema, auth, or notification
  engines/APIs from the Communications UI work.
- Public storefront (`www.websmithdigital.com/software-store`, PostgreSQL `products`,
  `/api/v1/store/*`, `/api/v1/checkout/*`) is untouchable.
- Built-in mailboxes (`support@`, `sales@`, `no-reply@`) are app-config defaults; never
  delete accounts.
- Never render mailbox passwords in plaintext; mask (`********`) and strip
  blank/masked passwords from PATCH payloads.
- Unread is derived from replies (GREATEST subquery); stats handler is force-dynamic.
- **Add Mailbox workflow**: verify IMAP+SMTP via `POST
  /internal/backend/mailboxes/test-connection` before save; failure blocks save with the
  specific reason; success saves via the unchanged create route; all events log to
  `audit_logs` (`mailbox_created`, `mailbox_create_failed`, `mailbox_connection_test`);
  toasts must stay above modals (`z-[100]`).
- Architecture hierarchy: never edit generated SDKs; never embed business logic in
  runtime generators.

## Checklist before any change

1. Read master doc + `AGENTS.md` for the domain.
2. If the change alters documented behavior → update docs first.
3. Implement following Rules 1–19.
4. Run full completion verification (Rule 8) incl. `npx tsc --noEmit` + `npm run build`.
5. Update this library, `AGENTS.md`, and the master doc on the same task.

# Websmith License Platform — AWS-01 Continuation Work Report

- **Date:** 2026-08-01
- **Scope:** Baseline verification, SDK template/generator sync fixes, ULC pre-activation dialog, renewal UX review, test infrastructure, logic review, documentation
- **Starting commits:** `f386e2a` (websmith, deployed to Vercel prod `websmith-22sjo67ac`, live at https://websmith-z.vercel.app) / `34860f7` (ZEMmacOS)

---

## 1. Baseline Verification (re-confirmed)

| Check | Result |
|-------|--------|
| websmith Git HEAD == Vercel prod deployment | OK — `f386e2a` deployed 11s after commit |
| Live URL (websmith-z.vercel.app) matches SDK config | OK |
| Public License API `GET /api/v1/license` | 200 OK (actions: validate, activate, deactivate, renew) |
| Store products endpoint (DB-backed) | 200 OK — `prod_zemmacos`, `prod_websmithaireceptionist` + plans present |
| ZEMmacOS HEAD | `34860f7` |

Note: the local env files are scrubbed; the production `DATABASE_URL` is a protected Vercel secret that cannot be pulled with `vercel env pull` (returns an empty value). The app's real database is Neon PostgreSQL.

## 2. SDK Template / Generator Fixes (Phase 3)

| File | Change | Root Cause |
|------|--------|------------|
| `app/internal/publisher/template/python/manifest.json` | `"generated_at": ""` → `"generated_at": "{{GENERATED_AT}}"` | Template never carried a placeholder for the generation timestamp |
| `app/internal/publisher/runtimes/python.ts` | Added `{{GENERATED_AT}}` to `buildPlaceholders()`; added `isDocumentationFile()` guard | Docs files were placeholder-substituted, corrupting the docs reference table (tokens like `{{PRODUCT_NAME}}` are documentation text and must be preserved verbatim) |
| `scripts/generate-sdk.mjs` | Same `{{GENERATED_AT}}` + `isDocumentationFile()` changes to the local generator | Local generator must stay identical to the production runtime |
| `D:\ZEMmacOS\WSD_SDKToolkit_ZEMMACOS` | Deleted stale SDK; regenerated fresh (36 files) | Old SDK had drift + `__pycache__` leftovers |

### Verification

- 22/22 Python files compile clean (`py_compile`)
- Hash comparison template vs generated: **only `manifest.json` differs** (the `{{GENERATED_AT}}` → real ISO timestamp substitution); all other 35 files byte-identical; no missing/extra files
- No `__pycache__` in the delivered SDK (any found during verification are removed)
- All public imports load: `ApiClient`, `LicenseEngine`, `UniversalLicenseCenter`, etc.

## 3. Pre-Activation / Pre-Renewal Dialog (Phase 6)

`universal_license_center.py` (template + regenerated SDK):

- `_activate_license()` and `_renew_license_flow()` now open a choice dialog before the key/OTP workflow:
  - **[ Buy License ]** → opens the software store in the default browser. The store URL is derived at runtime from the configured API config (`client.app_url` → `/software-store`) — **no hardcoded URLs**.
  - **[ Existing License ]** → proceeds to the existing Validate → OTP → Activate/Renew flow.
- Verified: `app_url` exists on `ApiClient` (falls back to `base_url`); `/software-store` route exists in the websmith app; all color attributes used by the dialog exist on the ULC class.

## 4. Renewal Workflow Review (Phase 5)

- Renewal already enforced: Validate License API → Send OTP (registered email) → Verify OTP → Proceed with Renewal; new customers are routed to Activation.
- **Gap fixed:** after validation in renewal mode, the ULC now fetches the dedicated `verify_license_for_renewal()` endpoint and displays renewal details in the dialog: expiry status (EXPIRED — eligible for renewal), current days left, and available renewal plan options (name, duration, current-plan marker). The user confirms renewal with full information; the success dialog then shows the new expiry date and days remaining.
- Backend review: `action: renew` adds the plan default (365 days) from `max(expiry, now)`; supports `extra_days`; writes `renewal_history` + audit. No logic bugs found.

## 5. Test Infrastructure (Phase 4)

### SDK Generation Validator — `tests/sdk-generation/validator.test.mjs` (NEW)

Interpreter-free Node test that runs the generator into a temp dir and asserts:

1. All template files present in the output (same relative paths)
2. No build artifacts (`__pycache__`) in the SDK
3. Docs files copied verbatim (no placeholder substitution)
4. No unreplaced `{{...}}` tokens in non-doc files (except the sanctioned `manifest.json` `{{GENERATED_AT}}`)
5. Non-doc files exactly match the template with the placeholder map applied
6. `manifest.json.generated_at` is a real ISO-8601 timestamp

**Result: 6/6 PASS.** Wired to `npm test` / `npm run test:generation`.

### E2E Suite — `tests/e2e/license-api.e2e.mjs` (NEW, ready to run)

Seeds an isolated E2E product/plan/API key/license directly in the production DB, exercises the live public API (auth failures, validate, activate, idempotent re-activation, device-limit block, deactivate, renew +365, renew +extra_days, verify-renewal, trial start + duplicate rejection + status, store products), then removes every seeded row including audit trails.

**Status: NOT RUN — blocked on credentials.** `vercel env pull` cannot decrypt the production `DATABASE_URL` (protected secret; returns an empty value; local env files and git history are scrubbed). Run command when credentials are available:

```
vercel env pull .env.e2e --environment=production
node --experimental-strip-types tests/e2e/license-api.e2e.mjs
```

## 6. Logic Review (Phase 2)

Reviewed the ULC activation/renewal wiring end to end after the dialog changes: pre-dialog → key flow → validate → (renew: renewal details) → OTP → final action. All paths verified correct: color attributes exist, `verify_license_for_renewal` exists on the client, backend normalizes key case, "Buy License" keeps the dialog open for return, new-customer renewal redirects to activation. No additional bugs found this session.

## 7. Files Changed

| Path | Change |
|------|--------|
| `app/internal/publisher/template/python/manifest.json` | `{{GENERATED_AT}}` placeholder |
| `app/internal/publisher/runtimes/python.ts` | `{{GENERATED_AT}}` + docs verbatim guard |
| `scripts/generate-sdk.mjs` | Same |
| `app/internal/publisher/template/python/universal_license_center.py` | Pre-activation/renewal dialog + renewal details display |
| `tests/sdk-generation/validator.test.mjs` | NEW — generator validator (6/6 pass) |
| `tests/e2e/license-api.e2e.mjs` | NEW — live E2E suite (blocked on DB credentials) |
| `D:\ZEMmacOS\WSD_SDKToolkit_ZEMMACOS` | Regenerated SDK (36 files, in sync with template) |
| `docs/report.md` | This report |

## 8. Remaining Work

- Run `tests/e2e/license-api.e2e.mjs` once `DATABASE_URL` is obtainable (user paste or decryptable Vercel secret).
- Commit `D:\websmith` changes and the regenerated `D:\ZEMmacOS` SDK.

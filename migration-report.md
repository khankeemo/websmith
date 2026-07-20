# Migration Report — SQL Changes Required

**Date:** 2026-07-13
**Scope:** Fix all schema issues found in audit

---

## Migration 1: Remove Dead Columns

*Kept despite low usage: `customers.country_code` (needed for OTP/SMS/onboarding), `customers.hardware_id` (future device binding), `countries.dial_code` (SDK country selectors)*

```sql
-- products: public_product_id never used
ALTER TABLE products DROP COLUMN IF EXISTS public_product_id;

-- licenses: customer_username never used
ALTER TABLE licenses DROP COLUMN IF EXISTS customer_username;

-- customers: remove only truly dead (no roadmap value)
ALTER TABLE customers DROP COLUMN IF EXISTS company_name;   -- duplicate of `company`
ALTER TABLE customers DROP COLUMN IF EXISTS last_login;      -- never populated, no roadmap use

-- Kept: country_code (OTP/SMS), hardware_id (binding/replace)
-- Kept: countries.dial_code (SDK onboarding)
```

## Migration 2: Add Missing Columns to `trials`

```sql
-- trials: add missing columns used in code
ALTER TABLE trials ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP;
ALTER TABLE trials ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE trials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

## Migration 3: Ensure `sdk_runtime_settings` Has Correct Types + Index

```sql
-- Ensure product_id is TEXT (not UUID) for cross-table consistency
ALTER TABLE sdk_runtime_settings ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;

-- Ensure UNIQUE constraint is backed by an explicit index
CREATE UNIQUE INDEX IF NOT EXISTS sdk_runtime_settings_product_id_idx
ON sdk_runtime_settings(product_id);
```

## Migration 5: Keep Write-Only Trials Columns

The following `trials` columns are INSERTed/UPDATE'd but never SELECTed in current UI code.
They are **valuable audit fields** for a licensing platform and must **not** be dropped:

| Column | Written By | Audit Value |
|--------|-----------|-------------|
| `sdk_version` | `v1/trial INSERT` | Track which SDK version started the trial |
| `runtime_type` | `v1/trial INSERT` | Track Python vs Node vs Java runtime |
| `activation_source` | `v1/trial INSERT` | Track onboarding vs API vs UI origin |
| `trial_template_id` | `v1/trial INSERT` | Link to trial_templates for config audit |
| `suspicious_flag` | `analyze UPDATE` | Fraud detection signal |
| `suspicious_reason` | `analyze UPDATE` | Why flagged as suspicious |
| `suspicious_logged_at` | `analyze UPDATE` | When flagged |
| `notified_admin` | `analyze UPDATE` | Whether admin was notified |

No migration needed. These columns should be surfaced in the admin dashboard in a future UI update.

## Migration 4: Deprecate Unused Table (No Drop)

```sql
-- wishlist: no API serves this table (UI uses localStorage).
-- Mark as DEPRECATED instead of dropping.
-- Remove only after confirming no future store roadmap uses it,
-- no analytics rely on it, and no hidden API routes reference it.
COMMENT ON TABLE wishlist IS 'DEPRECATED: No backend API serves this table. Remove after Q3 2026 validation.';
```

---

## Migration Execution Order

1. Migration 1 (remove dead columns) — safe, no data loss (columns never populated)
2. Migration 2 (add missing columns) — additive, no risk
3. Migration 3 (type fix + index) — requires `USING` clause for type cast
4. Migration 4 (drop table) — only after confirming no remaining references

All migrations should be wrapped in `try/catch` with `IF EXISTS` guards for idempotent re-runs.

---

## Affected Code Changes (to match new schema)

| File | Change |
|------|--------|
| `lib/backend-db/index.ts` | Remove `public_product_id` from products CREATE TABLE; remove `customer_username` from licenses; remove `company_name`, `country_code`, `hardware_id`, `last_login` from customers; remove `dial_code` from countries; remove `wishlist` table; add `expired_at`, `created_at`, `updated_at` to trials; add unique index for sdk_runtime_settings |
| `app/api/v1/customer/register/route.ts` | Remove `company_name` from INSERT |
| `app/internal/backend/trials/start/route.ts` | Remove `company_name` from INSERT |

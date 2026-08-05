# 05 — Deployment

## Hosting

- **Platform**: Vercel (Next.js build). Production alias:
  `https://websmith-z.vercel.app`. The repo remote is `github.com/khankeemo/websmith.git`.
- **Deploy command**: `npx vercel --prod` (deployed as the `khankeemo` scope).
- **Verification after deploy**: health endpoint returns 200, then run the AWS-01
  production verification checklist (API, database, SDK download, SDK runtime,
  activation, hardware, email, OTP).

## Environment variables

`.env.local` keys (names only — never commit values):

| Variable | Used by |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (`lib/backend-db`, routes, migrations). |
| `JWT_SECRET` | General JWT signing. |
| `API_CENTER_JWT_SECRET` | `proxy.ts` API Center JWT verification. |
| `PORT` | Local server port. |
| `VERCEL_OIDC_TOKEN` | Vercel OIDC (deploy-time auth). |
| `NEXT_PUBLIC_API_URL` | SDK base URL + QStash callback target (`lib/public-api/queue.ts`). |
| `QSTASH_TOKEN` | Upstash QStash publish. |
| `QSTASH_CURRENT_SIGNING_KEY` | QStash webhook signature verification. |
| `PUBLIC_API_SIGNATURE_TTL` | HMAC timestamp window, default `300` (seconds). |
| `PUBLIC_API_AUDIT_ENABLED` | `'true'` to write `api_request_logs`. |
| `BREVO_API_KEY` | Brevo transactional email (`lib/email/brevo.ts`). |
| `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` | Default no-reply sender (fallback `SENDER_EMAIL` / `BREVO_SENDER_NAME`). |
| `MAIL_SUPPORT_ADDRESS` / `MAIL_SUPPORT_NAME` | Support sender. |
| `MAIL_SALES_ADDRESS` / `MAIL_SALES_NAME` | Sales sender. |
| `BRANDING_COMPANY_NAME`, `BRANDING_WEBSITE_URL` | Email brand footer. |
| `FAST2SMS_API_KEY`, `FAST2SMS_SENDER_ID` | Fast2SMS SMS sending. |
| `WEBSMITH_CONTROLKIT_VERSION` | SDK kit version (falls back to `package.json#version`). |
| `WEBSMITH_PACKAGE_EXPIRY` | Published-package expiry seconds (default `3600`). |

> Emails are skipped (logged) when `BREVO_API_KEY` is absent. SMS only sends when
> `sms_config.enabled = true` in the database.

## Database

- Single **Neon PostgreSQL** serverless database. All access goes through
  `lib/backend-db/index.ts` `getDb()` (one pool, `ssl rejectUnauthorized: false`).
- Schema is created on first use: `getDb()` runs versioned migrations via
  `lib/migrations/runner.ts` (idempotent `CREATE TABLE IF NOT EXISTS` +
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- Full schema inventory: `08-Database.md`.

## Background processing

- **SDK jobs**: `POST /api/upstash/workflow` is the QStash callback. Jobs persist
  checkpoints and stage artifacts in `sdk_jobs` so workers resume after timeout.
- **Rate limiting / nonce cache**: Upstash Redis keys
  `ratelimit:<apiKeyId>:<endpoint>` (60 s window) and `ratelimit:ip:<ip>:<endpoint>`.
- **Queue processing / mailbox sync**: triggered from the API Center client
  (auto-sync loop every 45 s and on tab visibility) via
  `/internal/backend/communications/queue/process` and
  `/internal/backend/mailboxes/[id]/sync`.

## Health & monitoring

- `GET /internal/backend/health` — public health check.
- `GET /api/v1/status` — public service/version health.
- Audit trail: `GET /internal/backend/logs` (audit events, mailbox events included).
- Delivery/notification history: `GET /internal/backend/communications/delivery-logs`.

## Deployment checklist (AWS-01 Rule 8)

1. `npx tsc --noEmit` — zero type errors.
2. `npm run build` — green (274 pages).
3. Tests: `npm test` → `node --experimental-strip-types tests/sdk-generation/validator.test.mjs`.
4. Update `docs/` + master MD + `AGENTS.md` for any behavior change.
5. Commit, push, `npx vercel --prod`, then production verification.

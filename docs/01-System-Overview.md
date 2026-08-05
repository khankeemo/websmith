# 01 — System Overview

## What this platform is

The **WebSmith Universal License Platform** is a licensing, sales, and communications
platform for desktop and server software products. It lets a software vendor
("product owner") publish per-product **Software Development Kits (SDKs)** that
enforce licensing inside their own applications, manage customers, trials, hardware
binding, activations, renewals, sales/checkout, email/SMS notifications, and a unified
communications center — all from a single internal **API Center**.

## The main areas

| Area | Path (source of truth) | Purpose |
|---|---|---|
| **Internal API Center** | `app/internal/api/*` (pages) + `app/internal/backend/*` (routes) | Password-protected admin console. |
| **SDK Publisher** | `app/internal/publisher/*` | Generates, validates, and packages per-product SDKs for 13 runtimes. |
| **Public API (v1)** | `app/api/v1/*` | Customer-facing endpoints used by the generated SDKs and the public storefront. |
| **Public storefront** | `www.websmithdigital.com/software-store` (untouchable) | Working public product store (products + `/api/v1/store/*` + `/api/v1/checkout/*`). |
| **Communications Center** | `app/internal/backend/communications/*`, `app/internal/backend/mailboxes/*` | Unified inbox, mailboxes (IMAP/SMTP), queue, delivery logs. |
| **Notifications** | `lib/notification/notification-service.ts` | Event-driven email (Brevo) + SMS (Fast2SMS) notifications. |
| **Database** | `lib/backend-db/index.ts`, `lib/migrations/runner.ts` | Single Neon PostgreSQL database (serverless). |

## What an SDK does

A generated SDK is a language kit (e.g. Python, Node, Go…) that ships inside a
vendor's application. It provides:

- **LicenseEngine** — the decision engine: validate, activate, renew, trial, hardware
  binding, offline grace, cache, and status.
- **UniversalLicenseCenter (ULC)** — the customer-facing license dialog.
- **UniversalEmailDialog** — one email component for every request category.
- **HardwareDetector**, **CacheManager**, **API client** (HMAC signed), **LiveLog**,
  and per-workflow modules (activation, renewal, trial, reactivation, sales, support).

The SDK talks to the platform's **Public API v1** endpoints. All SDK logic is authored
in the **language templates** under `app/internal/publisher/template/<runtime>/`; the
publisher injects configuration and never contains business logic.

## High-level numbers

- **13 runtimes**: python, node, php, java, dotnet, go, rust, cpp, c, javascript,
  typescript, bun, deno (`app/internal/publisher/runtimes/index.ts`).
- **22 notification event types**, each configurable for email and/or SMS.
- **~50 database tables** (see `08-Database.md`).
- **~40 public `/api/v1` endpoints** and ~120 internal `/internal/backend` routes.
- **274 pages** build cleanly (`npm run build`).

## Key cross-cutting concepts

- **Auth gate**: `proxy.ts` guards every `/internal/*` request with the API Center JWT
  (`api_center_token`), except an allow-listed set of public paths.
- **Public API security**: `X-API-Key` + HMAC signatures + nonce replay protection +
  per-key rate limiting (see `07-API-Reference.md`).
- **License status single source of truth**: `GET /internal/backend/license/status`.
- **No payment = no license**: license provisioning happens inside checkout fulfillment.
- **Source-of-truth hierarchy**: Master MD → templates → publisher → generated SDK.

## Related docs

- `02-Architecture.md` — structure and stack.
- `03-Workflows.md` — end-to-end flows.
- `09-AWS-01-Rules.md` — mandatory execution rules.

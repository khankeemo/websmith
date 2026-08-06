# 06 — Administrator Guide

This guide covers operating the **Internal API Center** (`/internal/*`). Every page is
protected by the API Center JWT (see `proxy.ts`); log in at
`/internal/api/auth/login`.

## Getting started

- **Create an account**: `POST /internal/backend/api/auth/register` (name, email,
  password) or the public register page. Passwords are bcrypt-hashed; sessions are
  JWT (`api_center_token` cookie).
- **Password reset**: `/internal/backend/api/auth/forgot-password` sends an OTP;
  `reset-password` completes it. OTPs are stored in `otp_verifications`.
- **Role headers**: `proxy.ts` injects `x-api-center-user-{id,email,role,name}`; most
  routes read these rather than re-trusting the client.

## Main sections (sidebar)

| Section | Page | Purpose |
|---|---|---|
| Dashboard | `/internal/api/dashboard` | KPIs/revenue charts (recharts). |
| Products | `/internal/api/products`, `/internal/api/store` | Product + plan catalog, API-key counts. |
| Sales | `/internal/api/sales/orders` | Orders with items/payments and license counts. |
| Invoices | `/internal/api/sales/invoices` (+ `/new`, `/[id]`, `/print`, `/thermal`) | Invoice list/create/detail/print; PATCH actions send-email, mark-paid, generate-license, cancel, archive. |
| Payment Setup | `/internal/api/sales/payment-config` | Enable/disable payment, provider, environment, keys, currency, tax, invoice prefix, test mode. |
| License Management | `/internal/api/licenses/generate`, `/internal/api/sales/purchase`, `/internal/api/hardware`, `/internal/api/activation`, `/internal/api/licenses/renewals`, `/internal/api/reactivation-requests`, `/internal/api/trials`, `/internal/api/trial/trial-templates` | License Center (Generate/Manager/Validation/Bulk), Generate License (`/internal/backend/admin/create-license`), Hardware, Activations, Renewals (dedicated page reusing the Renewals tab component), Reactivations, Trials. |
| Communications | `/internal/api/communications` | Full communications center (see below). |
| API Center | `/internal/api/public-api/keys`, `/internal/api/notifications`, `/internal/api/notifications/events` | Public API keys, inbox, event notification config. |
| Settings | `/internal/api/settings` | System settings. |
| Audit Logs | `/internal/api/logs` | `audit_logs` viewer. |

## Communications Center

One page (`/internal/api/communications`) covering internal conversations, universal
email history, external mailboxes, and settings:

- **Folders** (view kinds): Internal (All, Sales, Support, Activation, Renewal,
  Reactivation, Hardware, Trial, Payment, SDK, Customer, Notifications, Universal
  Email) and External mailboxes (Inbox, Sent, Draft, Waiting, Failed, Queued, Spam,
  Trash, Mailboxes). Draft/Spam are placeholders (not backend-wired yet).
- **Queue**: view pending/sending/sent/failed `message_queue` rows; "Process Queue"
  delivers due emails (batch 20, exponential backoff ≤ 60 min) — requires admin user
  header.
- **Delivery logs**: `notification_logs` filtered by status/recipient/event.
- **Mailboxes**: list with health badges (online/offline/auth_failed/syncing),
  provider presets (gmail/outlook/yahoo/zoho/icloud/fastmail/proton/custom),
  create/edit, **connection verification before save**, test email, sync, set-default,
  enable/disable, delete.
- **Settings**: system mail accounts (no-reply/support/sales) + general settings,
  persisted to `system_settings`.
- **Auto-sync**: the page processes the queue and syncs enabled mailboxes every 45 s.

### Add a mailbox (recommended workflow)

1. Fill provider + IMAP/SMTP credentials.
2. Click **Verify Connection** → `POST /internal/backend/mailboxes/test-connection`
   returns `{ imap, smtp, overall }` with exact reasons on failure.
3. Only on success can the mailbox be saved (`POST /internal/backend/mailboxes`).
4. Verify the audit trail at `/internal/backend/logs`
   (`mailbox_connection_test`, `mailbox_created`).

## Notification events

`/internal/api/notifications/events` toggles **email** and **SMS** per event type
(`GET/PUT /internal/backend/admin/event-config`). 22 events, defaults: first 15
email+SMS, last 7 (admin-oriented) email-only. SMS additionally requires
`sms_config.enabled = true` (settable in settings/SMS config).

## Public API keys

`/internal/api/public-api/keys`:
- **Create** (`POST /internal/backend/admin/api-keys`): product-bound, permissions,
  rate limit, expiry, notes. Key format `pk_<prefix>_<32hex>`, secret
  `sk_<prefix>_<48hex>`; only the secret hash is stored. One-time secret reveal.
- **Revoke** (`POST .../[id]/revoke`) and **rotate** (`POST .../[id]/rotate`).
- **Delete** cascades `api_request_logs` and `public_api_nonces`.
- The built-in Security Guide modal documents HMAC signing, nonce replay protection,
  the 5-minute timestamp window, and product isolation.

## Email / SMS administration

- **Email templates**: editable per `email_type` in the `email_templates` table;
  in-code fallbacks exist for all types. Sender routing: support- and sales-oriented
  types use `MAIL_SUPPORT_*` / `MAIL_SALES_*`, everything else `MAIL_FROM_*`.
- **SMS templates**: `GET/PUT /internal/backend/admin/sms/templates` (seeded defaults);
  test via `/internal/backend/admin/sms/send` and `/internal/backend/test-sms`.

## Troubleshooting

- **Conversations won't load** → ensure `conversation_attachments` exists (it is
  created by migrations; its absence was the root cause of an earlier production bug).
- **Emails not sending** → check `BREVO_API_KEY`; confirm the mail account route and
  that the queue processed (delivery logs show `sent`/`failed`/`skipped`).
- **SMS not sending** → check `FAST2SMS_API_KEY`/`SENDER_ID`, `sms_config.enabled`,
  and `event_notification_config` toggles.
- **Generated SDK fails validation** → check version synchronization (SDK/product/
  runtime/generated versions must match) and that no hardcoded vendor values remain.
- **Audit trail** → all key actions write `audit_logs`; browse via
  `/internal/backend/logs`.

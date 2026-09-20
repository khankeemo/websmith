# 08 — Database

## Connection & migrations

- **Engine**: PostgreSQL on Neon. Single shared pool via `getDb()`
  (`lib/backend-db/index.ts`, `ssl rejectUnauthorized: false`). Table comments state
  **"Neon PostgreSQL only"**.
- **Migrations**: `lib/migrations/runner.ts` executes idempotent SQL —
  `CREATE TABLE IF NOT EXISTS` plus `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — on
  every `getDb()` call. Never create tables outside this runner.
- The platform has no other active datastore for business data. MongoDB has been
  completely removed and all collections, documents, and credentials migrated into
  isolated `portal_*` tables in Neon PostgreSQL (Upstash Redis is used only for rate
  limiting; `better-sqlite3` is a dormant dependency).

## Domain map

| Domain | Tables |
|---|---|
| Licensing | `licenses`, `activations`, `customer_licenses`, `license_bindings`, `license_hardware`, `renewal_requests`, `renewal_history`, `reactivation_requests` |
| Trials | `trials`, `trial_templates`, `trial_audit_logs` |
| Products & plans | `products`, `plans`, `payment_gateways`, `payment_config`, `coupons` |
| Store | `orders`, `order_items`, `payments`, `invoices`, `carts`, `cart_items`, `subscriptions`, `sales_enquiries` |
| Customers | `customers`, `states`, `countries` |
| Communications | `communication_conversations`, `conversation_messages`, `conversation_attachments`, `conversation_folders`, `mailboxes`, `mailbox_sync_logs`, `message_queue`, `email_attachments` |
| Notifications | `notification_logs`, `notifications`, `event_notification_config`, `email_templates`, `sms_templates`, `sms_config` |
| Identity & security | `users`, `role`, `otp_verifications`, `developer_api_keys`, `api_request_logs`, `api_key_audit_log`, `public_api_nonces` |
| System | `system_settings`, `sdk_jobs`, `requests`, `audit_logs`, `trial_audit_logs`, `email_templates` |
| Agency & Portal (Migrated) | `portal_users`, `portal_tickets`, `portal_projects`, `portal_tasks`, `portal_clients`, `portal_messages`, `portal_uploads`, `portal_services`, `portal_resolution_templates`, `portal_notifications`, `portal_settings`, `portal_project_offerings`, `portal_invoices`, `portal_payments`, `portal_leads`, `portal_notification_logs`, `portal_softwarestorelistings`, `portal_directmessages`, `portal_softwarestoreinquiries`, `portal_paymentwebhookevents` |

## Key schemas (verified)

### Licensing

**`licenses`** — license keys per product/plan/customer. Key columns: `license_key`
(unique), `product_id`, `plan_id`, `customer_email`, `hardware_id`, `status`
(e.g. `active`/`inactive`/`'Pending activation'`/revoked/suspended/disabled),
`expiry_date`, `max_devices`, `created_at`. Status normalization logic lives in
`lib/license/serializer.ts` (`NormalizedStatus`: trial, licensed, expired, revoked,
suspended, disabled, inactive, deleted, unlicensed, force_reactivation).

**`activations`** — successful hardware activations (license_key + hardware_id).
**`customer_licenses`** — link between customer and issued license.
**`license_bindings`**, **`license_hardware`** — hardware binding records.

### Trials

**`trials`** — columns include `id`, `product_id`, `hardware_id`, `email`, `name`,
`status` (`active`/`consumed`/…), `started_at`, `expires_at`. Used by the trial status
API; SDKs check `has_trial` + `status === 'active'`.
**`trial_templates`**, **`trial_audit_logs`** — trial config presets and audit trail.

### Store / orders

**`orders`** — `id`, `order_number`, `customer_email`, `status` (`pending` →
`completed`), `subtotal`, `tax`, `total`, `payment_gateway` (default `'dummy'`),
`payment_intent_id`, `billing_address` (JSON), `paid_at`, `created_at`.
**`order_items`** — `order_id`, `product_id`, `plan_id`, `price`, plus
`license_key_generated` flag.
**`payments`** — `gateway TEXT DEFAULT 'dummy'`, `status` (`succeeded`), `method`
(`Test (Development)` for dummy), `transaction_id` (synthetic `TXN-…`).
**`invoices`** — status (`paid`), template/GST/discount columns added by
`ensureInvoiceColumns`; 10 React invoice templates render it.
**`coupons`** — `code` (unique), `discount_type` (`percentage`/`fixed`),
`discount_value`, `min_purchase_amount`, `max_uses`, `current_uses`,
`max_uses_per_customer`, `applies_to_product_id`, `applies_to_plan_id`, `expires_at`,
`is_active`. Note: only `is_active`, `expires_at`, `max_uses`/`current_uses`, and
`min_purchase_amount` are currently enforced (`lib/store/checkout.ts:152`).
**`carts`** / **`cart_items`** — session-scoped carts (`session_id`), optional coupon.

### Communications (detailed)

**`communication_conversations`** — `id`, `category`, `status` (default `open`),
`customer_email` (NOT NULL), `customer_name`, `subject`, `product_id`, `license_key`,
`hardware_id`, `sdk_version`, `runtime_type`, `created_at`, `updated_at`, plus
`deleted_at` (soft delete) and `admin_read_at`. Indexed on category, customer_email,
status, created_at, deleted_at.

**`conversation_messages`** — `id` serial PK, `request_id` (FK → `requests`,
nullable), `conversation_id` (FK → conversations, ON DELETE CASCADE), `sender_type`
CHECK (`customer`/`admin`), `sender_name`, `sender_email`, `message`,
`is_internal` (default false), `email_sent`, `email_error`, `created_at`.

**`conversation_attachments`** — `id`, `message_id` (FK), `file_name`, `file_size`,
`mime_type`, `storage_path`, `uploaded_at`.
**`email_attachments`** — `id`, `notification_log_id` (FK), `email_type`, `recipient`,
`license_key`, `file_name`, `file_size` (BIGINT), `mime_type`, `storage_path`,
`created_at`.

**`conversation_folders`** — `id`, `name`, `section` (default `internal`), `kind`
(`list`/`queue`/`logs`/`history`/`mailboxes`), `filter_json`, `is_system` (default
false), `display_order`, `deleted_at`, timestamps. Seeds 22 system folders.

**`mailboxes`** — `id`, `provider`, `email_address` (unique), `display_name`,
`imap_host`, `imap_port` (993), `imap_secure`, `imap_username`, `imap_password`,
`smtp_host`, `smtp_port` (465), `smtp_secure`, `smtp_username`, `smtp_password`,
`connection_status` (`unknown`/`online`/`offline`/`auth_failed`), `sync_status`
(`never`), `is_default_sender`, `is_enabled`, `signature`, `auto_reply_enabled`,
`auto_reply_message`, `queue_size`, `last_sync`, `last_success`, `last_failure`,
`last_error`, timestamps.

**`mailbox_sync_logs`** — per-sync result rows for a mailbox.
**`message_queue`** — outbound email queue: status (`pending`/`sending`/`sent`/
`failed`), retry count, next retry time (exponential backoff capped at 60 min).

### Notifications

**`notification_logs`** — `event_type`, `channel` (`email`/`sms`), `recipient`,
`subject`, `status` (`sent`/`failed`/`error`/`skipped`), `response`, `error`,
`license_key`, `hardware_id`, `sender_name`, `sender_email`, `template_name`,
`retry_count`, `support_request_id`, `sales_enquiry_id`, `created_at`. Indexed.
**`notifications`** — internal inbox: `id`, `user_id`, `title`, `message`, `type`,
`link`, `created_at` (rows with `user_id='system'` are created by the notification
service; customer notifications use `customer_email`/`is_read` fields via `/api/v1/notifications`).
**`event_notification_config`** — `event_type`, `email_enabled`, `sms_enabled`;
seeded with all 22 events (first 15 both, last 7 email-only).
**`email_templates`** — `email_type`, `subject`, `body`, `plain_text`, `is_active`,
`updated_at`; selected newest-active first, in-code fallbacks otherwise.
**`sms_templates`** — `sms_type`, `message`, `is_active`.
**`sms_config`** — global SMS enablement (`enabled` defaults `FALSE`) + Fast2SMS keys.

### Identity & security

**`users`** / **`role`** — API Center admin accounts and roles.
**`otp_verifications`** — OTP codes for email verification and password reset.
**`developer_api_keys`** — `api_key` (the public key), `api_key_hash`/secret hash,
`product_id`, `permissions`, `rate_limit`, `status`, `expires_at`, `last_used_at`.
**`api_request_logs`** — public API request audit (redacted body, latency, status).
**`api_key_audit_log`** — key lifecycle events.
**`public_api_nonces`** — nonce replay-protection store (FK to `api_key_id`).

### System

**`system_settings`** — key/value settings (communications settings stored here).
**`sdk_jobs`** — publisher jobs: `job_id`, `status` (`pending`/`running`/`completed`/
`failed`), `payload`, checkpoints, `stage_metrics`, `stage_errors`, `stage_artifacts`,
`logs`, retry/resume counters.
**`requests`** — universal requests (FK target of `conversation_messages.request_id`).
**`audit_logs`** — the platform audit trail (all major actions incl. mailbox events).

## Notes

- Column sets above are the verified core of each table; some tables have additional
  columns added by migrations. Always read `lib/backend-db/index.ts` for the exact
  current schema.
- The notification service reads `event_notification_config`, `sms_config`,
  `notification_logs`; it does **not** use `notification_channels` or
  `notification_templates` (those names do not exist in the codebase).

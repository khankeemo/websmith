# 04 — Roadmap & Status

## Delivery status (source: master implementation document)

All **15 implementation phases** and the **AWS-01 workstream** (including the
Universal License Center final corrections, Communications Center module, unified
license status endpoint, and the Add-Mailbox verification fix) are marked
**complete** in `UNIVERSAL_LICENSE_PLATFORM_IMPLEMENTATION.md`. The production
build is deployed to Vercel and verified.

| Area | Status | Notes |
|---|---|---|
| 15 platform phases | ✅ Complete | Full build green (274 pages), deployed, production-verified. |
| AWS-01 rules (1–19) | ✅ Complete | Codified in `09-AWS-01-Rules.md`. |
| ULC + SDK event messaging | ✅ Complete | Rules 1–10 enforced; 14 end-to-end scenarios validated. |
| Communications Center | ✅ Complete | Backend routes + tabbed UI; mailbox verification workflow live. |
| Add-Mailbox verification | ✅ Complete | `test-connection` gate before save; audit events verified in production. |
| Notification events (22) | ✅ Complete | Email + SMS channels; configurable per event. |
| SDK Publisher (13 runtimes) | ✅ Complete | Checkpoint/resume via `sdk_jobs`. |
| MongoDB → Neon PostgreSQL | ✅ Complete | All 19 collections migrated to `portal_*` tables with zero data loss; MongoDB package removed. |

## Known gaps / future work

These are accurate observations from the codebase (not speculative features):

1. **Real payment gateways not integrated.** The registry
   (`lib/store/index.ts` `SUPPORTED_GATEWAYS`: stripe, razorpay, paddle, lemonsqueezy)
   is seeded with `isActive: false`, and checkout always uses the `dummy` gateway
   (`payment method "Test (Development)"`, synthetic `TXN-…` ids). There are no payment
   provider SDKs, no payment-intent/capture endpoint, and no webhook routes. The
   `app/payments/*` legacy module targets a separate Mongo-style `/payments` backend and
   is not wired into store checkout. → Enabling a real gateway is the main open item.
2. **Coupon enforcement is partial.** `validateCoupon`
   (`lib/store/checkout.ts:152`) enforces `is_active`, `expires_at`, `max_uses`/
   `current_uses`, and `min_purchase_amount`, but the stored fields
   `max_uses_per_customer`, `applies_to_product_id`, and `applies_to_plan_id` are not
   yet enforced.
3. **Admin order CRUD mismatch.** `lib/store/checkout.ts` references
   `/internal/backend/admin/orders/*`, but no such route directory exists (orders are
   managed via `/internal/backend/store/orders`).
4. **Draft/Spam mailbox folders** are UI placeholders (`kind: 'empty'`) not yet wired
   to a backend mailbox.
5. **Notification page route drift.** `app/internal/api/notifications/page.tsx` calls
   `PATCH /notifications/[id]` and `POST /notifications/read-all`, but the backend
   registers `PUT /[id]` and `PUT /mark-read` respectively.
6. **SMS disabled by default.** `sms_config.enabled` defaults to `FALSE`; SMS only
   sends after an admin enables it.
7. **Throwaway production admin account** `debug.1781648485@example.com` (created
   during Add-Mailbox verification) still exists in production and should be removed.

## Roadmap principles (AWS-01)

- **Architecture freeze** (Rule 19): no architecture/UI/workflow redesign after
  Phase 15 — changes are integration, bug-fix, or documentation only.
- **Documentation first** (Rule 7): any new endpoint/table/env var/behavior must be
  documented in the master MD before code.
- **Progress tracking** (Rule 10): every completed task reports completed/remaining/
  blockers/percentage/next.

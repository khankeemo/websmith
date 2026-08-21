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
- **Public storefront is untouchable (one approved UI exception)**: `www.websmithdigital.com/software-store`
  (PostgreSQL `products` + `/api/v1/store/*` + `/api/v1/checkout/*`). The
  purchase/cart/wishlist/checkout/payment logic is never edited — the ONLY
  approved change is the **Software Store Email Center header entry** (see the
  "Software Store Email Center Entry" rule below): an Email icon beside the
  existing Wishlist and Cart icons in the `/software-store` header that opens
  the SHARED `UniversalEmailDialog` in `customerMode` — the FULL existing
  customer Email Center (all `actionConfig` actions EXCEPT the admin-only
  `history`: Send Email / Buy License / Renew License / Activate / Reactivation
  / Device Replacement / Support / General / Software Store Enquiry), no
  `defaultAction`/`allowedActions` restriction, store theme applied to the
  portaled modal via `themeStyle` → `Modal.containerStyle`. Customer-mode Send
  posts to the public `POST /api/portal/support-message` with the recipient
  resolved SERVER-SIDE (buy-license / renew / software-store →
  `sales@websmithdigital.com`; send / activate / reactivation /
  device-replacement / support / general → `support@websmithdigital.com`).
  Everything else on the storefront stays untouched.
- **Customer Email Center — 9 unique default messages + customer attachments
  (see master doc "Customer Email Center — 9 unique default messages + customer
  attachments" progress entry)**: the customer-mode Email Center (`/software-store`
  Email entry + buy/renew portals) pre-fills ONE unique customer→admin default
  message per action — Send Email → **General Email Request**; Buy License →
  **License Purchase Enquiry**; Activate → **License Activation Request**; Renew
  → **License Renewal Request**; Reactivation → **License Reactivation Request**;
  Device Replacement → **Device Replacement Request**; Support → **Technical
  Support Request**; General → **General Support Request**; Software Store →
  **Software Store Enquiry** — substituting ONLY existing dynamic values
  (`customerName`/`defaultCustomerName`, `productName`/`defaultProductName`,
  `licenseKey`/`defaultLicenseKey`; empty detail lines omitted); admin
  (non-customerMode) defaults unchanged. **Attachments work for ALL 9 options**
  via the EXISTING universal attachment system: the shared dialog's attachment
  section is enabled in customer mode (SDK attach stays admin-only), customer-mode
  Send posts multipart to the PUBLIC `POST /api/portal/support-message` when files
  are attached, and that public route now accepts `multipart/form-data`, validates
  (`validateAttachmentFiles` max 5 / 10MB / allow-list), stores (`storeUploadedFiles`),
  attaches to the Brevo send (`toBrevoAttachments`), and links to the customer
  `conversation_messages` row (`linkConversationAttachments`) + the
  `notification_logs` row (`linkEmailAttachments`) — the same pipeline as the
  admin composer. Recipient routing / identity fields / structured body / per-IP
  throttle / auth / SMTP / IMAP / queue / schema unchanged.
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
- **Phase 7 Redesign — Mailboxes nav + Auto Reply + one-sided connection tests**
  (see master doc Phase 7 entry): the sidebar's **Mailboxes** section (top) owns
  the mailbox rows (health dots) + folder list + Add Mailbox; Settings / Templates
  / Signatures / Auto Reply are nav items under Communication Settings
  (`SETTINGS_DEF` / `TEMPLATES_DEF` / `SIGNATURES_DEF` / `AUTO_REPLY_DEF`, each with
  its own `kind`; `refreshCurrent` resolves all four). `test-connection` supports
  **one-sided tests**: a side (IMAP/SMTP) runs only when all its required fields
  are present — Test Incoming / Test Outgoing send the other side blanked;
  `data.imap`/`data.smtp`/`overall` appear only for tested sides. **Auto-reply**
  lives on the mailbox row: the IMAP sync answers the FIRST message of a NEW
  conversation when `auto_reply_enabled` using `auto_reply_template_key` +
  `auto_reply_signature` (fallback `auto_reply_message`, then `signature`), sends
  via the same nodemailer pattern as `[id]/send`, records the admin reply in
  `conversation_messages`, `notification_logs` (`event_type: 'auto_reply'`) and
  `audit_logs` (`auto_reply_sent`), and sets the conversation to
  `waiting_customer`. The Auto Reply panel edits drafts locally and saves via
  `PATCH /mailboxes/[id]` (fields `auto_reply_template_key`/`auto_reply_signature`
  added to schema via `ALTER TABLE IF NOT EXISTS`). Signatures are stored in the
  `settings` collection document (`signatures` array, `GET/POST
  /internal/backend/communications/settings`) — no new table. Never bypass the
  save-time connection gate; never render stored passwords.
- **Mail Delete feature + Allow Email Deletion toggle** (see master doc Phase 8
  entry): permanent conversation deletion is a **real data deletion**, one
  atomic transaction per request — `permanentlyDeleteConversations()` in
  `lib/communications/delete-conversations.ts` (BEGIN → delete
  `conversation_messages` [FK-cascades `conversation_attachments`] +
  `message_queue` + `communication_conversations` + `conversation_deleted`
  audit row → COMMIT; any failure ROLLBACKs and leaves data unchanged). Only
  conversation-exclusive data is removed — `requests` (shared Universal
  Request Center), `notification_logs`/`audit_logs` (system ledger) and
  `email_attachments` are intentionally left intact. Attachment FILES are
  unlinked only AFTER commit and only when no remaining row in
  `conversation_attachments` OR `email_attachments` references the same
  `storage_path` (shared files are never deleted). **Backend-enforced
  toggle**: `allow_email_deletion` lives in the `settings` document
  (default `true`; merge `!== false`) and the DELETE handlers
  (`conversations/[id]?permanent=true`, `conversations?ids=`, `?action=empty_trash`)
  return 403 `EMAIL_DELETION_DISABLED` when off — never rely on UI hiding.
  UI: "Delete Forever" buttons (reader toolbar + bulk selection, hidden when
  disabled), confirmation `Modal` in the existing style, immediate
  list/detail refresh via `refreshCurrent()` + `fetchStats()`, toasts at
  `z-[100]`. Soft-delete/Trash flow is unchanged.
- **Mailbox active-account cleanup — disabled mailbox hides its email data (see
  master doc "Communications — Mailbox Active-Account Cleanup" progress entry)**:
  `mailboxes.is_enabled` is the source of truth for VISIBILITY. Disabling a
  mailbox hides its email data from EVERY mailbox view (Inbox / Sent / Draft /
  Waiting / Failed / Queued / Spam / Trash + `mailbox_id`- and category-scoped
  lists) WITHOUT deleting any row; re-enabling restores visibility per the
  existing rules. The filter is `(cc.mailbox_id IS NULL OR EXISTS (SELECT 1
  FROM mailboxes mb WHERE mb.id = cc.mailbox_id AND mb.is_enabled = TRUE))`
  applied to the conversation WHERE in the list + stats routes (including the
  separately-built trash + unread count WHERE lists and the queue `failed`/
  `queued` counts, which LEFT JOIN `communication_conversations` + `mailboxes`
  and show rows only when `cc.mailbox_id IS NULL OR mb.is_enabled = TRUE`),
  plus the detail GET (a disabled mailbox's conversation returns 404). System
  mail (`mailbox_id IS NULL` — Websmith Communications support/sales/no-reply)
  is NEVER affected; other active mailboxes are never affected; no email
  record is deleted; no schema change; no new mailbox system; send/receive/
  queue-processing architecture unchanged; Delete/Restore/Permanent Delete
  behavior unchanged. The UIs (`communications/page.tsx` + `manage-mails/`)
  need NO change — both already read these backend routes. Files:
  `app/internal/backend/communications/conversations/route.ts`,
  `conversations/stats/route.ts`, `conversations/[id]/route.ts`,
  `communications/queue/route.ts`.
- **Manage Mails — centralized mail workspace** (see master doc SECTION 0.18 /
  Progress Tracking entry): the standalone page `app/internal/api/communications/
  manage-mails/page.tsx` (full-viewport Communications layout, NO app sidebar)
  manages the built-in **Websmith Mail** accounts (no-reply / support / sales) +
  user **Mailboxes** + their mail in ONE 3-pane UI, reusing ONLY the existing
  backend read-only — `/internal/backend/communications/settings` GET/POST
  (system-account `is_active` toggle + display_name/reply_to/signature edits
  persisted immediately via a full settings-doc POST), `/internal/backend/
  mailboxes` (enable/disable, sync, set-default, `[id]/test`, send-test,
  DELETE), `/internal/backend/communications/conversations` (list/detail, PATCH
  `mark_read`/`mark_unread`/`archive`/`restore`, soft-DELETE, permanent bulk
  DELETE + account-scoped Empty Trash both gated by `allow_email_deletion`).
  **Account-scoped routing**: a mailbox shows mail by `cc.mailbox_id`; a system
  account whose email matches a configured mailbox routes through that mailbox,
  otherwise by `routing.support_categories` / `sales_categories` /
  `['general']` for type system. **Sidebar rule**: the **Manage Mails** leaf
  lives under Communications → Email (`/internal/api/communications/manage-mails`)
  and active-route resolution is **deepest-prefix** — exact path match wins,
  otherwise the longest matching prefix is active (`deepestMatch()` in
  `components/internal-api/Sidebar.tsx`), so the child page never highlights the
  parent Communications overview. Reply/New Email reuses `UniversalEmailDialog`.
  Styling is a scoped `.manage-mails-ui` block in `app/globals.css`
  (`.mail-action-button` Navarog21 ridge/glow in `#149CEA`→`#1479EA`,
  `.mail-boundary` panels, reduced-motion guards) — never a global `button`
  selector. The Add/Edit Mailbox form keeps the blank + auto-detected rules and
  the save-time connection gate; masked/stripped passwords on PATCH.
- **Communications Center — consolidated sidebar + single Communications Setting
  (Phase 12, UI-ONLY — see master doc "Phase 12 — Communications Setting
  consolidation" progress entry)**: the sidebar of
  `app/internal/api/communications/page.tsx` now shows ONLY **Websmith
  Communications → Communication Center → Mail** (Inbox / Sent / Draft /
  Waiting / Failed / Queued / Spam / Trash, `ext-*` + custom folder rows,
  badges from `Stats`) and **Categories / Labels** (All / Sales / Support /
  Activation / Renewal / Reactivation / Hardware / Trial / Payment / SDK /
  Customer / Sent / Notifications / Universal Email), plus a pinned bottom with
  exactly **Communications Setting** + **Manage Folder** (opens the existing
  folder-manager modal). All former nav destinations — Websmith Mail accounts,
  Mailboxes, Templates, Signatures, Auto Reply, Manage Mails — were REMOVED
  from the sidebar (no duplicates; the `manage-mails` route file is untouched
  but no longer reachable from this page). **Communications Setting**
  (`activeFolder 'settings'`) is ONE consolidated workspace
  (`renderSettingsWorkspace()`: the middle pane is hidden, the center pane
  renders a section tab bar **General / Websmith Mail / Mailboxes / Templates /
  Signatures / Auto Reply**): **General** = the system communication settings
  (General / Email Deletion / Routing cards + the single Save — the system
  Communication toggle lives here and is NEVER duplicated), **Websmith Mail** =
  the built-in accounts rendered with UI display labels
  (`SYSTEM_ACCOUNT_UI_LABELS` / `systemAccountUiLabel`: Websmith Authentications
  — no-reply@, Websmith Support Team — support@, Websmith Sales Team — sales@;
  presentation-only overrides, backend settings values untouched) with the
  enable/disable toggle + Edit / Test / Sync actions + IMAP / SMTP / Sync /
  Health status grid, **Mailboxes** = the existing full mailbox-management UI
  (grid + detail: enable/disable toggle, Add / Edit / Delete, Test / Sync /
  Set Default / Send Test Email, connection status badges Connected /
  Connection Failed / Authentication Required / Disabled + `last_error`
  display — UI placement only, NO connection-logic change), and **Templates /
  Signatures / Auto Reply** = the old Manage Mails configuration UI (one
  source, no duplicate controls). Settings navigation state lives in
  `settingsSection` (local, not a sidebar route); entering settings reloads
  commSettings + mailboxes + templates. No SMTP/IMAP/queue/schema/auth/
  storefront logic changed.
- **Communications Center live fixes (Phase 13 — see master doc "Phase 13 —
  Communications Center live fixes" progress entry)**: (1) **stats route
  trash-count 500 fixed** — `GET /internal/backend/communications/conversations/
  stats` crashed on every request (`syntax error at or near "WHERE"`, 42601)
  because the trash count appended `WHERE cc.deleted_at IS NOT NULL` after the
  shared `${whereSQL}` (which already carries its own `WHERE`); the trash count
  now builds its OWN WHERE list (`deleted_at IS NOT NULL` + optional
  `mailbox_id`), so the UI gets live inbox/sent/waiting/failed/queued/unread/
  trash numbers instead of `{inbox:0,…}`. (2) **IMAP sync never stored email
  messages — fixed** — `POST /mailboxes/[id]/sync` INSERTed the nonexistent
  `has_attachments` column into `conversation_messages`, so every customer-message
  INSERT failed inside the per-message try/catch AFTER the conversation INSERT
  committed (conversations existed with zero messages → bodies never rendered,
  unread always 0); the INSERT now uses real schema columns (`conversation_id,
  sender_type, sender_name, sender_email, message, is_internal, created_at`).
  (3) **Admin reply goes to the CUSTOMER** — the Brevo fallback recipient is
  `conv.customer_email` (was the admin/company address), `{{request_id}}` is
  filled, and the mailbox-SMTP path reports `emailDelivered: false` + a warning
  when SMTP throws (never fake success). (4) **Delete/restore always re-fetch** —
  after any delete/restore attempt (including partial failures) the UI clears
  the selection, refreshes the list + stats, and toasts "X of Y moved to Trash"
  on partial success. (5) **One full-width mailbox card per mailbox** in
  Communications Setting → Mailboxes (`renderMailboxGrid()` full-width,
  Websmith Mail card style; avatar/label/badges/email, Enable/Disable toggle,
  purpose, IMAP/SMTP/Sync/Health grid, `last_error`, Test / Sync / Set Default /
  Edit / Delete, Send Test Email, expandable Sync Logs when selected — all
  inside the single card, no grid|detail split). **Every mailbox action is
  dynamic against the real mailbox DB id** — `mailboxAction(mb.id, endpoint)`
  → `POST/PATCH/DELETE /internal/backend/mailboxes/[id]/…` (backend resolves
  the row by id); no mailbox-specific email/address is hardcoded anywhere in
  the action logic, so a newly added Gmail/Outlook/custom mailbox gets the
  same cards + working actions with zero new code. (6) Middle panes widened
  380→400px; the reader thread shows `sender_email`. Only 4 files changed:
  `page.tsx`, `admin/communication/reply/route.ts`, `communications/
  conversations/stats/route.ts`, `mailboxes/[id]/sync/route.ts`; no auth/
  notification/OTP/storefront changes.
- **Communications Center is a unified mail client (Mail / Websmith Mail /
  Mailboxes / Internal / Manage Mails)** (see master doc SECTION 0.18 +
  "Communications mail-client redesign" progress entry; **sidebar structure
  since Phase 12 = Mail + Categories/Labels + Communications Setting only —
  see the Phase 12 bullet above**): the main page
  `app/internal/api/communications/page.tsx` sidebar is now `Mail` (email
  folders Inbox / Sent / Draft / Waiting / Failed / Queued / Spam / Trash, all
  `ext-*` + custom folder rows, badges from `Stats`), `Websmith Mail` (the
  built-in system accounts support/sales/no-reply — row = health dot +
  display name + email, active when the account scope matches), `Mailboxes`
  (external mailbox rows with health dots; clicking opens **account-scoped
  mail** in the Mail Inbox, NOT the old mailbox detail pane), `Internal`
  (All + category folders + Email Logs / Universal Email) and a `Manage Mails`
  group (Communication Settings / Templates / Signatures / Auto Reply /
  Manage Folders + a **Manage Mails** button that navigates to
  `manage-mails`). Account rows click through `handleAccountSelect()` →
  `setAccountScope({kind:'system'|'mailbox', id})` + `setActiveFolder('ext-inbox')`;
  **folders inside Mail keep the account scope, system-wide views clear it**
  (`handleFolderChange`: `!key.startsWith('ext-')` → `setAccountScope(null)`);
  `loadConversations()` applies the scope server-side (mailbox → `mailbox_id`
  param on the existing `/communications/conversations` route — the ONLY
  backend addition; system account → `mailbox_id` when its email matches a
  configured mailbox, else `category=` its `support_categories`/
  `sales_categories`/`['general']` list). The sidebar is **full-height
  scrollable** (its own `overflow-y-auto`, header stays fixed) so many
  accounts/folders never clip. Sender identity is account ID based and always
  derived from real configured accounts — `buildSenderAccounts(commSettings,
  mailboxes)` (+ `defaultSenderId`, `accountForConversation`, module-level in
  the page; exported `SenderOption` from `UniversalEmailDialog.tsx`). The
  reader shows the **receiving account** (`accountForConversation`: mailbox
  wins by `conv.mailbox_id`, else the system account owning the category) in
  the To: lines instead of hardcoded addresses. **From dropdowns**: the
  `UniversalEmailDialog` (optional `fromAccounts`/`defaultFromId` props,
  "From" select above To; used by New Email with the default sender, by
  Forward with the receiving account, and by Reply/Reply All — see the Phase
  14 entry: the reader's inline EMAIL composer was removed and replies open
  the same dialog). Composer/dialog sends carry
  `from_account_id`/`from_email`/`from_name` (+ `from_mailbox_id` for
  mailboxes) into the existing `admin/communication/send` and
  `admin/communication/reply` routes — which now honor them as a **sender
  override**: `from_mailbox_id` sends via that mailbox's SMTP (same nodemailer
  pattern as `[id]/send`), otherwise `from_email`/`from_name` override the
  Brevo sender identity. No SMTP/IMAP/queue/schema/auth logic changed; no
  hardcoded sender addresses added.
- **Mailbox integration removal is integration-level** (see master doc Phase 9
  entry): `DELETE /internal/backend/mailboxes/[id]` no longer deletes only the
  row — it calls `removeMailboxIntegration()` in `lib/communications/remove-mailbox.ts`
  (one BEGIN→COMMIT: delete conversations WHERE `mailbox_id` = integration id
  via the shared `deleteConversationRowsTx()` rows cascade [messages →
  attachments, queue, conversation], delete `mailbox_sync_logs`, delete the
  `mailboxes` row, audit   `mailbox_removed`; ROLLBACK on failure; attachment
  FILES unlinked after commit only when unreferenced). Ownership comes from
  the new nullable `communication_conversations.mailbox_id` column
  (FK→mailboxes ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS migration AFTER
  the mailboxes DDL), stamped by the IMAP sync INSERT + COALESCE UPDATE — the
  ONLY schema change; SMTP/IMAP/sync/reply logic is untouched. **Protected**:
  `SYSTEM_MAILBOX_EMAILS` (support@/sales@/no-reply@websmithdigital.com) → 403
  `SYSTEM_MAILBOX_PROTECTED`, never removable. **Legacy unowned mail**
  (pre-column conversations, mailbox_id IS NULL) is swept ONLY via the
  explicit opt-in `?cleanup_legacy_email=true` (or
  `removeLegacyMailboxConversations()`), matching by address but NEVER touching
  conversations owned by a remaining mailbox. **Real-world data profile of the
  IMAP sync**: it always creates `category='general'` conversations (no
  license key, no messages) — this profile identified the 234 old
  `keeogamer@gmail.com` inbox leftovers (real-DB cleanup 2026-08-09: 238 → 4
  preserved real conversations; 15/15 verification checks passed). No
  cron/background sync exists (manual `[id]/sync` + client-triggered queue),
  so a removed integration cannot resurrect. Real-DB verification lives in
  `tests/communications/remove-mailbox-legacy.verify.mjs` (real schema only,
  no mock tables; read-only report by default, `--apply` cleans + re-verifies
  + rollback-proof + protected-mailbox snapshot comparison).
- **Communications Center real-behavior fixes (Phase 14 — see master doc
  "Phase 14 — Communications Center real-behavior fixes" progress entry)**:
  (1) **Idempotent soft delete** — `conversations/[id]` DELETE returns
  `success:true` + `data.already:true` ("Conversation is already in trash.")
  instead of 400 when `deleted_at` is already set, and every
  delete/restore/archive/mark-read/mark-unread button in both mail UIs is
  disabled while a request is in flight — kills the double-click
  "already deleted" error toast. (2) **Bulk PATCH endpoint** —
  `PATCH /internal/backend/communications/conversations {action, ids:[…]}`
  (mark_read/mark_unread/archive/restore, one transaction, per-row
  `{total,updated,failed,not_found}`; archive skips trashed, restore touches
  only trashed); both mail pages use it for selection actions with real-count
  toasts (`"N conversations marked as read"`, amber `warn` toast on partial
  failure) and clear the selection up-front. (3) **Stats scoping** —
  `conversations/stats` accepts `category=` and applies it to statusCounts +
  trash + unread counts (the unread count previously ignored ALL params).
  (4) **One universal composer for Reply/Reply All/Forward** — the reader's
  inline EMAIL composer is removed; Reply/Forward + the Templates panel open
  `UniversalEmailDialog` with `conversationId`/`defaultSubject` (`Re:`/`Fwd:`)
  /thread-context/`defaultFromId`; the dialog gained optional
  `defaultSubject/defaultMessage/defaultCc/defaultBcc/conversationId/templates/
  signatures` props, **CC/BCC fields**, **Template ▼ / Signature ▼** insertion
  (enabled-only) and **reply mode** (Send → `admin/communication/reply` with
  subject + cc/bcc + `from_*` override). The inline composer under the reader
  is now **Internal Notes only** (`is_internal:true`, never an email).
  (5) **Subject/CC/BCC through the pipeline** — `admin/communication/reply`
  and `admin/communication/send` parse cc/bcc (comma/semicolon, regex
  validated, 400 on invalid) and pass them to the mailbox-SMTP nodemailer and
  Brevo paths; reply accepts a `subject` override. (6) **Honest delivery** —
  reply returns `emailDelivered:false` + `warning` when Brevo throws (message
  stays saved); send's `queued:true` (mailbox SMTP failure) and reply's
  `emailDelivered:false` render as amber warnings in the dialog, never green
  success. (7) **Detail page** (`conversations/[id]`) toasts real errors on
  delete/permanent-delete/restore/reply instead of swallowing them. (8)
  **Manage Mails** toolbar uses the bulk PATCH with real-count/warn toasts;
  `softDelete` handles whole selections with per-row results. Verified:
  `npx tsc --noEmit` 0 errors, `npm run build` green; NOT deployed (awaits
  user approval).
- **Email System Final Fix (see master doc Phase 15 entry)**: admin replies
  ACTUALLY reach the customer on every account type. ROOT CAUSE: the universal
  composer posted `is_internal: "false"` (STRING) and the reply route gated the
  whole email-send block on `!is_internal` — the truthy string meant the email
  was NEVER sent (only stored + status + audit). Fixed in the reply route: the
  value is normalized via `parseInternal(v)` (`true`/`"true"` → internal,
  everything else → real email), so the composer's `"false"` string is treated
  as a real reply; an
  Internal Note returns early `{success:true, internal:true}` (never an email).
  Reply recipient = `conversation.customer_email` on BOTH paths (mailbox SMTP
  nodemailer + Brevo), From/Reply-To derived from the real receiving account
  (mailbox wins by `conv.mailbox_id`, else the system account owning the
  category). Honest delivery: the route UPDATEs `email_sent`/`email_error` on
  the exact message row (`RETURNING id`) after each attempt (both paths + IMAP
  sync auto-reply); readers show green "sent via email" / red "email failed"
  (title = error). Outgoing attachments: the shared composer shows the
  attachment section in reply mode (SDK zip attach stays admin-only) and posts
  multipart to the reply route, which stores files under the shared
  `ATTACHMENT_STORAGE_PATH`/`public/attachments/email` pattern, attaches them to
  the real outbound MIME for BOTH paths, and links `conversation_attachments` to
  the message. Incoming attachments: `POST /mailboxes/[id]/sync` saves
  `parsed.attachments` to storage + `conversation_attachments` linked to the
  customer message. `interactiveSenderId()` (both mail pages) skips
  `no_reply`/`no-reply` accounts as the default interactive sender — automated
  mail keeps its dedicated no-reply route. "New Email" buttons relabeled
  **Compose** (Reply/Reply All/Forward/Internal Note labels unchanged). Reply
  All CCs the receiving account's address. `GET
  /communications/conversations/[id]` computes `has_attachments` via EXISTS so
  the standalone conversation page's attachment indicator works. OTP + Software
  Store entry (`POST /api/portal/support-message`) untouched; one shared
  composer. Files: `app/internal/backend/admin/communication/reply/route.ts`,
  `components/internal-api/UniversalEmailDialog.tsx`, `app/internal/backend/
  mailboxes/[id]/sync/route.ts`, `app/internal/backend/communications/
  conversations/[id]/route.ts`, `app/internal/api/communications/page.tsx`,
  `app/internal/api/communications/manage-mails/page.tsx`.
- **Final Email Fixes — Recipient Name + Universal Attachments + Strict
  Separation (see master doc "Final Email Fixes" progress entry)**: (1)
  **Reply/Reply All auto-fill Recipient Name** — `UniversalEmailDialog` gained
  `defaultRecipientName` (reset on open, editable); Communications Center +
  Manage Mails reply pass the real name (`d.customer?.name` → `conversation.
  customer_name`), email-like strings dropped via `/[ @<>]/`; Compose/Forward
  stay empty (no known recipient — never invented). (2) **One universal
  attachment pattern** — `admin/communication/send` now INSERTs the admin
  message `RETURNING id` and links uploaded files in `conversation_attachments`
  on BOTH paths (mailbox SMTP + Brevo), so Compose/Forward attachments show in
  the reader exactly like Reply/incoming (same storage + max 5 files/10MB/
  allow-list). (3-5) **Strict system/mailbox separation** — the DB signal is
  `communication_conversations.mailbox_id` (NULL = system mail, set = mailbox
  mail); conversations GET + stats routes accept `source=system|mailbox`
  (`mailbox_id IS NULL`/`IS NOT NULL`, 400 `INVALID_SOURCE` otherwise) and the
  Communications Center always sends it: internal folders (Websmith
  Communications) show system mail only, external Mail folders show mailbox
  mail only — NEVER mixed. Stats fetch per source (`systemStats`/
  `mailboxStats`) and badges/status cards are section-scoped; account pills are
  section-aware; a system scope always routes by its category list (never by a
  matching mailbox); `handleFolderChange` clears any scope that does not belong
  to the opened folder's section. No SMTP/IMAP/queue/schema/auth/notification/
  storefront logic changed. Files: `UniversalEmailDialog.tsx`, both mail pages,
  `admin/communication/send/route.ts`, `communications/conversations/route.ts`
  + `stats/route.ts`. Deployed 2026-08-13 (build green 289 pages).
- **Universal Email Attachment System (see master doc "Universal Email
  Attachment System" progress entry)**: the failing attachment pipeline was
  replaced with ONE reusable service for the whole Internal API email system.
  ROOT CAUSES: (1) send/reply validated by browser MIME against a narrow
  allow-list missing PPT/PPTX/RAR → valid files rejected; (2) uploads written
  only to `public/attachments/email` on the runtime FS → on Vercel serverless
  the FS is read-only/ephemeral so uploads could fail and download/preview URLs
  404 (runtime `public/` files are never CDN-served); (3) duplicated
  validation/storage across send/reply/sync. FIX: **`lib/communications/
  attachment-policy.ts`** (pure, client-safe: `EXTENSION_MIME` map for PDF/TXT/
  DOC/DOCX/XLS/XLSX/CSV/PPT/PPTX/JPG/JPEG/PNG/GIF/WebP/ZIP/RAR/7z/JSON/XML/HTML/
  MD/RTF/ODF/SVG/TIFF/BMP/iCal/vCard, `MAX_ATTACHMENT_COUNT` 5, `MAX_ATTACHMENT_
  SIZE` 10MB, `mimeForFile`, `sanitizeFileName`, `validateAttachmentFiles` with
  clear errors, `ATTACHMENT_ACCEPT`) + **`lib/communications/attachments.ts`**
  (server-only: `storeUploadedFiles`/`storeIncomingAttachment`, `toBrevo
  Attachments`/`toNodemailerAttachments`, `linkConversationAttachments`/
  `linkEmailAttachments` persisting bytes, `resolveAttachmentById`). Schema:
  `conversation_attachments` + `email_attachments` gained `content BYTEA`
  (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `lib/backend-db/index.ts`) so
  bytes survive on serverless; disk `storage_path` stays best-effort +
  fallback. New download route `GET /internal/backend/communications/
  attachments/[id]` (proxy-auth, `force-dynamic`) serves DB bytes with
  `Content-Type` + `Content-Disposition` (UTF-8 `filename*`). send/reply/sync
  validate + link via the service (incoming mail never extension-validated).
  UI: dialog file input has `accept={ATTACHMENT_ACCEPT}` + client-side
  validation (same policy); reader threads download/preview via
  `${API_BASE}/attachments/<id>` (legacy public path only as fallback).
  Zero-attachment emails unchanged; unsupported types → clear 400 listing
  supported extensions. No public website / store / public API / SMTP / IMAP /
  queue / auth / notification logic changed. Deployed 2026-08-13, build green
  289 pages.
- **Communications Center — Real Sent location + native auto-sync fix (see
  master doc "Communications Center — R01 FINAL: Real Sent location + native
  auto-sync fix" progress entry)**: **(1) Real "Sent"** — `sent=true` is now a
  REAL filter on `GET /internal/backend/communications/conversations`: a
  conversation qualifies when it contains an outbound admin email that was
  actually delivered (`EXISTS conversation_messages cm WHERE
  cm.sender_type='admin' AND cm.email_sent=true`). It replaced the old FAKE
  Sent (`status IN ('resolved','closed')`) in the `ext-sent` FOLDER def
  (`app/internal/api/communications/page.tsx`), in Manage Mails' `sent` folder,
  and in the `conversation_folders` seed (`lib/backend-db/index.ts` →
  `{"sent":"true"}`). The stats `sent` count uses the SAME EXISTS definition so
  the Sent badge always agrees with the Sent list. Admin sends already stamp
  `email_sent=true` on both send paths (`admin/communication/send` + `reply`),
  so Sent reflects genuine outbound mail; delete/restore/permanent/empty-trash
  are id-based and work unchanged in Sent. **(2) Native-account auto-sync bug
  fixed** — the Communications Center live auto-sync polled `${API_BASE}` (the
  `/internal/backend/communications` INDEX route — NO `settings` payload) and
  read `settingsJson?.data?.settings?.communications?.mail_accounts` (always
  undefined), so the native support@/sales@ accounts were NEVER auto-synced
  from the UI. It now fetches the REAL settings endpoint
  `GET /internal/backend/communications/settings` and reads
  `settingsJson.settings.mail_accounts`, so native support/sales accounts sync
  on the same timer as configured mailboxes (the sync route's
  `nativeReceiveAccount` matches by the same account id). No
  SMTP/IMAP/queue/schema/auth/notification/storefront changes. Files:
  `app/internal/api/communications/page.tsx`,
  `app/internal/api/communications/manage-mails/page.tsx`,
  `app/internal/backend/communications/conversations/route.ts` +
  `stats/route.ts`, `lib/backend-db/index.ts`. Verified: `tsc --noEmit` 0
  errors, `npm run build` green (QStash signing-key env vars are required for
  the local build of the deployed `native-receive` route — set in production),
  `npm test` 6/6 + 13/13. Not deployed.
- **Communications Center — permanent-delete persistence + Sent spans both
  sources + silent auto-sync (see master doc "Communications Center — R01: TODO
  fixes — Permanent-delete persistence + Sent spans both sources + silent
  auto-sync" progress entry)**: (1) **Permanent delete never resurrects** — the
  read-only IMAP syncs (`mailboxes/[id]/sync` + `native-receive`) cannot dedupe a
  still-UNSEEN provider message once a permanent delete removes its
  `conversation_messages` rows, so it was re-imported as a NEW conversation on
  the next 2s sweep. New table `conversation_delete_tombstones`
  (`provider_message_id`/`sender_email`/`subject`/`mailbox_id`/`deleted_at`, PK
  on the three identity columns; DDL in `lib/backend-db/index.ts`).
  `permanentlyDeleteConversations()` now captures customer-message identities
  BEFORE the delete (`collectConversationTombstones`) and inserts them in the
  SAME transaction (`insertConversationTombstones`, `ON CONFLICT DO NOTHING`);
  both inbound transports skip tombstoned mail (message-id lookup, plus a
  no-Message-ID variant by sender+subject+mailbox scope). Integration removal
  intentionally writes no tombstones. (2) **Sent spans BOTH sources — SUPERSEDED 2026-08-18 by the STRICT R01
  "Sent source separation + account filter dropdown" entry below** — the
  `ext-sent` folder def carried `noSource: true` so `loadConversations` skipped
  the `source=system|mailbox` restriction (outbound system/sales/support/
  admin-composed mail has `mailbox_id IS NULL`); the Sent sidebar badge, chip
  and status card showed `systemStats.sent + mailboxStats.sent`. (3) **Silent
  auto-sync** — the 2s receive timer now guards with `autoSyncInFlight` and
  refreshes the list via `{ silent: true }` (no spinner flash every tick, no
  destructive errors); every post-mutation refresh calls `refreshCurrent(true)`.
  Files: `lib/backend-db/index.ts`,
  `lib/communications/delete-conversations.ts`,
  `app/internal/backend/mailboxes/[id]/sync/route.ts`,
  `app/internal/backend/communications/native-receive/route.ts`,
  `app/internal/api/communications/page.tsx`. No SMTP/send/queue/auth/
  notification/storefront changes. Verified: `tsc --noEmit` 0 errors, `npm run
  build` green (296 pages). Not deployed.
- **Communications Center — STRICT R01: Sent source separation + Mailbox /
  System-mail account filter dropdown (2026-08-18, see master doc
  "Communications Center — STRICT R01: Sent source separation + Mailbox /
  System-mail account filter dropdown" progress entry)**: **(1) Sent never
  mixes sources** — the old `noSource: true` flag made BOTH Sent folders load
  the SAME combined record set (system + sales + support + admin-composed
  mail). It is REMOVED: Categories/Labels → **Sent** now loads `source=system`
  (system sent mail only, `mailbox_id IS NULL`) and Mail → **Sent** now loads
  `source=mailbox` (configured mailbox sent mail only, `mailbox_id IS NOT
  NULL`) via the EXISTING backend (`GET /internal/backend/communications/
  conversations?sent=true` + the default per-section `source` param — no
  backend change). Counts are source-scoped too: the Categories/Labels Sent
  badge shows `systemStats.sent`, the Mail Sent badge/chip shows
  `mailboxStats.sent`, and the pinned Sent status card reads the section's own
  stats and opens the section's own Sent folder (`sent` inside Websmith
  Communications, `ext-sent` inside Mail). The `noSource` field/guard was
  deleted from `page.tsx`. **(2) Mailbox / System-mail account filter
  dropdown** — a compact card-style dropdown (matching the Inbox/Waiting/Sent
  chips) sits directly BEFORE the Search control in the Communication Center
  toolbar. It lists **All Mail** + every configured account from the REAL
  backend data (system mail accounts from `commSettings.mail_accounts` grouped
  under "System Mail Accounts", enabled external `mailboxes` under "Mailbox
  Accounts" — labels/emails are the real configured values, never hardcoded).
  Selecting an account sets the existing `accountScope`
  (`{kind:'system'|'mailbox', id}`), so the current folder list, the Search,
  the badges/counts (`fetchStats` scopes per source + account) and the detail
  all stay consistent with the selection; **All Mail** clears it back to the
  unfiltered behavior. The account pills below the toolbar keep working as
  before. No Send / Receive / Delete / Restore / Permanent Delete / IMAP /
  Sales / Support / No-Reply / chat / schema / mailbox logic changed; no
  backend or other file changed. Files: `app/internal/api/communications/
  page.tsx` only. Verified: `tsc --noEmit` EXIT 0, `next build` EXIT 0
  (pre-existing Turbopack NFT warning only). Not deployed; awaits user
  approval.
- **Universal / System Trash separation (see master doc "Universal / System
  Trash separation" progress entry)**: the Communication Center has a dedicated
  **Trash for Universal Email / System conversations** (`int-trash`) fully
  separate from the Mailbox Trash (`ext-trash`) — the two email systems never
  mix in any folder including Trash. UI (`app/internal/api/communications/
  page.tsx`): `int-trash` is added to `FOLDERS` (`section:'internal'`,
  `kind:'list'`, `params:{show_deleted:'true'}`, `badgeKey:'trash'`), to the
  sidebar Categories/Labels group, and to the folder chips ("Universal Trash"
  reading `systemStats.trash`; the Mailbox Trash chip keeps reading
  `mailboxStats.trash`); `isTrash` covers both keys so Restore / Delete-Forever /
  Mark Read / Mark Unread / Archive gating and reader trash handling work
  identically. Soft delete → Trash, Restore, bulk PATCH, read/unread, counts/
  badges, category filtering, search and refresh are unchanged (id-based or
  already source-filtered by the list + stats routes: `source=system` +
  `show_deleted=true` → `cc.mailbox_id IS NULL AND deleted_at IS NOT NULL`).
  **Empty Trash is source-scoped**: the DELETE `?action=empty_trash` handler
  (`app/internal/backend/communications/conversations/route.ts`) accepts
  `source=system|mailbox` (400 `INVALID_SOURCE` otherwise) + optional
  `mailbox_id` + optional `category` (validated against the shared
  `VALID_CATEGORIES`) and permanently deletes ONLY the scoped trash (previously
  it deleted ALL trash — one section could wipe the other). The UI passes
  `source=system` from `int-trash` (+ scoped system-account categories) and
  `source=mailbox` from `ext-trash` (+ `mailbox_id` when a mailbox is
  account-scoped). No SMTP/IMAP/queue/schema/auth/notification/storefront logic
  changed. Deployed 2026-08-13, build green 289 pages.
- **Universal Trash "Failed to load conversations" — root cause + fix (see
  master doc "Universal Trash 'Failed to load conversations' — root cause +
  fix" progress entry)**: clicking Universal/System Trash showed "Failed to
  load conversations." — NOT a backend/SQL issue (the `source=system` +
  `show_deleted=true` trash path is correct and mirrors Mailbox Trash). ROOT
  CAUSE (live production logs): when the Internal API session
  (`api_center_token`) is missing/expired but the website session (`ws_session`)
  is valid, the proxy returns a **307 redirect** to `/internal/api/auth/login`
  for every `/internal/backend/*` call; the Communications page `fetch()` calls
  followed it by default and received the **login page HTML**, so `res.json()`
  threw → the loader's catch showed "Failed to load conversations." FIX
  (`app/internal/api/communications/page.tsx`, UI-only): a shared
  **`internalFetch()`** helper fetches with `redirect: 'manual'`, detects the
  3xx whose `Location` is `/internal/api/auth/login`, sends the admin back
  through the two-step login with `?next=<current location>` preserved, then
  throws. All READ loaders use it (`loadConversations`, `fetchStats`,
  `loadQueue`, `loadLogs`, `loadHistory`, `loadMailboxes`, `loadTemplates`,
  `loadCommsSettings`, `loadFolders`); working action/mutation calls (send,
  reply, delete, restore, mark read/unread, archive, mailbox create/test/sync,
  settings save, folder CRUD) are untouched. With a valid session Universal
  Trash loads deleted system conversations only, empty Trash returns a valid
  empty result (not an error), and Delete/Restore/Delete-Forever/read-unread/
  Empty Trash work id-based as before. No mailbox/compose/attachment/category/
  conversation logic changed. Deployed 2026-08-13, build green 289 pages.
- **Mailbox form is blank + auto-detected (no defaults)**: `newMailboxForm()`
  starts with NO provider, NO server hosts, NO email — the Add Mailbox form is
  completely empty. Typing the **Incoming Email** auto-detects the provider
  (Gmail/Outlook/Yahoo/Zoho/Apple/Fastmail/Proton/custom via `PROVIDER_PRESETS`
  + `presetForEmail`), fills IMAP/SMTP hosts/ports/encryption, and mirrors the
  address into both usernames **while typing** — a username only follows the
  email when empty or still equal to the previous address, so char-by-char
  typing updates (no freeze at the first keystroke) but a manually-changed
  username that differs is kept. The **Incoming Password mirrors into Outgoing
  Password** — outgoing follows when it is empty or still equal to the previous
  incoming password (kept in sync), while a manually-overridden outgoing
  password that differs is preserved (per-field override; all values stay
  editable). Unknown domains switch
  to `custom` manual mode (never invented server values). Provider select has
  an "Auto-detect from email" option. The Gmail/other App-Password help card
  renders only after a provider is detected. **Never** any default mailbox
  email anywhere in app/lib code (audited: `keeogamer@gmail.com` exists only
  in the cleanup-test script + docs). **All mailbox-form inputs carry explicit
  `name` + `autoComplete` attributes (`off` for text/email, `new-password` for
  passwords) to prevent browser credential autofill (the admin's own saved Gmail
  was otherwise leaked into the blank Add form).** Signatures are a Mail → Signatures
  section (settings-document `signatures` array): create/edit/delete/set
  default/preview + assign-to-mailbox; used by the reply composer and auto-
  reply. **Signatures now carry an `enabled` flag (default true).** Disabled
  signatures are excluded from the mailbox-form selector, auto-reply dropdowns,
  and the reply composer; `assignSignatureToMailbox` refuses disabled signatures;
  deletion clears `auto_reply_signature` references on mailboxes. The auto-reply
  server (`[id]/sync`) resolves `auto_reply_signature` (ID) → content from the
  settings document, skips disabled/unknown IDs, and falls back to the static
  `mailbox.signature` content — fixing the latent bug where the raw ID was
  appended to replies. Mailbox enable/disable is enforced server-side: sync returns 403
  `MAILBOX_DISABLED` when off (send + queue-process already filtered by
  `is_enabled`).
- **Final Mail Bugs fixed (see master doc Phase 10 entry)**: (1) **Trash leaves Inbox** — the trash model is `communication_conversations.deleted_at` (soft delete = Trash, restored via the `restore` PATCH action); Inbox + every non-trash list already exclude `deleted_at IS NULL` at the SQL level (never hide with frontend filters), Trash queries `show_deleted=true` → `deleted_at IS NOT NULL`, and inbox/sent/waiting/unread stats already filter it. Two gaps: the conversations **stats route now returns a `trash` count** (`deleted_at IS NOT NULL`, surfaced as the Trash folder badge via `Stats.trash` + `badgeKey: 'trash'`), and **`POST /mailboxes/[id]/sync` never re-imports trashed mail** — when the IMAP server still holds the (still-UNSEEN) message after the admin trashed it, the sync reuses the matching trashed conversation (`deleted_at IS NOT NULL ORDER BY updated_at DESC LIMIT 1`) keeping `deleted_at` set instead of creating a duplicate that would reappear in Inbox; auto-reply is skipped for reused trashed mail (`&& !reuseTrashed`). (2) **Gmail Create Mailbox failure** — root cause was the `POST /internal/backend/mailboxes` INSERT: 26 columns but only 25 VALUES (missing trailing `updated_at` value) → PostgreSQL `INSERT has more target columns than expressions` → generic "Failed to create mailbox." after the successful IMAP/SMTP test; fixed by adding the missing `$22` (`updated_at` = `now`) **AND** mapping `queue_size` to the literal `0` — the table column is `queue_size INTEGER NOT NULL DEFAULT 0`, and binding the `now` timestamp string (`$22`) into an INTEGER column raises `invalid input syntax for type integer` (masked earlier by the column-count error); the VALUES tail is now `...$21,0,$22,$22` (26/26). Create still verifies credentials via `test-connection` before saving, rejects duplicates (`DUPLICATE_EMAIL`), allows `signature` empty, and saves the exact tested form payload; no connection/Gmail logic was changed.
- **Architecture hierarchy**: Master Doc → Language Templates → SDK Publisher →
  Generated SDK. Never edit Generated SDKs directly; never embed business logic
  in runtime generators.

## AWS-01 ULC Event Messaging & Activation Rules (Final)

See master doc **SECTION 0B** (Event Messaging & Activation Rules). Always honour:

- **Rule 1** — the backend `/internal/backend/license/status` API is the single source of
  truth; never compute license/plan/days/validity locally except absent-optional fallbacks.
  All Activation / Renewal / Validate entry routes (internal AND `/api/v1/*`) must call the
  shared `resolveGlobalLicenseStatus()` service in `lib/license/serializer.ts` — routes MUST
  NOT query the database or make business decisions on their own. The universal response
  (status/reason/actions/message + proper HTTP code) is returned to the SDK, which only
  renders it. Activation requires `ACTIVE`/`TRIAL_ACTIVE`; renewal requires `ACTIVE`/`EXPIRED`.
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

## SDK V2 Single-State Architecture (Python Template)

See master doc **SECTION 0C**. Never regress:

- **One controller**: `LicenseEngine` (`license_engine.py`) is the **only** module that
  talks to the API, owns cache state, runs workflows, and mutates license state.
- **client.py is transport-only** — no `CacheManager`, no decision logic. UI modules
  (`universal_license_center.py`, `welcome.py`, `trial.py`, `activation.py`, `renewal.py`,
  `reactivation.py`, `communication.py`, dialogs) must never access `client`/`cache`/`_client`
  directly — they use engine methods (`validate_license_key`, `send_otp`, `verify_otp`,
  `mark_onboarding_complete`, `persist_runtime_state`, `flush_cache`, …).
- **Event-driven UI**: the ULC re-renders only from `LicenseStatusChanged` /
  `workflow.progress` events; success paths never call `_refresh_ui()` manually. Use the
  canonical 16-stage list from `WorkflowProgress` — never invent new stage strings.
- **GlobalStateMachine**: `workflow_progress.py` owns the single global state machine
  (`IDLE/VALIDATING/OTP_SENT/OTP_VERIFIED/PROCESSING/REFRESHING/COMPLETED/FAILED`);
  transitions are driven only by `LicenseEngine` (workflow guard + validate/send_otp/
  verify_otp/refresh/`_apply_fresh_state`), every `set()` emits `workflow.state` on
  `EventBus` and logs `WORKFLOW_STATE`. Exported via package `__init__.py`.
- **Automatic OTP (LOCKED §10)**: validation success immediately triggers
  `engine.send_otp()` — no manual Send OTP step; countdown timer + Resend OTP on expiry.
- **Renewal is payment-first**: ULC renewal path is Validate → Auto OTP → Verify OTP →
  Payment Confirmation (`_confirm_payment_dialog`, dummy payment — no provider contacted) →
  `engine.renew()` (extends the EXISTING license; never creates a replacement) → engine
  refresh → LicenseStatusChanged → success dialog. Renewal must NOT show the legacy
  "Renewal request submitted, our team will contact you" communication step.
- **UED is the sole email path for license/reactivation flows**: backend routes under
  `licenses/renewal-request`, `licenses/reactivation/submit`,
  `reactivation-requests/[id]/reject`, `reactivation-requests/[id]/approve` must use
  `sendEmail()` from `@/lib/email/brevo` (never a raw Brevo fetch). Auth (password-reset)
  and ticket-resolution routes keep their own senders and are intentionally NOT part of
  the Communications Center UED scope (AWS-01 auth/notification invariant).
- **No dead duplicate template code**: `renew_license_dialog.py` was deleted; `renewal.py`
  is the single renewal module. Never re-add duplicate renewal/communication dialog logic.
- **New foundation modules** (`event_bus.py`, `workflow_progress.py`, `dialog_manager.py`)
  are registered in `runtimes/python.ts` `MANDATORY_FILES` — never delete them.
- Engine `_workflow(...)` guard: every workflow logs `WORKFLOW_START`/`COMPLETE`/`ERROR`
  exactly once per stage and serializes under one RLock.
- Keep SECTION 0C in sync here and in the master doc (Rule ALWAYS-UPDATE).

## SDK Enterprise Enhancement Suite (Python Template)

See master doc **SECTION 0D** (20 enterprise areas). Never regress:

- **One owner per concern**: `session.py` (SessionManager), `permissions.py`
  (PermissionEngine), `config_manager.py` (ConfigManager), `feature_flags.py`
  (FeatureFlags), `offline_mode.py` (OfflineMode), `idempotency.py` (IdempotencyManager),
  `timeout_rules.py` (TimeoutRules), `communication_queue.py` (CommunicationQueue),
  `notification_center.py` (NotificationCenter), `error_catalog.py` (ErrorCatalog),
  `security.py` (SecurityRules), `migration.py` (MigrationRunner), `health_check.py`
  (HealthCheck), `metrics.py` (MetricsCollector), `version_compat.py`
  (VersionCompatibility), `support_workflow.py`, `rollback.py` (RollbackCoordinator).
- **These are utility/derivation layers, NOT controllers** — only `LicenseEngine`
  talks to the API / owns cache / mutates state. UI reads via engine accessors
  (`engine.session()`, `engine.permissions()`, `engine.can_activate()`, …).
- **Config reads** go through `ConfigManager` only; nobody calls
  `json.load(api-config.json)` directly. **Timeouts** come from `TimeoutRules`.
- **Idempotency**: every mutating workflow carries an idempotency key; repeated clicks
  produce ONE operation. **Security**: never store OTP/secret/password/token in
  plaintext; cache/hardware/customer encrypted at rest.
- **Encryption-at-rest is wired**: `cache.py` `enable_security(fingerprint)` is called
  from the engine `__init__`/`initialize`; writes are `ENCRYPTED:`-prefixed and fail
  closed when Fernet is unavailable; legacy plaintext cache files still load and upgrade
  on the next save; `license.key` is encrypted too. `CommunicationQueue` owns the
  engine's `_process_message_queue` flush (deliver callback → `client.create_communication`).
- **Fingerprint is versioned** (`v{n}:<hash>`); version mismatch re-verifies against
  the backend, never local re-bind. **Migration** v1→v2 preserves cache/license/
  customer/queue.
- All new modules registered in `runtimes/python.ts` `MANDATORY_FILES` and exported
  from `__init__.py`. Keep SECTION 0D in sync here and in the master doc.

## SDK Universal Activation UI + Shared UI Kit (Python Template)

See master doc **SECTION 0E**. Never regress:

- **One shared Tkinter UI kit**: `ui_styles.py` owns all theme tokens and reusable
  widgets (`COL`/`FONT`, `_rrect`, `GradientHeader`, `StyledButton`, `RoundedEntry`,
  `Card`, `SectionLabel`, `Subtitle`, `StatusPill`, `ProgressBar`, `GlobalMessage`);
  registered in `runtimes/python.ts` `MANDATORY_FILES` + exported from `__init__.py`.
  All screen builders draw only from this kit.
- **Activation dialog** (`_show_key_flow_dialog` in `universal_license_center.py`,
  formerly `activation.py`) is a contained step machine (`key` → `otp` → `final`)
  using `_set_phase`, `GradientHeader` card, shared `format_timer` countdown,
  `StatusPill` + `ProgressBar` progress, and `GlobalMessage`.
- **ULC activation form visual (compact colorful modern):** the visible activation
  UI in `universal_license_center.py` is a custom compact layer over classic
  tkinter — small centered card/container (subtle 1px border + primary 3px top
  accent), `_UVInput` rectangular textbox with slightly rounded corners and an
  accent focus ring (NO oval/pill shapes), `_UVButton` flat colourful buttons
  (primary/success/ghost) with a simple colour-only hover, `_UVPhase` plain text
  status line (no oval/Stupid badge), `_UVBar` thin 8px progress. No gradients,
  glow, shadows or animation. `docs/UI.MD` is used for structure/visual reference
  only. Visual layer only: the activation/renewal workflow, auto-OTP, 5-minute
  OTP timer, GlobalMessage, success dialog + SDK restart and engine delegation
  stay unchanged. Their API mirrors `RoundedEntry`/`StyledButton`
  (`.get`/`.state`/`.entry`, `.set_state`/`.set_text`/`._command`, `.start`/
  `.stop`) so handlers never change. Never remove fields, merge/hide controls,
  rename callbacks, or change button behaviour.
- **`activation.py` is the full standalone Activation UI again (ROLLBACK)**: it was
  rolled back from a thin re-export to the standalone `ActivationDialog` window
  (Hardware / Customer / Trial / License cards, Refresh + Activate actions, OTP
  step, GlobalMessage-driven status, restart confirmation). It still delegates to
  `LicenseEngine` (`validate_license_key`, `send_otp`, `verify_otp`, `activate`,
  `refresh`) and resolves every message through `GlobalMessage` — no raw
  `client`/`cache` decision logic. `open_activation_dialog(center)` opens it.
  Keep it a UI-layer module (SECTION 0C engine-first, no duplicate backend logic).
- Internal APIs/vars must never clobber tk.Canvas internals (use `_pw`, never
  overwrite `_w`); keep the engine surface (`_active_*`) unchanged per SECTION 0C.
- Runtime-guarded via `python -m py_compile` + headless Tk construction smoke test;
  keep `test:generation` 6/6 and `test:multi-runtime` 13/13 green. Keep SECTION 0E
  in sync here and in the master doc.

## SDK Multi-Runtime Parity (All 13 Runtimes)

Both docs are in sync. Never regress:

- **Every generated client must expose `getProducts` + `getTrialStatus`** (per-runtime
  casing: camelCase for node/typescript/javascript/bun/php/java; `GetProducts`/
  `GetTrialStatus` for go/dotnet; `get_products`/`get_trial_status` for python,
  rust and the `websmith_*`-prefixed C client) — these are the method names the
  production `SDKValidator` (`app/internal/publisher/sdk-validator.ts:323-376`)
  requires in the `validate-sdk` stage (`app/internal/publisher/index.ts:754`), which
  fails generation if missing. Implement against the real endpoints: `POST
  /api/v1/store/products` `{action:"list"}` and `POST /api/v1/trial`
  `{action:"status", hardware_id}` (POST works for every runtime's request helper;
  the store route also supports GET).
- **Runtime generators import `PublisherContext` as `import type`** from `../index`
  (type-only, elided at runtime) so `tests/sdk-generation/multi-runtime.test.mjs`
  can import them under `--experimental-strip-types` without resolving the heavy
  `../index` graph. Never change it to a value import.
- **`tests/sdk-generation/multi-runtime.test.mjs` is the parity guard**: it generates
  all 13 runtimes through the real generators, writes a minimal `api-config.json` +
  `manifest.json` (`kit_version` required), and runs `SDKValidator.validate()` against
  each package. Run via `npm run test:multi-runtime`; it is part of `npm test`.
  When editing any runtime generator, re-run it — all 13 must stay `valid: true`.
- **Full fidelity over string-presence**: the validator checks `content.includes(method)`,
  but new methods must be real working calls, not placeholder strings.
- **ALL 13 runtime generators are orchestration-only (since 2026-08-14)**: python,
  typescript, node, php, java, dotnet, go, rust, cpp, c, javascript, bun, deno all load
  their SDK from `template/<runtime>/` files (the single implementation source of truth
  per language) and only replace placeholders / validate / return the file map — no
  business/startup/hardware/activation/OTP/UI logic in any generator. Templates use
  canonical `${...}` tokens (`kit_version`, `runtime`, `generated_at`, `product_id`,
  `product_name`, `package_name`, `api_url`, `api_version`, `support_email`, `year`,
  plus runtime-specific ones) which every generator's placeholder map must cover
  (unreplaced known tokens fail generation). Never move business logic into a
  generator or bake context values directly into a template; never re-add the deleted
  broken template files. Keep this rule in sync with the master doc progress table
  (OPERATIONAL QA row).
- **Final runtime verification (2026-08-14) fixed three genuine template defects**
  that byte-diff parity could not catch (see master doc "FINAL RUNTIME VERIFICATION"
  progress entry): **rust** — `Cargo.toml` used the nonexistent `machine_uid` crate
  (real crates.io crate is `machine-uid`, imported as `machine_uid` in code) and
  `src/lib.rs` `initialize()` had a borrow-checker error (`match &self.license_key`
  then `self.store_license_data()` needs `&mut self` — fixed with `self.license_key.clone()`);
  **typescript** — the template failed `tsc --strict` (`cache.ts` assigned `unknown` to
  `Record<string, any>[]` → cast; `universal_email_dialog.ts` `await response.json()`
  typed `unknown` → `as any`); **cpp** — `client.hpp` was missing the `WelcomeDialog`
  class declaration/constructor (orphaned method bodies + `private:` at namespace scope,
  a pre-existing error since the original inline generator — header never compiled;
  full class restored from original output). After the fixes: `npm test` 6/6 + 13/13
  green, `cargo check` green, `tsc` build green, and real-wire smoke tests (local HTTP
  server) pass for node / python / typescript-compiled-dist / javascript. When editing
  a runtime template, prefer re-running the real toolchain when available (`cargo
  check`, `tsc --noEmit`, `node --check`, `python -m py_compile`) over diff-oracles
  alone.

## Public Website Contact & Social Media Settings (Manage Page)

Keep in sync with the master doc **SECTION 0.15**:

- **Single record, no new tables/endpoints**: all contact + social data lives in
  the MongoDB `settings` collection document `key: "contact_info"`, served by the
  existing `/api/settings/public/contact_info` endpoint (`GET` public; `PUT`/
  `PATCH` admin-only).
- **Fields**: `headquarters`, `email` (Contact/Support), `sales_email`, `no_reply_email`,
  `hr_email`, `phone` (existing) + `mobile_number`, `landline_number`, `whatsapp_url`,
  `facebook_url`, `instagram_url`, `linkedin_url`, `x_url`, `youtube_url` (added).
  Never create another table/collection or a new endpoint for these.
- **Validation lives in shared `lib/site-settings.ts`**: URL hosts are strictly
  validated (facebook.com, instagram.com, linkedin.com, x.com/twitter.com,
  youtube.com, wa.me); emails via `validateEmails` and phones via
  `validatePhones` (digits/`+`/`-`/`(`/`)`/spaces only); the API rejects invalid
  values with 400 (`EMAIL_INVALID`/`PHONE_INVALID`), and the admin UI
  validates before submit. Never bypass these checks; never save bad
  addresses/numbers.
- **WhatsApp special handling**: admins may enter `https://wa.me/<number>` or a
  plain number — plain numbers are always normalized to
  `https://wa.me/<digits>` before saving; visitors always open that URL.
- **Empty = hidden**: public footer/contact/landing render a platform icon only
  when its URL is non-empty (`target="_blank" rel="noopener noreferrer"`); never
  render placeholder/empty icons. Mobile/Landline items render only when set.
- **Landing `#contact` section renders everything**: the `#contact` section's
  Contact Information derives from the contact_info record via `contactEmails`
  (`email`+`sales_email`+`no_reply_email`+`hr_email` as mailto links),
  `contactPhones` (`phone`+`mobile_number`+`landline_number` as tel: links) and
  `contactSocials` (every configured URL in one Social Media item). Every
  configured value renders — never first-item-only — empties are excluded (no
  invented values); the default Contact Email `support@websmithdigital.com`
  applies only until a DB value loads.
- **No hardcoded contact info anywhere**: never hardcode email addresses,
  phone numbers, or socials in public components — Careers / Support /
  Documentation / Contact pages all fetch `/api/settings/public/contact_info`
  and render DB values with fallbacks (General Support → `email`, Sales →
  `sales_email`, Mobile → `mobile_number`); the landing page's default Contact
  Email is `support@websmithdigital.com` until the DB value loads.
- **Email service uses DB senders**: `lib/email/brevo.ts` `sendEmail` resolves
  the sender per email type from the contact_info record — support-typed
  (`admin_notification`/`support_reply`/`conversation_created`) → `email`,
  sales-typed (`new_sales_enquiry`/`sales_reply`) → `sales_email`, all other
  automated mail → `no_reply_email` (env vars as fallbacks); the automated
  disclaimer applies only to no-reply sends; `{{support_email}}` placeholders
  auto-fill. Never hardcode a sender email in a call site.
- **Admin Manage Page** (`/admin/manage-page`): Contact Information card order is
  Headquarters Address → Contact Email → Sales Email → No-Reply Email → HR Email →
  Mobile Number → Fixed/Landline Number → Primary Contact Number; Social Media
  Links card sits below it; the single Save Changes button persists all fields
  together. Fields sit in responsive two-column grids (labels above inputs,
  inline validation errors, empty social rows show "Add link" placeholders).
  Do not redesign the admin UI.
- **Backward compatibility**: `headquarters`/`phone` fall back to previous
  defaults only when the saved value is empty.

## Website Media System (Neon, migrated from MongoDB)

Keep in sync with the master doc Progress Tracking entry "R01 — MEDIA MIGRATION
FIX + CLEANUP". Never regress:

- **Neon is the single media source of truth**: website media lives ONLY in the
  PostgreSQL `media_assets` table (created in `lib/backend-db/index.ts` `getDb()`
  DDL block — never add a duplicate migration file/helper). The id is a **native
  SERIAL integer** in production (HTTP evidence: registry returns `url
  "/api/media/3"`); code NEVER forces a UUID into `id` — inserts omit the column
  and the upsert conflict path uses `id = DEFAULT`, so fresh ids come from the
  column's own default on BOTH serial and uuid-default columns (schema-agnostic).
  The DDL block also runs idempotent `ALTER TABLE media_assets ADD COLUMN IF NOT
  EXISTS data/created_at/updated_at` so an existing production table that predates
  the `data` column is repaired in place, and an idempotent repair that (1)
  de-duplicates `slot_key` rows, (2) adds a UNIQUE constraint/index on
  `slot_key` when none exists, and (3) relaxes NOT NULL on any column this
  implementation does not populate (live production evidence: "there is no
  unique or exclusion constraint matching the ON CONFLICT specification" on
  every upload POST — the original migrated table had NO unique constraint on
  `slot_key`, so every `ON CONFLICT (slot_key)` upsert AND the seed failed with
  500 — and the ADD CONSTRAINT attempt aborted with 23505 "Key (slot_key)=
  (global_collaboration_video) is duplicated.", so production ALSO holds
  duplicate slot_key rows that must be removed FIRST — and the seed/upload
  INSERTs additionally failed with `null value in column "asset_key" ... violates
  not-null constraint`, a leftover NOT NULL column from the original table that
  no repo code references). The dedupe keeps, per slot_key, the row that has
  bytes (`data IS NOT NULL`) else the lowest id (`DELETE ... WHERE id NOT IN
  (SELECT DISTINCT ON (slot_key) id ... ORDER BY slot_key, (data IS NOT NULL)
  DESC, id ASC)`); the NOT-NULL guard walks `pg_attribute` and drops NOT NULL on
  every no-default column outside the populated set (`slot_key`/`file_name`/
  `content_type`/`file_size`/`data`/`created_at`/`updated_at`) via
  `ALTER TABLE ... ALTER COLUMN %I DROP NOT NULL`; the constraint guard then
  checks `pg_index` for a single-column unique index covering `slot_key` and only
  when none exists runs `ALTER TABLE media_assets ADD CONSTRAINT
  media_assets_slot_key_uniq UNIQUE (slot_key)` — all three verified idempotent
  (2nd run deletes 0 rows / alters 0 columns / leaves one unique index) and
  verified against a real Postgres that reproduced the production table state
  (duplicates + no UNIQUE + no `data` column + `asset_key NOT NULL`): seed
  backfill + upload upsert + fresh-id minting all pass. No MongoDB media
  reads/writes, no Mongo fallback anywhere.
- **One authoritative implementation**: `lib/media.ts` (client-safe 14-slot
  `MEDIA_SLOTS`/`MEDIA_SLOT_INDEX`/`fallbackForSlot`/`MediaAsset`),
  `hooks/useMediaAsset.ts` (module cache + `refreshMediaAssets()` +
  `MEDIA_UPDATED_EVENT` re-fetch), `lib/media/storage.ts` (server-only Neon
  persistence + `seedMigratedMedia`), `GET/POST /api/settings/public/media` +
  `GET /api/media/[assetKey]`, and the Manage Page "Website Media" card. Never
  build a second media API, storage, slot list, hook, or manage-page editor.
- **Uploads always mint a NEW asset id**: `upsertMediaAsset` uses `ON CONFLICT
  (slot_key) DO UPDATE SET id = DEFAULT, …` (the DB column's own default —
  `nextval` on serial, `gen_random_uuid()` on uuid-default columns) so the
  immutable-cache file route
  (`Cache-Control: public, max-age=31536000, immutable`) can never serve stale
  bytes — the URL changes by construction. Never reuse an id for a new upload.
  (A forced literal `gen_random_uuid()` against production's INTEGER id was the
  original upload 500 — never regress to forcing a UUID into `id`.)
- **The SPA updates immediately after upload**: the Manage Page calls
  `refreshMediaAssets()` on success, which invalidates the hook's module cache
  and dispatches `media-updated`; every `useMediaAsset` consumer re-fetches and
  re-renders without a page reload. Never reintroduce a never-invalidated
  module cache (the original production bug).
- **Auth reuses the existing architecture**: POST uploads go through
  `apiHandler(..., { auth: "required" })` + `user.role !== "admin"` → 401 (the
  existing admin JWT). GET remains public (Neon-only, `force-dynamic`).
  Never add a new auth path; never expose internal endpoints.
- **Seed is a non-destructive seed/repair**: `seedMigratedMedia` inserts the
  committed seed assets (`global_collaboration_video` from
  `public/videos/API-Center.mp4` + `global_collaboration_image`) with **DB-native
  ids only when the slot is absent**; on an existing production table it REPAIRS
  metadata-only rows (`data IS NULL`) by backfilling bytes from the committed
  file via `ON CONFLICT (slot_key) DO UPDATE … WHERE media_assets.data IS NULL`
  (preserving id/file_name/content_type/file_size/created_at/updated_at), and
  never overwrites rows that already have bytes. It is a data-preservation seed
  + repair, not a runtime fallback, and only runs when the asset file is readable
  at runtime. The seed call in the DDL block is wrapped in its own try/catch
  (logs `Media seed error:` and continues) so a seed failure can never abort
  getDb's whole schema init.
- **Production upload 500 — ACTUAL root cause (2026-08-20)**: after deploying the
  UUID fix, Manage Page uploads STILL returned the generic 500. Live Vercel logs
  (`& vercel logs <deployment-url> --expand --json`) showed
  `API error (internal): error: there is no unique or exclusion constraint
  matching the ON CONFLICT specification` — the production `media_assets` table
  was created by the ORIGINAL implementation WITHOUT a UNIQUE constraint on
  `slot_key`, so both the upload upsert AND `seedMigratedMedia` failed. Adding
  the constraint then hit a SECOND blocker: production ALSO holds duplicate
  `slot_key` rows (`ADD CONSTRAINT UNIQUE` aborted with 23505 "Key
  (slot_key)=(global_collaboration_video) is duplicated." — the registry map
  hides them, so the duplicates were only visible in the runtime error), and a
  THIRD blocker: production ALSO carries an `asset_key` column that is NOT NULL
  with no default and is referenced nowhere in the repo, so the seed/upload
  INSERTs failed with `null value in column "asset_key" ... violates not-null
  constraint`. FIX: the media DDL block now (1) de-duplicates `slot_key` rows
  (keep the row with bytes, else lowest id), (2) relaxes NOT NULL on any
  no-default column outside the populated set (drops NOT NULL on `asset_key`),
  and (3) adds the UNIQUE constraint idempotently (see the bullet above). The
  id fix was correct but insufficient; the missing constraint + duplicates +
  the phantom NOT NULL column are the real blockers. Verified against a real
  PostgreSQL 18 (throwaway instance + temporary trust `pg_hba.conf` line for
  127.0.0.1, reverted after) reproducing the production table state (duplicates
  + no UNIQUE + no `data` column + `asset_key NOT NULL`).
- **Global Collaboration video consumer fix (2026-08-20, UI-only `app/page.tsx`)**: the
  public landing `global_collaboration_video` consumer is wired to the Neon managed
  source (`useMediaAsset` → `/api/media/<current asset id>`) and MUST render with a
  DIRECT `src={...}` attribute on the `<video>` element — never a `<source>` child.
  A changed `<source>` src does NOT run the browser media load algorithm, so the slot
  fallback (`/videos/WDS_UAC.mp4`) keeps playing the stale bytes after the async
  registry fetch resolves (root cause of "different video shown"). A
  `useEffect([globalCollabVideo.url])` calling `video.load()` + `video.play()` ensures
  the element reloads the current managed URL whenever it resolves or changes (every
  upload mints a NEW asset id). The fallback is used ONLY while the managed asset is
  unavailable (initial render / registry failure); no hardcoded video path remains in
  the consumer. Never regress to a `<source>` child for managed media; never alter the
  Neon schema / `media_assets` / upload API / MongoDB / auth / 413 / Manage Page.
- Keep this rule in sync with the master doc Progress Tracking entry.

## Internal API Side Nav — License Management (Sidebar Restructure)

Keep `components/internal-api/Sidebar.tsx` aligned (presentation only):

- **License Management** section owns **Licenses** (License Center
  `/internal/api/licenses/generate`, Generate License
  `/internal/api/sales/purchase`), **Device & Lifecycle** (Hardware
  `/internal/api/hardware`, Activations `/internal/api/activation`, Renewals
  `/internal/api/licenses/renewals`, Reactivations
  `/internal/api/reactivation-requests`), **Trials** (Trial Dashboard, Trial Templates).
- **No standalone "Hardware Management" section** and **no "Generate License" under
  Sales & Payments** — both live only under License Management.
- **Renewals page** (`/internal/api/licenses/renewals`) mounts the existing UI-only
  `RenewalsTab` component from `app/internal/api/licenses/generate/tabs/` — no new
  business logic, no duplicated logic there. Reactivations points to the admin request
  list, never the customer-facing activation center.
- Do not add dedicated per-page routes/icons/names beyond this regroup; nav routes,
  icons, permissions and active-route semantics are fixed/unchanged.## Universal Buy & Renew Portal (Internal API Only)

Keep in sync with the master doc **SECTION 0.16**. Do not regress:

- **Customer-facing standalone pages** `/internal/api/buy` and `/internal/api/renew` live inside the Internal API but are rendered as standalone full-screen pages — NO admin sidebar, NO admin navigation, NO admin login gate. `app/internal/api/layout.tsx` treats them like auth pages via the `isPortalPage` flag. Changing them must not change the admin dashboard for any other route.
- **No public/private data exposure**: the pages talk ONLY to the public portal backend `/api/portal/*` (catalog, OTP, license info, order create/pay). They never expose the admin products API, customer APIs, license-management APIs, internal IDs, or DB info. The browser never receives internal/DB data.
- **Server-side validation on every step** — never trust the browser/localStorage/UI: Product+Plan (+License for renew) are re-resolved from the DB by `lib/store/checkout.ts createPendingOrder()` (server prices), OTP is enforced server-side (`lib/portal/otp.ts hasVerifiedPortalOtp`) BEFORE any pending order is created, and renewal eligibility comes from `resolveGlobalLicenseStatus()` (Rule 1).
- **One payment workflow**: the portal REUSES `createPendingOrder()` (order creation) and, for fresh purchases, the store's `fulfillOrder()` — every store/buy flow shares logic, no second payment implementation. Renewal uses `lib/store/renewal.ts` (extends the existing row; never creates a new license) which shares the same order → payment → invoice architecture.
- **Buy generates a NEW license** (`fulfillOrder`); **Renew EXTENDS the existing license** (plan / `duration_days` / `expiry_date` / `last_renewed_at` / `renewal_history`) — never a replacement. The renewal license key is bound to the order SERVER-SIDE in `orders.notes` and re-read at pay time (never trusted from the client).
- **OTP before payment where applicable**: buy and renew both require a verified OTP (purpose `purchase`) before `order/create` succeeds.
- **Public storefront untouchable**: `/api/v1/store/*` and `/api/v1/checkout/*` are re-used read-only (catalog + checkout config); they are never modified. `lib/store/checkout.ts` is imported/called, never edited.
- **SDK integration**: `Buy License` opens `store.buy_url`; `Renew License` opens `store.renew_url` (config/api-config.json) via `config.get_buy_url/get_renew_url` and `ULC._open_store/_open_renew_portal`. No placeholder URLs.
- **Publisher auto-populates portal URLs during SDK generation**: `ConfigBuilder` (`app/internal/publisher/config-builder.ts`) always writes a `store` section into the generated `config/api-config.json`, deriving `buy_url`/`renew_url` (and `url`) from the configured API base URL (`WEBSMITH_API_URL`/`NEXT_PUBLIC_API_URL`), i.e. `<base>/internal/api/buy`, `<base>/internal/api/renew`, `<base>/software-store`. No hardcoding, no placeholders, no empty strings. `sdk-validator.ts` fails generation if `store.buy_url`/`store.renew_url` are missing/empty.
- **Contact Sales entry (Email Center Separation)**: `/internal/api/buy` and `/internal/api/renew` render a **Contact Sales** header button (`app/internal/api/portal/_ContactSales.tsx`, passed into `PortalShell` via its `headerAction` slot in `_ui.tsx`) that opens the SHARED `UniversalEmailDialog` in **customer mode** (`customerMode`, `defaultAction`/`allowedActions` restricted to `buy-license`|`renew`) prefilled from the visitor's entered identity. Never duplicate the email form/dialog; never add a portal email entry that posts to `/internal/backend/admin/communication/*`.
- **Contact Sales recipient is server-controlled**: customer-mode sends POST to the PUBLIC `POST /api/portal/support-message` — the action→recipient map lives SERVER-SIDE (buy-license / renew → `sales@websmithdigital.com`); the browser can never supply an address, and no admin endpoint is made public.
- **`POST /api/portal/support-message`** (public, outside the `/internal/:path*` proxy matcher): validates name + email + message server-side (mobile optional, length caps), per-IP throttle, creates `communication_conversations` (category `sales`) + `conversation_messages` (sender `customer`) + `audit_logs`, then sends via the existing `sendEmail()` (`new_sales_enquiry`). Emails are structured (Request Type / Name / Email / Mobile / Subject / Message).
- Keep this rule in sync with the master doc SECTION 0.16.

## Two-Step Login + Shared OTP + Auth Hardening (Session)

Keep in sync with the master doc **SECTION 0.17**. Never regress:

- **One shared OTP UI**: `components/shared/OtpVerification.tsx` is the ONLY OTP verification UI in the repo, used by BOTH login entry points — the public website login (`/login`) and the Internal API Center login (`/internal/api/auth/login`). It is presentational only: 6-digit boxed input (paste + auto-advance + backspace), resend countdown, error display, loading states, "Use password instead" back action; every server call is delegated via `onVerify(otp)` / `onResend()` props returning `{ success, error?, expires_in? }`. No client-side `verified=true` trust.
- **Two-step login — both entry points**: credentials are checked FIRST (`POST /internal/backend/api/auth/login`, `POST /api/auth/login`), and on success the server sends a login OTP and returns `{ success, requires_otp: true, email, email_masked, expires_in }` WITHOUT any token/cookie. NO session is ever created at the credentials step — it is created ONLY in the verify step. Internal verify: `POST /internal/backend/api/auth/login/otp/verify` (issues `api_center_token` cookie + JWT, updates `last_login`, records the login `notifications` row). Website verify: `POST /api/auth/login/otp/verify` (returns `{ token, user }` → `setAuthSession`). Resend: `POST /internal/backend/api/auth/login/otp/resend` + `/api/auth/login/otp/resend`.
- **Login OTP purposes** (`lib/otp/login-otp.ts`, parameterized `sendLoginOtp/verifyLoginOtp`): website login = `website_login`, Internal API login = `api_login` — each distinct from `password_reset` and `purchase` so `otp_verifications` `UNIQUE(email, purpose)` never collides. 5-minute expiry, max 15 attempts, per-IP send throttle, honest audit rows (`login_otp_sent` / `login_otp_verified`). Emails go through `@/lib/email/brevo` `sendEmail` only.
- **Proxy `PUBLIC_PATHS` is the allow-list, nothing more**: only auth entry routes, health, SDK-facing endpoints (`license/status`, `licenses/validate|activate|deactivate|reactivation/reactivation/submit`, `trials/start|status|analyze|convert|journey|register|suspicious`), storefront (`store`, `store/products`) and `store/enquiries` **POST only** (public contact form; the admin GET listing is behind the gate via a method-split in `proxy.ts`), plus the portal pages `/internal/api/buy` and `/internal/api/renew`. Admin-only endpoints (`admin/trials`, `admin/trials/trial-templates`, `test-sms`, `admin/cleanup`, and GET `store/enquiries`) are NO LONGER in `PUBLIC_PATHS` — direct unauth access returns 401; logged-in admins pass via the `api_center_token` cookie. Never add an admin-only endpoint to `PUBLIC_PATHS`.
- **Portal pages are public at the proxy**: `/internal/api/buy` + `/internal/api/renew` are in `PUBLIC_PATHS` so the standalone customer portal loads WITHOUT an admin login gate (matches `isPortalPage` in `app/internal/api/layout.tsx`).
- **`?next=` is preserved**: `proxy.ts` redirects unauthenticated page loads to `/internal/api/auth/login?next=…`; the login page parses `next` from `window.location.search` (avoiding `useSearchParams`/Suspense) and returns the user there after OTP success; default fallback `/internal/api/dashboard`.
- **Websmith Website Session is STEP 1 for the Internal API Center**: the Internal API login (`/internal/api/auth/login`) is gated by the proxy via `hasValidWebsiteSession(request)` — it verifies the `ws_session` cookie (the mirrored website JWT, signed with `JWT_SECRET`, written by `setAuthSession()`/cleared by `clearAuthSession()` in `lib/auth.ts`; EVERY auth call site syncs both `token` + `ws_session` together). Without a valid website session the internal login NEVER renders: page loads get the standalone **"Please Login First"** page (`app/internal/api/auth/please-login/page.tsx`, only CTA = explicit **Login** button → public `/login`; it never exposes the internal login form or proxy-protected links), and `/internal/backend/*` requests get `401 {success:false, error:"Unauthorized - Please login"}` (JSON) — both via `pleaseLoginFirstResponse`. Missing `api_center_token` but a valid `ws_session` → redirect to `/internal/api/auth/login?next=…` (step 2 continues). After website login, admins enter via **Admin Dashboard → API Center** (`/internal/api/auth/login`) and continue the existing two-step Internal login (credentials → login OTP → `api_center_token`); an expired Internal session mid-use is blocked and sent back to the `/login` flow. Never render the Internal API login (or bypass the website gate) without a valid `ws_session`.
- **Shared helpers**: `lib/website-auth.ts` owns `toPublicUser` + `signToken` (website JWT) so the website login and its OTP verify routes share the same token/user contract.
- Keep this rule in sync with the master doc SECTION 0.17.

## Email Center Separation + Email Form Cleanup (UI-only)

Keep in sync with the master doc **SECTION 0.16** + Progress Tracking ("Email
Center Separation + Email Form Cleanup"). Never regress:

- **No user-facing Email Center entry points in the admin chrome**: the Topbar email icon and the Activation Center shortcuts (Contact Sales / Request Trial / Open Email Center) were REMOVED. The shared `UniversalEmailDialog` stays available to ADMIN flows (LicenseManagerTab, GenerateLicenseTab, sales/enquiries, Communications Center, manage-mails, integrations). Never re-add an Email Center button to the global Topbar or to the customer-facing Activation Center.
- **Buy / Renew customer contact = the Buy & Renew Portal only**: `/internal/api/buy` and `/internal/api/renew` carry the **Contact Sales** header entry (`_ContactSales.tsx` + `PortalShell` `headerAction`). It opens the SHARED `UniversalEmailDialog` in `customerMode` — NEVER duplicate an email form, NEVER add a second email dialog component.
- **Recipient is server-controlled**: customer-mode sends POST to the PUBLIC `POST /api/portal/support-message`; the action→recipient map lives server-side (buy-license / renew / software-store → `sales@websmithdigital.com`; send / activate / reactivation / device-replacement / support / general → `support@websmithdigital.com`). The browser can never target an arbitrary address; `/internal/backend/admin/communication/send|reply` must NEVER be made public.
- **User→admin forms require identity**: every user→admin action (send, buy-license, renew, activate, reactivation, device-replacement, support, general) shows **Your Name\* / Your Email\*** + optional **Mobile** and validates Name + Email before sending; the email body is STRUCTURED (Request Type / Name / Email / Mobile / Subject / Message). Buy License + Renew route to `sales@`; General Support / Support Request / Device Replacement stay `support@`.
- **`POST /api/portal/support-message`** validates server-side (name/email/message, length caps), throttles per-IP, creates `communication_conversations` (category `sales` or `support` per action) + `conversation_messages` (sender `customer`) + `audit_logs`, and sends via `sendEmail()` (`new_sales_enquiry` for sales actions, `admin_notification` for support actions). Email History is newest→oldest (server `ORDER BY created_at DESC` + client-side sort in the dialog).
- **Storefront untouched (one approved Email Center exception)**: `/software-store`
  and `/api/v1/store/*` are never edited for email entry points EXCEPT the ONE
  approved **Software Store Email Center header entry**: an Email icon beside the
  existing Wishlist and Cart icons in the `/software-store` header opens the
  SHARED `UniversalEmailDialog` in `customerMode` — the FULL existing customer
  Email Center (every `actionConfig` action EXCEPT the admin-only `history`,
  no `defaultAction`/`allowedActions` restriction; prefilled from the store's
  known customer identity where available) — and posts to the PUBLIC
  `POST /api/portal/support-message` with the recipient resolved SERVER-SIDE
  (buy-license / renew / software-store → `sales@websmithdigital.com`;
  send / activate / reactivation / device-replacement / support / general →
  `support@websmithdigital.com`). The store theme follows the portaled modal
  via `themeStyle` (`UniversalEmailDialog`) → `containerStyle`
  (`components/ui/Modal.tsx`). Cart / Wishlist / product cards / search /
  filters / checkout / payment / pricing / `/api/v1/store/*` / `/api/v1/checkout/*`
  and all store database logic remain untouched. No `mailto:`, no `/contact`
  redirect, no duplicate email form, no admin endpoint.
- Keep this rule in sync with the master doc.

## Public Homepage Technology Banner (Websmith Landing Page)

Keep `app/page.tsx`'s `FloatingTechnologyBanner` aligned. Never regress:

- **50 technology nodes roam the FULL banner field** (`techSeed` = jittered
  10×5 grid spread across the entire field at init, not one side). Each node
  carries independent `x/y/vx/vy/base/rot/spin/turnTimer/turnEvery/wander`.
  Motion is real 2D physics on `requestAnimationFrame`: independent velocity,
  per-node turn timers (random ±0.8 rad direction changes for zig-zag), wall
  bounces on all four edges (axis-flip + small random deflection so paths never
  repeat), circle-to-circle **elastic collisions** (`collide()`: separate
  overlapping circles first, then reflect velocity along the collision normal,
  never permanent overlap), and a speed clamp that **restores a minimum
  velocity** (`MIN_SPEED`) so no node stalls or clusters. Positions are applied
  via `translate3d` only (GPU-friendly, no per-frame React re-render, no
  physics library). The JS transform is the SOLE positioner — nodes are
  `left:0/top:0` and fully offset by `translate3d(x - radius, y - radius)`;
  never re-introduce `left/top` percentages + `translate3d` together (that
  double-offset caused the old right-side clustering).
- **Each node is a real anchor**: `<a>` with `target="_blank"` and
  `rel="noopener noreferrer"` opens the technology's OFFICIAL website in a NEW
  TAB. Every one of the 50 `TECHNOLOGIES` entries has a verified official
  `href` (official domains/docs only — e.g. Python → python.org, TypeScript →
  typescriptlang.org, React → react.dev, Go → go.dev, C → WG14 standards page,
  Bash → gnu.org/software/bash, Objective-C → Apple docs). Never `href: null`,
  never Wikipedia/tutorials/third-party icon pages, never invented URLs.
- **Presentation preserved**: heading, subtitle, circular masks, icon assets,
  hover zoom/glow, `prefers-reduced-motion` (animation fully stopped when
  reduced motion is active), IntersectionObserver pause when off-screen, and
  ResizeObserver re-clamping on resize all stay intact. Keep this rule in sync
  with `README.md`.

## Admin Messages — Query Inbox (Public Website, AWS-01 R01)

Keep in sync with the master doc **Progress Tracking ("Admin Messages Query
Inbox — Fresh Redesign (AWS-01 R01)" + "Admin Messages Query Inbox — Two-Way
Conversation + Inbound Email + Public Email Branding Cleanup (AWS-01 R01)" +
"Admin Messages Query Inbox — R01 Phase 2: Workflow + Backend Logic Completion
(AWS-01 R01, 2026-08-16)" + "Admin Messages Query Inbox — R01 Phase 3: Incoming
Email → Chat Final Fix (AWS-01 R01, 2026-08-16)") entries**. Never regress:

- **Boundary**: this feature touches ONLY the public admin page
  `app/admin/messages` (client component), its `core/services/ticketService.ts`
  API layer, the `app/api/tickets/*` backend routes, `lib/tickets/email.ts`
  (shared ticket email/template logic), `core/services/clientPortalGreeting.ts`,
  and the public Get in Touch → Query Inbox connection. NEVER touch
  `/internal/api/*`, the Communications Center, mailboxes, auth, notifications,
  the storefront, or the public website beyond the Get in Touch form.
- **Workflow invariants (R01 Phase 2)**: a Get in Touch submission creates ONE
  ticket with `status:"open"` — it appears under Active, shows Open, is
  selectable, and nothing ever auto-closes / auto-resolves / auto-mutates it.
  Close/Open is MANUAL ONLY via `PUT /api/tickets/[id]/status`. The UI derives
  its Open/Close + read-only state from `status` ONLY (never `chatStatus` —
  the backend keeps the fields in sync, the UI never reads the second field).
  The thread renders CLIENT/ADMIN bubbles from `messages[]` (client left, admin
  right, chronological; green "Sent via email" / red "Email failed" + error
  title / amber "Stored, not emailed" indicators; `via email` tag on inbound
  email entries) and falls back to the history timeline only for pre-R01
  tickets. The Resolution Summary editor stays reachable in the selected
  conversation at ANY status (incl. right after Close — the pinned ticket keeps
  the thread + editor open) and the Resolution Email NEVER auto-closes.
- **Get in Touch never auto-delivers credentials**: the public contact
  submission (`POST /api/tickets/public`) only creates the Query Inbox
  conversation. The ONLY credential-delivery path is the admin "Send
  Credentials" button (`POST /api/tickets/[id]/send-client-portal-access`),
  which reuses or creates the client account via `createClientAccount` and
  renders the DB `client-portal-onboarding` template. Temporary passwords are
  securely generated, bcrypt-hashed, NEVER stored/logged, returned once in the
  response, require first-login change, and existing client passwords are never
  overwritten. "Send Resolution Email" NEVER creates accounts and NEVER
  delivers credentials. The Send Credentials button (loading + success/error
  states, "Create Account & Send Credentials" when no account exists) sends
  ONLY on the explicit admin click and the UI NEVER displays the password —
  no `send-credentials` endpoint exists (the existing route performs the
  capability safely; never duplicate it).
- **No internal markers in customer output**: `-- Client Portal Greeting --` /
  `-- End Client Portal Greeting --` markers exist ONLY as admin-side insertion
  anchors; every customer-bound email body passes through `stripAdminMarkers`.
  The greeting itself is the marker-free shared builder
  `core/services/clientPortalGreeting.ts` (professional, editable,
  portal-login block + "The Websmith Digital Team" sign-off).
- **Query Inbox list**: server-side pagination (`QUERY_INBOX_PAGE_SIZE = 15`,
  `page`/`pageSize`/`limit`, `hasMore`/`total`) + escaped-regex `search`
  AND-combined with the role scope (client/developer `$or` can never widen) +
  `scope=active|closed`; soft-deleted rows (`deletedAt`) are excluded from
  every view, never shown.
- **Delete is soft-delete**: `DELETE /api/tickets/[id]` sets
  `deletedAt`/`deletedBy` + `status: closed` + `chatStatus: closed` + a
  `deleted` history entry — real customer history is never permanently
  destroyed.
- **Resend uses the stored snapshot**: admin replies and resolution/onboarding
  emails store `recipient`/`subject`/`emailBody` at send time;
  `POST /api/tickets/[id]/resend` re-sends exactly that snapshot (never
  stale/arbitrary UI text).
- **Resolution Email block rule**: `renderResolutionTemplate` renders the
  `{{temporary_password}}` block only when a temporary password is present and
  the Client ID block only when a client account exists; empty blocks are
  omitted (no placeholder leakage).
- **Two-way conversation = `messages[]` on the same ticket** (canonical thread,
  no second system): Get in Touch (`POST /api/tickets/public`) seeds the initial
  client message + `lastClientReplyAt` + `adminReadAt:null`; admin replies,
  resolution-email, onboarding and resend append outbound entries carrying the
  Brevo `providerMessageId` + honest `deliveryStatus` (`sent`/`failed`/
  `not_sent`); `history` stays the audit log (Resend snapshots, status changes).
  The Query Inbox renders CLIENT/ADMIN bubbles from `messages` and falls back to
  the history timeline for pre-R01 tickets.
- **Inbound email is a BRIDGE over the universal receive system — never a
  second receiver** (`POST /api/tickets/inbound`): the platform's ONE inbound
  receiver is the UNIVERSAL Websmith email receive system (mailbox IMAP sync
  `POST /internal/backend/mailboxes/[id]/sync` + public `POST
  /api/portal/support-message`), which stores every processed customer inbound
  message in the license-system PostgreSQL tables `communication_conversations`
  / `conversation_messages`. The Query Inbox route reads those ALREADY
  PROCESSED customer messages READ-ONLY via `getDb` (`sender_type='customer'`,
  `is_internal IS NOT TRUE`, non-deleted conversations, newest `BRIDGE_BATCH_LIMIT`
  200 per pass), matches each one to the client's existing ticket
  (identity-first: conversation customer email == ticket `contactEmail`, NEVER
  subject alone; thread-identity tiebreak = normalized subject match, then
  newest `updatedAt`), and appends the message to `messages[]` + `client_reply`
  history + `lastClientReplyAt`, reopening `closed → in_progress`. Dedupe is by
  the source PostgreSQL `conversation_messages.id` stored as `sourceRef`
  (`cm:<id>`) + a body/timestamp content guard; bodies pass through
  `cleanInboundBody` at bridge time; attachment BYTES are copied from
  `conversation_attachments.content` into the shared `uploads` collection and
  linked to the message; the conversation's `created_at` timestamp is
  preserved. No mailbox row/credential/SMTP/IMAP/schema is ever touched; no
  `imap`/`mailparser` here.
- **Unread is server-derived**: `GET /api/tickets` returns `hasNewClientReply` =
  `lastClientReplyAt > adminReadAt`; `POST /api/tickets/[id]/read` stamps
  `adminReadAt`; the UI auto-marks read on open and shows unread dots on rows.
- **Public email branding is generic**: `lib/email/brevo.ts` `wrapHtml`
  header/footer never hardcode a product line ("License Management") — a
  configurable `BRANDING_TAGLINE` (default "Software Development & Client
  Support") is used. Internal API email templates and license-specific copy are
  untouched.
- **Customer email rendering is clean**: customer message text is rendered
  through the pure helpers `renderCustomerMessageHtml` /
  `renderCustomerMessagePlain` in `lib/tickets/email.ts` (Markdown tables →
  real HTML tables / separator rows stripped, HTML escaped) — no raw `| :-: |`
  markup ever reaches a customer.
- **Resolution stays reachable after Close**: the Query Inbox pins a just-closed
  conversation so the Resolution Summary editor + Resolution Email remain
  enabled and usable right after Resolved/Closed.
- **Admin Messages Query Inbox — R01 Phase 3: Incoming Email → Chat Final
  Fix (AWS-01 R01)**: completes the client-email → Messenger Chat direction.
  (1) **Admin identity**: every displayed admin name that is missing/generic
  (`"Admin User"`, `"Websmith Team"`, `"Websmith Support Team"`, `"Websmith
  Support"`, `"Support Team"`, or empty) is normalized at RENDER TIME to
  **"Websmith Digital Support"** (`ADMIN_SENDER_LABEL` in
  `app/admin/messages/AdminMessagesClient.tsx`); a real admin name is
  preserved. This is UI-only — outbound Brevo `from`/`name` (via
  `lib/email/brevo.ts`) is untouched, so outgoing chat→client email keeps the
  real receiving-account identity. (2) **Body-only in chat**: the inbound
  email is stored with `message` = `parsed.text || parsed.html` only — the
  email envelope/header/signature-auth metadata is never persisted or
  rendered (existing dedupe by Message-ID + chronological `messages[]`
  ordering ensure the client reply appears once). (3) **Incoming
  attachments**: `POST /api/tickets/inbound` reads `parsed.attachments`,
  stores the attachment BYTES in the shared `uploads` collection
  (`storeInboundAttachments`, max 10MB, shared `validateAttachmentFiles`
  policy) and links them to the new `conversation_messages`/`messages` row
  (`attachments: [{name,url,size,contentType}]`); the ORIGINAL email (with
  its attachments) stays in the support mailbox untouched (IMAP opened
  READ-ONLY, never marks Seen / never deletes) so it "reaches
   `support@websmithdigital.com`" directly, and the stored bytes guarantee
   the chat rendering can never lose the attachment. The Messenger Chat
   renders a compact, read-only attachment indicator (name + size +
   `GET /api/uploads/<id>` download link) — no composer/resend UI for
   inbound attachments. (4) **Auto-poll for live chat** (`AdminMessagesClient.tsx`): when a conversation is open, a 30-second silent interval polls the existing `/api/tickets/inbound` IMAP sync; if new client messages are matched (`result.matched > 0`), the open thread is refreshed via `refreshOpenTicket()` so the reply appears in Messenger Chat immediately — no manual Sync Inbound click required; the manual button remains for immediate sync. (5) **Reply Thread + Resolved Preview clear on send** (`AdminMessagesClient.tsx`): after `handleReply` succeeds, `setGreetingKey("")` is called alongside `setReply("")` so the "Resolved Preview" card is removed (not left stale); selecting a new template re-generates the preview from ticket data, and the custom-edited textarea content is what gets sent — one reply = one outgoing email. Files: `app/admin/messages/AdminMessagesClient.tsx`. Verified: `npx tsc --noEmit` EXIT 0, `npx next build` EXIT 0.
- **Admin Messages Query Inbox — R01 Phase 4: Inbound Email → Chat auto-sync (3s) + mailbox routing fix (AWS-01 R01, 2026-08-17)**: the client email reply now appears in Messenger Chat automatically within ~3 seconds and the reply→support@ routing dependency is closed in code. (1) **Sync Inbound button REMOVED** (`AdminMessagesClient.tsx`) — the Query Conversation header no longer has the manual button; only the silent background auto-poll remains (no toast, no visible loader). (2) **Auto-poll every 3 s**: `POLL_INTERVAL_MS = 3_000`, first poll ~800 ms after open; polls ONLY while a conversation is selected AND `status !== "closed"`; stops on deselect/unmount; an in-flight ref guard (`pollInFlight`) never lets two IMAP sweeps overlap; transport switched to `quietFetch` (`syncInboundEmail` in `core/services/ticketService.ts`) so a session expiry can never kill the page and the poll is fully silent — refresh (`refreshOpenTicket()`) happens only when `matched > 0`. (3) **Chat bubble shows ONLY client name + body + timestamp + attachment link** for inbound client email — `senderEmail` and the "via email" tag are no longer rendered on client bubbles (admin delivery indicators unchanged); bodies are cleaned at STORE time by `cleanInboundBody()` in `app/api/tickets/inbound/route.ts` (quoted `>` blocks, "On … wrote:", `-----Original Message-----`, Outlook `From:/Sent:/To:` header blocks, `--` signatures, "Sent from my iPhone/…") plus a display-only client mirror (`cleanClientBody`) for pre-fix stored rows; duplicate protection (Message-ID dedupe) and chronological ordering unchanged. (4) **Inbound sync hardening** (`inbound/route.ts`): each poll processes only the NEWEST `MAX_UNSEEN_BATCH` (40) UNSEEN messages so the 3 s poll stays light with a backlog (mail is opened READ-ONLY, never marked Seen; dedupe makes re-processing harmless); a module-level in-flight guard skips overlapping syncs (`skipped:true`); the sender fallback now honors thread identity — among the sender's tickets the one whose normalized subject matches the inbound subject (Re:/Fwd: stripped) wins, newest-updated tiebreak (NEVER subject alone; sender match is still the gate). (5) **Reply → support@ routing dependency fixed in code** (`app/api/tickets/[id]/replies/route.ts`): the admin reply's From is resolved by `resolveReplySender()` to an **enabled PostgreSQL `mailboxes` row whose address equals the resolved support address** (Manage Page `contact_info.email` → env fallback → `support@websmithdigital.com`) and passed as the existing `sendEmail` `from` override — so the client's reply loops back to support@ and enters the UNIVERSAL receive system (Client → support@ → universal receive → bridge → ticket → Messenger Chat). When no enabled mailbox matches, the default support sender is used unchanged. Honest mailbox dependency: the inbound parser reads ONLY enabled PG `mailboxes` (IMAP READ-ONLY, UNSEEN); if support@ mail does not land in such a mailbox (MX/forwarding or credentials), the route reports it and the chat shows no inbound message — no fake mailbox state anywhere. Files: `app/api/tickets/inbound/route.ts`, `app/api/tickets/[id]/replies/route.ts`, `core/services/ticketService.ts`, `app/admin/messages/AdminMessagesClient.tsx`. Verified: `npx tsc --noEmit` EXIT 0, `npx next build` EXIT 0, cleaner 8/8 unit samples. NOT deployed; awaits user approval + live mailbox verification (real external Gmail/Outlook reply).
- **Admin Messages Query Inbox — R01 Phase 5: FINAL FAST INBOUND CHAT — 1-second poll (AWS-01 R01, 2026-08-17)**: the auto-poll interval is now **every 1 second** (`POLL_INTERVAL_MS = 1_000` in `app/admin/messages/AdminMessagesClient.tsx`, first poll ~800 ms after open) so a client email lands in Messenger Chat within **≤1 s** and never later than the **3-second maximum** — the 3-second polling interval was deliberately NOT used. Everything else from Phase 4 is unchanged and preserved: no manual Sync button, no page refresh, no admin action; the silent background poll runs only while a conversation is selected AND not closed (client `pollInFlight` ref guard + server `syncInflight` guard never overlap); `quietFetch` transport so a session expiry can never kill the page; refresh (`refreshOpenTicket()`) only when `matched > 0`; body-only clean client bubbles (name + body + timestamp + attachment link); Message-ID dedupe; chronological order; existing ticket/client identity; outgoing Chat→client email (`[id]/replies` From resolves to the enabled mailbox whose address equals the resolved support address — `contact_info.email` → env fallback → `support@websmithdigital.com` — so the client's reply loops back to support@ and enters the UNIVERSAL receive system (bridge → ticket → Messenger Chat)), templates, client ID, temporary credentials, the existing ticket/message system, and the existing UI/UX all preserved. Production dependency (code-verified, Phase 2 FINAL): the bridge reads ONLY ALREADY-PROCESSED universal customer messages (PostgreSQL `conversation_messages`); support@ mail reaches the app through the universal receive system (mailbox IMAP sync + portal support-message), never through a second receiver. Files: `AdminMessagesClient.tsx` (interval + comments), `core/services/ticketService.ts` + `app/api/tickets/inbound/route.ts` (comment sync only). Verified: `npx tsc --noEmit` EXIT 0, `npx next build` EXIT 0. Deployed 2026-08-17.
- **Admin Messages Query Inbox — R01 FINAL FIX: Brevo Inbound Webhook for native support@ (AWS-01 R01, 2026-08-17)**: support@websmithdigital.com is a NATIVE system account (`IMAP = n/a`, `Sync = n/a`), so the IMAP poller can NEVER receive client replies — the app previously had NO inbound receiver for native mail at all (verified: `websmithdigital.com` MX = `mx1/mx2.privateemail.com` — support@ is a real inbox there; Brevo is send-only). The fix is the minimum **Brevo inbound parsing webhook**: `POST /api/brevo/inbound` (`app/api/brevo/inbound/route.ts`, public but token-gated — `x-inbound-token` header or `?token=` must equal the `BREVO_INBOUND_WEBHOOK_TOKEN` env var; env missing → 503 with an explicit "not configured" message, mismatch → 401) receives Brevo's `inboundEmailProcessed` payload (`items[]`, PascalCase: `MessageId`/`InReplyTo`/`From{Address,Name}`/`To[]`/`Recipients[]`/`SentAtDate`/`Subject`/`RawTextBody`/`RawHtmlBody`/`Attachments[{Name,ContentType,ContentLength,DownloadToken}]`/`Headers`), processes ONLY items addressed to the support account (`isSupportRecipient`: the resolved support address `contact_info.email` → `MAIL_SUPPORT_ADDRESS` env → `support@websmithdigital.com`, or `support@*.websmithdigital.com` — sales@/no-reply@ never matched; self-sender and non-support items skipped), downloads attachments via Brevo `GET /v3/inbound/attachments/{downloadToken}` (10 MB cap, best-effort), and feeds EVERY item through the SAME shared pipeline: **`lib/tickets/inbound-core.ts`** (the exact `processInboundEmail`/`cleanInboundBody`/Message-ID dedupe/`storeInboundAttachments`/`messages[]` logic moved verbatim from the IMAP route — the IMAP route `app/api/tickets/inbound/route.ts` now imports it, zero behavior change; ONE pipeline, TWO transports). **UI** (`app/admin/messages/AdminMessagesClient.tsx`): `refreshOpenTicket()` is diff-based (`updatedAt`/`lastClientReplyAt`/`messages.length` — no state churn when unchanged) and the 1-second auto-poll ALWAYS re-checks the open thread after the silent IMAP sync, so webhook-delivered mail (which carries no matched-count signal) appears in Messenger Chat within ≤1 s (max 3 s) with no page refresh and no manual button. Outbound, templates, client ID, temp credentials, resolution, unsubscribe, status logic, "Websmith Digital Support" identity and existing outgoing email are all untouched — admin replies stay `support@websmithdigital.com` only. **External configuration REQUIRED (report to the user, do not invent it)**: (1) `BREVO_INBOUND_WEBHOOK_TOKEN` env var; (2) Brevo dashboard: inbound webhook `type:"inbound"`, `events:["inboundEmailProcessed"]`, `url:"https://www.websmithdigital.com/api/brevo/inbound"`, `domain:"reply.websmithdigital.com"`, header `x-inbound-token: <token>`; (3) DNS: `reply.websmithdigital.com` MX 10 → `inbound1.sendinblue.com.`, MX 20 → `inbound2.sendinblue.com.` (websmithdigital.com MX NEVER touched — the complete original email keeps arriving at support@); (4) support@ (Namecheap Private Email) forwarding rule → `support@reply.websmithdigital.com` (forwarded copy; original stays in the inbox). Verified: `npx tsc --noEmit` EXIT 0, `npx next build` EXIT 0 (294 pages). NOT deployed; awaits user approval + the external configuration.
 - **Admin Messages Query Inbox — R01 FINAL FIX: REAL inbound transport (read-only IMAP for native support@) + FAST Query Inbox (AWS-01 R01, 2026-08-17)**: the Brevo bridge is NOT operational (no MX for `reply.websmithdigital.com` and no `BREVO_INBOUND_WEBHOOK_TOKEN` env → the deployed webhook answers 503), and provider research proved the ONLY real receiving mechanism Namecheap Private Email (Open-Xchange) offers is standard IMAP/POP3 (`mail.privateemail.com:993` SSL) — there is NO inbound webhook and NO message-reading API (Namecheap API = DNS/mailbox CRUD only). Therefore the existing inbound receiver (`POST /api/tickets/inbound`, `app/api/tickets/inbound/route.ts`) now ALSO polls the native support@ mailbox READ-ONLY with provider credentials from env vars (`nativeSupportMailbox()`: `MAIL_SUPPORT_IMAP_HOST` default `mail.privateemail.com`, `MAIL_SUPPORT_IMAP_PORT` default 993, `MAIL_SUPPORT_IMAP_SECURE` default true — set `"false"` for STARTTLS/143, `MAIL_SUPPORT_IMAP_USERNAME` default `MAIL_SUPPORT_ADDRESS` → `support@websmithdigital.com`, `MAIL_SUPPORT_IMAP_PASSWORD` REQUIRED). The SINGLE provider-side dependency is `MAIL_SUPPORT_IMAP_PASSWORD` (the support@ mailbox password from the Namecheap Private Email dashboard — the app never stored native-account credentials); without it the native poll is skipped and the sync summary's `errors[]` reports the exact missing configuration (never silent). The native mailbox flows through the SAME `syncMailbox()` + `processInboundEmail()` pipeline (ticket matching, `cleanInboundBody`, attachment storage, Message-ID dedupe, `messages[]`), opened IMAP READ-ONLY (never marks Seen, never mutates the mailbox → webmail + Internal Communications Center unaffected). Constraints honored: support@/sales@/no-reply@ unchanged, websmithdigital.com MX untouched, NO new mailbox/row, NO schema change, NO IMAP wiring into the Internal API mailbox system (native accounts stay `IMAP = n/a` there); the Brevo webhook route stays untouched but is no longer required. **FAST Query Inbox** (`app/admin/messages/AdminMessagesClient.tsx` + `core/services/ticketService.ts`): (1) the 1-second auto-poll's `refreshOpenTicket()` now uses `getTicketsQuiet()` (quietFetch transport, same response shape as `getTicketsPaged`) so a session expiry can NEVER page-replace the admin mid-poll (the axios interceptor is correct for user actions, never for a silent background poll); (2) every ⋮ action (Open / Close / Delete / Resend) runs independently with a per-action local loading state (`busyAction`/`busyTicketId`: spinner only on the in-flight menu item) and updates the affected card IN PLACE from the full-ticket API response (`applyTicketUpdate`; Delete removes only that card + decrements `total`) — the Query Inbox is never reloaded, no scroll reset, no layout/width change, conversation pane untouched; (3) Send Reply applies the returned updated ticket in place instead of a full list refresh. Ticket selection was already instant (list object, no detail fetch — account card unchanged). Files: `app/api/tickets/inbound/route.ts`, `lib/tickets/inbound-core.ts` (header comment only), `core/services/ticketService.ts`, `app/admin/messages/AdminMessagesClient.tsx`. Verified: `npx tsc --noEmit` EXIT 0, `npx next build` EXIT 0. NOT deployed; awaits user approval + setting `MAIL_SUPPORT_IMAP_PASSWORD` (provider-side dependency) and a real reply test (Client Gmail/Outlook → support@ → read-only IMAP poll → ticket message in Messenger Chat within ≤1 s). 
 - **Admin Messages Query Inbox — R01 LIVE: env configured, transport verified, deployed (AWS-01 R01, 2026-08-17)**: the receive pipeline is now LIVE end-to-end. (1) **Production env configured** — `MAIL_SUPPORT_IMAP_HOST=mail.privateemail.com`, `MAIL_SUPPORT_IMAP_PORT=993`, `MAIL_SUPPORT_IMAP_SECURE=true`, `MAIL_SUPPORT_IMAP_USERNAME=support@websmithdigital.com`, `MAIL_SUPPORT_IMAP_PASSWORD=<support@ mailbox password>` all added to Vercel production (Sensitive) + `.env.local` (never committed; no git diff). (2) **Transport verified with REAL credentials** — read-only login to `mail.privateemail.com:993` (Dovecot IMAP4rev1, authorized TLS cert) PASSED; INBOX opened READ-ONLY; 2 UNSEEN messages parsed via `simpleParser` (UID 23 = self-sent "General Inquiry" from support@, UID 24 = Namecheap welcome mail — NOT client replies); the mailbox was never mutated (never marks Seen). (3) **Pipeline traced + verified** — `app/api/tickets/inbound/route.ts` `nativeSupportMailbox()` + shared `processInboundEmail()` (`lib/tickets/inbound-core.ts`) are the exact code path production polls every 1 s; matching by thread (In-Reply-To/References → `messages.providerMessageId`) then sender fallback, sender ALWAYS verified against `contactEmail`, Message-ID dedupe, `cleanInboundBody`, `uploads` attachment storage, `messages[]` append with timestamp. (4) **Deployed 2026-08-17** — `npx tsc --noEmit` EXIT 0, `npm run build` EXIT 0, `vercel --prod` green; production routes verified live: `POST /api/tickets/inbound` + `GET /api/tickets` answer 401 (auth gate) — no 500s. (5) **Transient Atlas incident observed (NOT code)** — during verification `ac-o1abmjb-shard-00-02.wr0yzts.mongodb.net` (the cluster PRIMARY) intermittently rejected TLS with `tlsv1 alert internal error` (alert 80) from BOTH Vercel and the dev machine, taking all Mongo-backed routes down (`/api/tickets`, `/api/tickets/inbound`, `/api/users/notifications` 500s — `MongoServerSelectionError`); status.mongodb.com showed NO incident; the failure self-resolved within the hour (all 3 shards TLS OK, full-URI connect PASS, writablePrimary = shard-00-02) and production returned to 401-gaited health — no code/env change was made for this. (6) **Final acceptance STILL REQUIRED** — the real end-to-end test: send a reply from a real Gmail/Outlook client (e.g. reply to the admin email on ticket "AI Voice Agent" / keemodatabox@gmail.com, with an attachment) → support@websmithdigital.com → read-only IMAP poll → same Query Ticket → Messenger Chat shows body + attachment + timestamp, no duplicate, within ≤1 s. Outgoing Chat → support@ → client unchanged (`[id]/replies` From = enabled mailbox matching the resolved support address, else default support sender).
 - **Admin Messages Query Inbox — R01 ROUTING DATA FIX: contact_info swap (AWS-01 R01, 2026-08-17)**: the production `settings` document `contact_info` had `email` = **sales@websmithdigital.com** and `sales_email` = **support@websmithdigital.com** (inverted). Since the universal Brevo sender logic derives `support_reply`/`admin_notification`/`conversation_created` From from `contactInfo.email` (`getSupportAddress` in `lib/email/brevo.ts`) and `new_sales_enquiry`/`sales_reply` from `contactInfo.sales_email`, ALL support replies were sent FROM sales@ — so client replies went to the sales@ mailbox, which the Query Inbox inbound poll never reads (it reads native support@ via `MAIL_SUPPORT_IMAP_*` + enabled PG `mailboxes` only). VERIFIED chain (2026-08-17): Brevo accepted both admin replies (`deliveryStatus: "sent"`, messageIds `<202608170628.52498552064@smtp-relay.mailin.fr>` / `<202608170721.40186629963@smtp-relay.mailin.fr>`); support@ INBOX + Spam had ZERO messages since Aug 17; MX probe = `mx1/mx2.privateemail.com`; SMTP RCPT probing blocked by Namecheap. FIX (DATA-ONLY, no code change, no UI, no templates, no Brevo, no MX, no mailbox changes): `$set {"value.email": "support@websmithdigital.com", "value.sales_email": "sales@websmithdigital.com"}` applied to the production `contact_info` record (matched 1, modified 1), applied via a direct-connection probe of the writable primary after a recurring Atlas TLS outage (`tlsv1 alert internal error` alert 80 on `ac-o1abmjb-shard-00-02` — worked with `tlsAllowInvalidCertificates` on the one-shot script only). VERIFIED LIVE: `GET https://www.websmithdigital.com/api/settings/public/contact_info` returns `email: support@websmithdigital.com`, `sales_email: sales@websmithdigital.com` (HTTP 200, 2.4s); `GET /api/tickets` healthy (401, 2.2s). Semantics now universal: support@ = General Support / Query Inbox / TWO-WAY; sales@ = Sales / TWO-WAY; no-reply@ = OTP/system ONE-WAY (no_reply_email empty in contact_info → falls back to `SENDER_EMAIL`/`MAIL_FROM_ADDRESS` as before — unchanged). Outstanding: real end-to-end client reply acceptance (send Gmail/Outlook reply → support@ → read-only IMAP poll → same ticket → Messenger Chat ≤1 s, body + attachment + timestamp, no duplicate).
 - **Admin Messages Query Inbox — R01 PHASE 2 FINAL: Universal Email + Live Query Chat Bridge (AWS-01 R01, 2026-08-17)**: the R01 duplicate receivers are REMOVED and the platform is back to ONE universal email receive system. **Removed (R01 duplicate receive implementation)**: `nativeSupportMailbox()` + all `MAIL_SUPPORT_IMAP_*` usage (code + `.env.local` + Vercel production env) + direct Query Inbox IMAP polling (`syncMailbox` over enabled PG `mailboxes`) from `app/api/tickets/inbound/route.ts`, and the whole `app/api/brevo/inbound/route.ts` webhook receiver (deleted; it was never operational — no `BREVO_INBOUND_WEBHOOK_TOKEN`, no `reply.websmithdigital.com` MX). **The Query Inbox NEVER receives email**: the platform's ONE inbound receiver is the UNIVERSAL Websmith email receive system (mailbox IMAP sync `POST /internal/backend/mailboxes/[id]/sync` + public `POST /api/portal/support-message`), which stores every processed customer inbound message in PostgreSQL `communication_conversations` / `conversation_messages`. **The bridge** (`POST /api/tickets/inbound`, admin-only): reads ALREADY-PROCESSED customer messages READ-ONLY via `getDb` (`sender_type='customer'`, `is_internal IS NOT TRUE`, `cc.deleted_at IS NULL`, newest `BRIDGE_BATCH_LIMIT` 200 per pass, processed ascending for chronology), batch-reads attachment bytes (`conversation_attachments.content` BYTEA, best-effort, 10 MB), and for each message `bridgeConversationMessages()` (`lib/tickets/inbound-core.ts` — the ONLY `processInboundEmail`/`InboundMessage`/`collectIds` raw-email pipeline is gone) matches the client's existing ticket (identity-first: conversation customer email == ticket `contactEmail`, NEVER subject alone; thread-identity tiebreak = `normSubject` match, then newest `updatedAt`), dedupes by the source PG id stored as `sourceRef` (`cm:<conversation_messages.id>`) + a body/timestamp content guard for pre-bridge entries, cleans the body at bridge time (`cleanInboundBody`), copies attachment bytes into the shared `uploads` collection + links them, preserves the conversation's `created_at` timestamp, appends `messages[]` + `client_reply` history + `lastClientReplyAt`, and reopens `closed → in_progress`. NO mailbox row/credential/SMTP/IMAP/schema change — no `imap`/`mailparser` here. **UI unchanged** (`AdminMessagesClient.tsx`, `core/services/ticketService.ts`): the 1-second auto-poll (quietFetch, `pollInFlight` guard, silent) calls `syncInboundEmail()` then the diff-based `refreshOpenTicket()` so a client email appears in Messenger Chat within ≤1 s (max 3 s); `ThreadMessage` gained optional `sourceRef`. Outbound Chat→client email unchanged (`[id]/replies` From = enabled mailbox matching the resolved support address — `contact_info.email` → env fallback → support; never hardcoded). Files: `app/api/tickets/inbound/route.ts` (rewritten), `lib/tickets/inbound-core.ts` (rewritten), `app/api/brevo/inbound/route.ts` (DELETED), `core/services/ticketService.ts`, `app/admin/messages/AdminMessagesClient.tsx` (comments only), `.env.local` (MAIL_SUPPORT_IMAP_* removed). Verified: `npx tsc --noEmit` EXIT 0, `npm run build` EXIT 0. NOT deployed — awaits user approval + production env cleanup (`MAIL_SUPPORT_IMAP_*` on Vercel) + real end-to-end acceptance (client reply → support@ → universal receive → bridge → Messenger Chat ≤1 s, no duplicate).
 - **Admin Messages Query Inbox — R01 NATIVE RECEIVE LIVE FIX: QStash cron + proxy path + IMAP fetch bug (AWS-01 R01, 2026-08-18)**: the production native-receive flow was BROKEN at the first hops — the QStash → `/internal/backend/communications/native-receive` chain never ran. (1) **Hop 1 — QStash invocation**: NO schedule existed (QStash `GET /v2/schedules` = 0) AND `proxy.ts` `PUBLIC_PATHS` did not include the native-receive path, so a QStash POST would have been 401'd by the session proxy. FIX: added `/internal/backend/communications/native-receive` to `PUBLIC_PATHS` (QStash-signed system callback — the route's own `verifySignatureAppRouter` is the real security gate) and created the QStash cron via `POST https://qstash-us-east-1.upstash.io/v2/schedules/<url-encoded destination>` with header `Upstash-Cron: * * * * *` (cron in the HEADER, destination in the PATH, body = message payload; scheduleId `scd_75p368ydrEyw33Q6bsJZNjkqMPSG`, `Upstash-Timeout: 60s`, `Upstash-Retries: 3`) — the workspace region is **us-east-1** (the global `qstash.upstash.io` endpoint resolves to eu-central-1 and returns 404 "user not found in this region"; the signing-keys endpoint does not exist via REST — 404 `Cannot GET /v2/signing-keys`). (2) **Hop 3 — IMAP fetch bug in `native-receive/route.ts`**: the route used `imap.on('message', …)` WITHOUT an `imap.fetch()` call, so no message events ever fired and the cycle HUNG forever whenever UNSEEN mail existed (the proven pattern is `mailboxes/[id]/sync/route.ts`: `imap.fetch(uids, { bodies: '', struct: true })` + `fetch.once('end')` → `imap.end()`). FIX: replaced the broken block with the proven fetch pattern; added `export const maxDuration = 60`. (3) **Vercel production env**: the 10 `MAIL_*_IMAP_*` vars were recreated as type `"encrypted"` via the Vercel REST API (delete + POST `{key,value,type:"encrypted",target:["production"]}`) with REAL provider credentials (host `mail.privateemail.com`, port `993`, secure `true`, usernames `support@`/`sales@websmithdigital.com`) and verified via `GET /env/{id}?decrypt=true` + `x-vercel-decrypt: true` — `vercel env add --sensitive` stores vault-type rows that `env pull` shows as literal `[SENSITIVE]` and the API cannot decrypt; never accept `[SENSITIVE]` as verification. **Deployed 2026-08-18**, build green. **LIVE verification (production PG, read-only)**: the cron fires every minute (`native_mail_account_synced` audit rows; 12 cycles/2h, 0 error rows); first fire imported the 32-message backlog (`new=32`), subsequent cycles `new=0, updated=2, skipped≈40` (dedupe re-matches, never duplicates); all 340 stored `conversation_messages` have DISTINCT `provider_message_id` (delta=0); native accounts load from `system_settings.communications.mail_accounts` (support/sales enabled, no-reply disabled); an unsigned POST to the production route now reaches the QStash verifier (403 "`Upstash-Signature` header is missing") instead of the proxy 401. **Bridge hop unchanged**: `POST /api/tickets/inbound` still matches identity-first (conversation customer email == ticket `contactEmail`) — test emails sent FROM `keemogamer@gmail.com` correctly do NOT bridge to the `keemodatabox@gmail.com` tickets (identity-first is by design); the final acceptance test must reply from the ticket's own client address → support@ → Messenger Chat (≤1 s poll). Files: `proxy.ts`, `app/internal/backend/communications/native-receive/route.ts`. No SMTP/send/queue/schema/auth/notification/storefront changes.
- **Admin Messages Query Inbox — R01 CLIENT CHAT VISUAL UPDATE: 550px card + Lanuage Racer Websmith.png left band + 60 programming-icon balloons + random 3× zoom (AWS-01 R01, 2026-08-19)**: SUPERSEDES the prior chat visuals in `app/chat/[id]/ClientChat.tsx` (UI-only, single-file diff). (1) **Card**: `min(550px,100%)` × `min(800px,92dvh)`, centered, clear space above/below, decorations never reduced, mobile full-width usable. (2) **Left**: `public/images/Lanuage Racer Websmith.png` (852×1846) fills the left band (far left → card left edge `calc(50% - 275px)`), NO mask/border/crop (`object-fit: contain`), behind card, never inside it. (3) **Right**: exactly **60 × 80px programming-language bubbles** from the REAL icons in `public/wds_icon` (50 Devicon SVGs + 10 core-language repeats = 60; no invented icons; all references verified to exist), random `left 48–98%`, behind card, clear of the left image. (4) **Balloon**: start below viewport → `translateY(-115vh)`, 18–36s, negative random delays, sway ±10px, opacity 0.08–0.24. (5) **NEW random 3× zoom**: JS timer (random 2.3–4.5s) selects ONE bubble → `wsBubbleZoom` `transform: scale(3)` (0.75s in + 1.5s hold + 0.75s out, forwards); next can start during the previous return (transition-only overlap); no reflow, card size unchanged, controls never covered. (6) **Responsive**: below 768px decorations hide (`.ws-hide-mobile`); `prefers-reduced-motion` stops all. Hard boundary: chat API/JWT/status/send/email/Query Inbox/onboarding/DB/login/home untouched — visuals only. Verified: `npx tsc --noEmit` EXIT 0, `npm run build` EXIT 0. NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 LANGUAGE RACER LIVE: 3-track animated racer + Query Inbox controls fixes (AWS-01 R01, 2026-08-19)**: SUPERSEDES the prior chat visuals in `app/chat/[id]/ClientChat.tsx` and fixes the Query Inbox card controls in `app/admin/messages/AdminMessagesClient.tsx` (UI-ONLY, two-file diff). **(1) Card chips** — Get in Touch + priority stay on one row, nudged right (`marginLeft 6px`) and +~5px height/width (`padding 2px 8px → 5px 10px`); the priority dropdown is a proper chip-shaped select (`appearance:none` + Websmith-blue chevron data-URI, fixed 25px height, bound value — the old uncontrolled select always showed "Low"). **(2) Info panel** — Get in Touch / priority info opens FIXED + CENTERED in the viewport (`left/top 50% + translate(-50%,-50%)`, `width: min(380px, calc(100vw - 32px))`, `maxHeight: min(72dvh, 460px)` + scroll, sticky centered header; SOURCE INFORMATION = Channel / Email / Company / Submitted / Subject) — never clipped, small screens auto-constrained. **(3) Priority locked** — the card shows a read-only chip (lock icon → opens the priority info panel) until ⋮ menu → **Edit** toggles edit mode (`editModeFor`); in edit mode the select saves via the EXISTING PATCH `{priority}` flow. **(4) Topbar cleaned** — top-level Edit / Delete / Open·Close buttons REMOVED from the conversation topbar; all actions (Open/Close, Edit, Delete, Resend) live ONLY in the existing 3-dot menus; the Edit menu item no longer posts a no-op subject PATCH. **(5) Chat visuals** — the static `public/images/Lanuage Racer Websmith.png` band + 60 balloons + 3x zoom are REMOVED (PNG file deleted) and replaced by a live **Language Racer** on the LEFT: 28 real technology cars + premium **WEBSMITH** car (real `public/wds_icon` Devicon icons + brand colors) on 3 vertical tracks (left bottom→top / center top→bottom / right bottom→top), journey wrappers animate `translateY(100%)↔(-100%)` (GPU transforms only) with per-car deterministic duration 9–16s / negative delays / slots / z-index overtaking / jitter, off-screen extremes = seamless boundary resets; layering track → road glow + dashed lane → car → car glow + trail; `prefers-reduced-motion` stops all. **(6) Mask circle in the card header** — Websmith Digital2.png locked inside `.ws-header-mask` inside the chat card header (44px desktop / 36px mobile, `border-radius:50%` + `overflow:hidden` + `object-fit:cover` — never escapes; Websmith-blue glow ring; NO separate right slot); messenger card UNCHANGED CENTER. **(7) Responsive** — below 1150px tracks/cars shrink via CSS custom properties; below 900px the stage becomes a column with a compact racer strip + smaller in-card mask (36px) — racer never hidden, never overflows, never covers the messenger. No backend/DB/API/token/poll/send changes. Verified: `npx tsc --noEmit` EXIT 0, `npm run build` EXIT 0. NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 CHAT FINAL 3-ZONE: exact 33% / 34% / 33% desktop split — one continuous 4-lane racing road + messenger + restored 60 flying bubbles (AWS-01 R01, 2026-08-19)**: SUPERSEDES the prior racer/track visuals in `app/chat/[id]/ClientChat.tsx` (UI-only, single-file diff). **(1) EXACT DESKTOP SPLIT** — the root is a gap-free flex row (no padding/gap): LEFT `33%` / CENTER `34%` / RIGHT `33%` (verified: 528/544/528 at 1600px, zero gap, zones sum to 100%); every zone is `overflow:hidden`, so no element can cross into another zone. **(2) LEFT 33% — ONE CONTINUOUS RACING ROAD** — a single asphalt road fills the full left-column width + full usable height with EXACTLY 4 lanes (Lane 1 ↑ / Lane 2 ↓ / Lane 3 ↑ / Lane 4 ↓ — adjacent lanes always opposite), 2 solid glowing road edges + 3 glowing dashed lane dividers at 25/50/75% (one road, no separated blocks). **16 sport/racing cars** (14 real languages + premium gold **WEBSMITH** car with the Websmith logo — NOT plain rectangles/icons): each is a styled side-profile racer (glowing body in the language's brand color, windshield, rear wing, 2 wheels, direction chevron ▲/▼, real `public/wds_icon` Devicon icon on the body, uppercase label + motion trail). Cars run continuously via per-car journey wrappers (`translateY(110%)↔(-110%)` seamless loop, extremes off-screen), deterministic duration 8–16s, negative delays (mid-road on load), lane slot, z-index pass-over + tiny jitter; cars never leave their lane (lane overflow hidden) and never enter the center. **(3) CENTER 34% — MESSENGER ONLY** — the existing chat card unchanged (messages / composer / Send / Client Login / Home / dynamic Open-Closed status dot + tooltip / secure JWT chat / live 3s poll / in-card Websmith mask circle), vertically + horizontally centered (0px offset, verified), no cars no bubbles. **(4) RIGHT 33% — THE EXISTING FLYING LANGUAGE BUBBLES (RESTORED, never removed/replaced)** — the exact 60-bubble system from the FINAL CHAT UI version: 60 × **80px circular masks** (`border-radius:50%`, `overflow:hidden`, real `public/wds_icon` assets, 50 icons + 10 core repeats), random horizontal positions 4–80% **of the right zone only**, bottom → top `translateY(-115vh)` balloon rise (18–36s, negative delays, mid-flight on load), sway ±10px, opacity 0.08–0.24, continuous looping, PLUS the **random 3× zoom** (JS timer 2.3–4.5s → ONE bubble `scale(3)` 80→240px, 0.75s in + ~1.5s hold + 0.75s out, forwards, transition-only overlap, transform-only no reflow) — all bubbles stay inside the right 33% (zone-clipped). **(5) Responsive** — ≤900px: road + bubbles hidden (`display:none`), center zone 100% width, messenger full-width usable; `prefers-reduced-motion` stops all animations. Hard boundary: chat API / JWT / status / send / poll / email / Query Inbox / onboarding / DB / login / home untouched — visuals only. Files: `app/chat/[id]/ClientChat.tsx`. Verified: `npx tsc --noEmit` EXIT 0, `next build` EXIT 0 (compiled successfully; local build aborts only at the pre-existing `native-receive` QStash signing-key env step — identical on the untouched baseline), geometry verified via headless-Chrome CDP (33/34/33, 4×25% lanes, 16 cars in-zone, card 0px-centered, 80px round bubbles in-zone). NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 CAR TRAFFIC ANIMATION ONLY: 48 moving Websmith cars (AWS-01 R01, 2026-08-19)**: SUPERSEDES the car-animation portion of the LEFT RACING ROAD FIX entry in `app/chat/[id]/ClientChat.tsx` (UI-only, single-file diff — ONLY the car generation/rendering + movement/speed logic changed; page layout, track dimensions, lane positions, road edges/dividers, Websmith/F1 road branding, kerbs, checker, footer, typography, colors, bubbles, messenger, backend/APIs/data/routing are ALL untouched). **48 Websmith cars total — 12 cars per lane × 4 lanes** (Lane 1 ↑ / Lane 2 ↓ / Lane 3 ↑ / Lane 4 ↓, directions + track design preserved). Every car carries the **Websmith logo + "WEBSMITH" text EMBEDDED ON the car body itself** (gold gradient body, `ws-car-icon` = `/images/Websmith.png` + `ws-car-brand` text inside the body; the old language-icon/label design and `RACER_CARS`/`ROAD_LANES` data are gone). **Natural traffic behavior**: per-car loop duration 16–26s + negative phase delay + lane slot + one of **6 deterministic speed profiles** (pre-built `wsTrafficUp0-5`/`wsTrafficDown0-5` keyframes whose segment lengths differ — long segments = faster, short = slower — so cars occasionally speed up / slow down); every segment uses `ease-in-out` → **all speed changes smooth, never sudden jumps, never one constant identical speed**; per-car z-index pass-over + wider horizontal jitter keep natural spacing (no stacking); both journey extremes off-screen → **seamless looping**. Cars never leave their assigned lane (`overflow:hidden` lanes + zone) and never enter the center Messenger. Keyframes are injected via a **plain `<style dangerouslySetInnerHTML>` tag** (styled-jsx strips template interpolations — the previous `{TRAFFIC_CSS}` interpolation was silently dropped, freezing all cars; documented so it is never regressed). Files: `app/chat/[id]/ClientChat.tsx` only. Verified: `npx tsc --noEmit` EXIT 0, `next build` EXIT 0, headless-Chrome CDP (1600×900): zone = left 33% full height, 12 cars per lane × 4 = 48, all branded (Websmith text + Websmith.png icon), all 4 lanes' transforms change over time (ALL_MOVING true), 48 distinct transforms (no two cars at the same position). NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 CHAT: CAR ANIMATION REMOVED — left 33% completely blank (AWS-01 R01, 2026-08-19)**: SUPERSEDES the entire left-side car/traffic animation in `app/chat/[id]/ClientChat.tsx` (UI-only, single-file diff). **(1) LEFT 33% — COMPLETELY BLANK** — the whole `LanguageRoad` component (racing road, 48 Websmith cars, 6 traffic speed profiles + `wsTrafficUp/Down` keyframes, F1 checkered line, kerbs, road edges/dividers, branded footer strip, websmith_1x1.webp watermark) was removed along with its data (`ROAD_BRAND_IMG`, `TRAFFIC_LANE_COUNT`, `TRAFFIC_CARS_PER_LANE`, `TRAFFIC_PROFILES`, `TRAFFIC_CSS`, `trafficKeyframes`), the `racerRand` helper, the car-only `WEBSCIMITH_LOGO` constant and the `road`/`lane` styles. The left zone is now an EMPTY `<div className="ws-road-zone" style={styles.roadZone} aria-hidden="true" />` — the **33% width allocation is preserved** (`roadZone` style unchanged) so the page layout never shifts. No replacement animation, image, text, placeholder or background was added. **(2) NOTHING ELSE CHANGED** — CENTER 34% messenger, RIGHT 33% flying bubbles + random 3x zoom, card dimensions, typography, colors, backend, APIs, routing and all chat logic untouched; the `@media (max-width: 900px)` rule still hides the (now-empty) `.ws-road-zone` + `.ws-bubble-zone`. Files: `app/chat/[id]/ClientChat.tsx` only. Verified: left-zone DOM contains no car/road elements. NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 LEFT 33% CHAT-STICKER BACKGROUND + SOCIAL POPUPS (AWS-01 R01, 2026-08-19)**: SUPERSEDES the left-zone visuals of the SOCIAL ICON WATER-BUBBLE POPUPS entry in `app/chat/[id]/ClientChat.tsx` (UI-only, single-file diff — the EXISTING social popup animation is PRESERVED EXACTLY and now sits on TOP of a new layer; CENTER 34% Messenger + RIGHT 33% flying bubbles + card + typography + colors + backend/APIs/data/routing ALL untouched; the car/traffic animation stays REMOVED). **(1) NEW CHAT-STICKER LAYER** — a second, independent animation layer (`ChatStickers`) inside the SAME left 33% `roadZone`, BELOW the social popups. Colorful illustrated speech-bubble stickers carry a short Websmith support message ("Hey! 👋 We are Websmith." / "Need technical support? 💬" / "Welcome to Websmith! 👋" / … — 10 fixed short messages, random selection), pop in (0 → 1 with a springy overshoot via `wsStickerLife` scale+opacity keyframes), hold briefly, then shrink/fade and are replaced. Every sticker randomizes: **color** (10 vibrant gradient interiors — green/pink/red/orange/blue/purple/teal/amber/indigo/rose), **organic blob shape** (6 blob-like `border-radius` presets, never a plain rectangle), **speech-tail side** (left/right offset diamond with a matching white outline), **rotation** (±7°), **lifetime** (5.5–10s) and **appearance delay** (700–2200ms gap). Each sticker has a **thick white 4px outline**, **soft 3D drop shadow**, **glossy top highlight** (`::before` radial gloss), compact `max-width: 165px`, small readable white text — **every message is contained inside its own sticker; text never floats on the background**. **(2) SAFE PLACEMENT (HARD CONSTRAINT)** — the whole sticker incl. its tail is placed by MEASUREMENT: each pending sticker is mounted hidden, its rotated bounding rect is measured against the real zone (ResizeObserver), then clamped to a random safe position (`STICKER_SAFE` 8px keep-out + 12-position retries with a 16px `STICKER_COLLIDE_MARGIN` so stickers never overlap each other) — nothing is ever clipped or crosses into the center/right. **Max `STICKER_MAX_ACTIVE` = 3** coexist (never fills the area), tracked by a synchronous `activeRef` + `activeIds` Set; every sticker is removed by its lifetime timer and recycled — bounded DOM, no memory growth; unmount-only teardown clears spawn timers + removal timers. **(3) SUBTLE ATMOSPHERE** — a barely-visible `.ws-atmosphere` overlay pulses a slow dim → light brightness (10s alternate, `rgba(255,255,255,0.06)` at 0.3→1.0 opacity) BEHIND the stickers; the existing background stays recognizable, no gradient blobs, no new background image. **(4) LAYER ORDER (exact)** — inside the left zone: existing/default background → subtle dim/light atmosphere → chat-sticker layer → **existing social-media popup layer on TOP** (`SocialIconPops` untouched: same 35 real `public/social_icon` SVGs, 50px base, random safe positions, max 5 active, 0→90px pop, same vanish/replace loop). The `ChatStickers` scene and the pops layer both paint at `z-index: 0` and the pops layer comes LATER in DOM, so popups always stay on top — neither layer replaces the other. **(5) RESPONSIVE + REDUCED-MOTION** — below 900px the `.ws-road-zone` stays `display:none` (measures 0 → no stickers spawned, stickers never touch the full-width messenger); `prefers-reduced-motion` hides the atmosphere + stickers and the spawn loop is skipped. CSS injected via the documented plain `<style dangerouslySetInnerHTML>` tag (`STICKER_CSS`); `scale`/`rotate`/`translate` individual transform properties compose so the life + gentle float animations never fight. Files: `app/chat/[id]/ClientChat.tsx` only. Verified: isolated type-check of the file against React 19 types = 0 errors on all new/existing code (the only 2 remaining diagnostics are the pre-existing `<style jsx>` styled-jsx intrinsics, which resolve in the real project) + esbuild TSX parse EXIT 0. NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 CENTER MESSENGER SKIN POSITION FIX (AWS-01 R01, 2026-08-19)**: FIXES the Websmith Messenger skin placement from the FINAL VISUAL FIX entry in `app/chat/[id]/ClientChat.tsx` (UI-ONLY, single-file diff — the skin was a 1px gradient-border WRAPPER (`cardSkin`) AROUND the card, so it read as outside/behind the chat box). The skin is now a **branded header band INSIDE the actual Messenger card**: the `cardSkin` wrapper was REMOVED and `styles.card` is again THE Messenger container (`width min(550px,100%)` / `height min(800px,92dvh)`, radius 22px, subtle `1px solid rgba(20,156,234,0.35)` border + Websmith-blue glow shadow, `overflow:hidden`) containing, top→bottom: the **Websmith skin header** (`styles.header` = diagonal blue gradient band + `inset 0 2px 0` top accent + blue bottom border) with a compact gradient **brand pill** (`styles.skinBrand`/`skinBrandDot`, `.ws-skin-brand` = "Websmith · Digital Support", `#149CEA→#1479EA` pill, white uppercase text, hidden `display:none` under 480px) → the existing title/subject block → the existing right controls (status dot / Client Login / Home / mask circle) → the **existing messages area** (`styles.body`) → the **existing composer** (`ws-skin-input` / `ws-skin-send`). The skin is a real part of the card header/interior — NOT a page background, NOT a wrapper, NOT z-indexed behind the card (no z-index trick used). Messages/composer/functionality/API/routing untouched; LEFT 33% stickers + RIGHT 33% bubbles untouched. Files: `app/chat/[id]/ClientChat.tsx` only. Verified: isolated React-19 tsc EXIT 0 (only the 2 pre-existing `<style jsx>` styled-jsx intrinsics remain). NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 CHAT PAGE FINAL VISUAL FIX: 30 zero-overlap bubbles + slow readable stickers + shared occupancy + Websmith Messenger skin (AWS-01 R01, 2026-08-19)**: SUPERSEDES the LEFT 33% CHAT-STICKER BACKGROUND + SOCIAL POPUPS entry in `app/chat/[id]/ClientChat.tsx` (UI-ONLY, single-file diff — chat API / JWT / status / send / poll / email / Query Inbox / onboarding / DB / login / home and ALL messenger logic untouched; three zones preserved). **(1) RIGHT 33% — EXACTLY 30 zero-overlap bubbles** (`FlyingBubbles`): 5 phase-locked columns × 6 rows = 30 (`BUBBLE_COLUMNS`/`BUBBLE_ROWS`/`BUBBLE_COUNT`, `LANG_ICONS_30` = first 30 real `public/wds_icon` assets, `BUBBLE_SLOTS` [10,30,50,70,90]% fixed per column; each column shares ONE duration 20–32s and rows are staggered by exactly `-row*duration/6` → constant vertical separation forever; slot gaps ~105px at 1600px exceed the bubble's max 64px width → columns never collide horizontally — zero overlap BY CONSTRUCTION). Bubble size is responsive `clamp(30px,4vw,64px)` via `--ws-bubble-size` (NEVER larger than the original 80px; icon = 82% of size), gentle ±4px sway via `--ws-sway` (keyframes use `var(--ws-sway)`), subtle opacity, `bottom` memoized (never recomputed on re-render so zoom state changes never move bubbles), the random 3× zoom is PRESERVED (now `BUBBLE_COUNT`-scoped, transient + zone-clipped). **(2) LEFT 33% — SLOW READABLE STICKERS** (`ChatStickers`): pacing slowed to `STICKER_MAX_ACTIVE = 2`, `MIN/MAX_LIFE_MS` 10s/16s, `MIN/MAX_GAP_MS` 2.5s/5s; `wsStickerLife` keyframes now SLOW zoom-in (0→12%) + long readable hold (16→86%) + slow zoom-out/fade (94→100%) with gentle `cubic-bezier(0.33,1,0.68,1)` (bouncy easing removed). **(3) LEFT — ZERO OVERLAP / ZERO BLANK POPUPS via SHARED OCCUPANCY** — one shared `Occupancy` map (`occupancyRef`, keys `sticker:<id>`/`popup:<id>`, `OCC_MARGIN` 12px, `occOverlaps()` helper) owned by a new `LeftZoneVisuals` wrapper and passed to BOTH `SocialIconPops` and `ChatStickers`: each social popup CLAIMS a rotation-safe rect (`POP_CLAIM` 108px centered on the 90px bubble) BEFORE showing and spawn retries up to 24 spots, returning null → the 250ms ticker WAITS and retries (never blank, never off-screen, never overlapping); each sticker is measured against the SAME map (popups + other stickers) with up to 24 retries and REMOVED if no safe spot exists (never blank/overlapping) — a placed sticker never moves and fully fades out before any fresh sticker appears (no teleport). **(4) LEFT LAYER ORDER FLIPPED** — stickers are now ON TOP: `.ws-road-zone` renders atmosphere (z-index 0) → `SocialIconPops` (`.ws-social-pops-layer` z-index 0) → `ChatStickers` (`.ws-stickers-layer` z-index 1); the old `.ws-left-scene` wrapper/atmosphere-inside-scene is gone. **(5) CENTER 34% — WEBSMITH MESSENGER SKIN (visual only)** — new `styles.cardSkin` 1px gradient-border wrapper (radius 23px outer / 22px inner, Websmith-blue `#149CEA→#1479EA` glow shadow) around the unchanged `styles.card` (width/height moved to the skin); header gains a blue top accent (`inset 0 2px 0 rgba(20,156,234,.85)`) + blue-tinted gradient background + blue bottom border; body gets a soft radial Websmith-blue glow; client/admin bubbles become blue-tinted Websmith gradients, `bubbleSender` `#149CEA`; composer gains a blue top hairline + subtle gradient; the textarea gets `className="ws-skin-input"` (Websmith-blue focus ring via `.ws-skin-input:focus` in the styled-jsx block) and Send gets `className="ws-skin-send"` (gradient `#149CEA→#1479EA`, glow hover/active/disabled states). `@media (max-width:900px)` + `prefers-reduced-motion` behavior unchanged. Files: `app/chat/[id]/ClientChat.tsx` only. Verified: esbuild TSX parse EXIT 0 + isolated React-19 type-check EXIT 0 (only the 2 pre-existing `<style jsx>` styled-jsx intrinsics remain, which resolve in the real project; repo `tsc`/`next build` still blocked by the missing `node_modules`). NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 CHAT PAGE SOCIAL ICON WATER-BUBBLE POPUPS (AWS-01 R01, 2026-08-19)**: SUPERSEDES the blank left zone of the CAR ANIMATION REMOVED entry in `app/chat/[id]/ClientChat.tsx` (UI-only, single-file diff — CENTER 34% Messenger + RIGHT 33% flying bubbles + card + typography + colors + backend/APIs/data/routing ALL untouched; the car/traffic animation stays REMOVED). **(1) ALL REAL ICONS** — popups render the **35 real `public/social_icon` SVGs** (`SOCIAL_ICONS`; the folder README lists WeChat but NO `wechat.svg` exists, so only the 35 real files participate — nothing invented, no external URLs, no icon edits). **(2) WATER-BUBBLE POP** — each popup grows 0 → 90px (`POP_FULL_SIZE`) over ~520ms (`POP_GROW_MS`, springy `wsSocialGrow` with 1.1 overshoot), lives 1000–2600ms (`POP_MIN/MAX_LIFE_MS`, `wsSocialFade` fade-in + hold + fade-out), then is removed. **Max/target `POP_MAX_ACTIVE` = 5** on screen at once, held continuously by a synchronous `activeRef` counter (incremented at spawn, decremented on the removal timer) + staggered initial burst (`i*140ms`) + a 250ms ticker — NEVER exceeds 5 (simulation PASS: max 5, 0 overshoots). **(3) LEFT ZONE ONLY** — popups mount inside the existing `roadZone` (`33%`, `overflow:hidden` — strictly left of the center, so a popup can never reach the Messenger/right bubbles); random px positions measured from the real zone (ResizeObserver) with a 6px `POP_SAFE` keep-out so the FULL 90px popup stays fully inside; hidden mobile zone measures 0 → no popups. **(4) VARIATION** — random icon + random mask shape (`POP_SHAPES` circle/squircle/hexagon/blob/oval via `.ws-pop-shape-*`) + random safe x/y + small rotation + random lifetime; subtle water-bubble glass (radial highlight, thin border). **(5) CSS via the documented plain `<style dangerouslySetInnerHTML>` tag** (`SOCIAL_POP_CSS` const — styled-jsx strips interpolations); `prefers-reduced-motion` hides `.ws-social-pop`. Files: `app/chat/[id]/ClientChat.tsx` only. Verified: pool simulation PASS; `tsc`/`build` NOT runnable locally (node_modules missing — pre-existing blocker). NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 LEFT RACING ROAD FIX: Websmith/F1 branding integrated into the left 4-lane racing road (AWS-01 R01, 2026-08-19)**: SUPERSEDES the left-zone visuals of the CHAT FINAL 3-ZONE entry in `app/chat/[id]/ClientChat.tsx` (UI-only, single-file diff — CENTER Messenger + RIGHT 60 bubbles untouched). The LEFT 33% zone keeps **ONE continuous road** (full left-zone width + full usable height, EXACTLY 4 lanes ↑ ↓ ↑ ↓, adjacent lanes opposite, 2 solid glowing edges + 3 glowing dashed dividers at 25/50/75%, no gaps) with **16 sport/racing cars evenly 4/4/4/4** (C, C++, Java, Go, PHP, JavaScript, Rust, Kotlin, Python, TypeScript, Node.js, Swift, React, MongoDB, C# + premium gold **WEBSMITH** car with the Websmith logo — dart swapped for csharp): styled side-profile racers (glowing language-color body, windshield, rear wing, 2 wheels, chevron ▲/▼, real `public/wds_icon` Devicon icon, label + trail), per-car duration 8–16s, negative delays (mid-road on load), lane slot, z-index pass-over + jitter, seamless `translateY(110%)↔(-110%)` loop with both extremes off-screen; lane + zone `overflow:hidden` guarantee cars never enter the center. **Websmith Digital branding is INTEGRATED INTO the asphalt** (all `pointer-events:none`, z-index 1–2, DOM-before-cars so every marking stays BEHIND the cars, never floating UI): (a) large **blurred `public/images/websmith_1x1.webp` watermark** (blur 6px, `mix-blend-mode:screen`, ~26% opacity) down the road centre; (b) vertical F1-style track print `WEBSMITH DIGITAL · GRAND PRIX` down the centreline + secondary `TECHNOLOGY · ENGINEERING · SUPPORT` print near the base; (c) **F1 checkered start/finish line** across the road top (`repeating-conic-gradient` 15px cells + neon glow); (d) **red/white F1 kerbs** along both road edges; (e) thin **branded footer strip** `WEBSMITH DIGITAL — OFFICIAL TRACK PARTNER` + webp logo painted onto the road base. **Dark premium racing asphalt**: deep blue-black base + faint horizontal wear streaks + lengthwise sheen + neon-blue ambient radial glow. Responsive: road width always equals the left 33% zone; 901–1150px shrinks cars/print/footer/checker; ≤900px road hidden (messenger full-width); `prefers-reduced-motion` stops all. Files: `app/chat/[id]/ClientChat.tsx` only. Verified: `npx tsc --noEmit` EXIT 0, `next build` EXIT 0. NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 FINAL CHAT UI: Centered compact card + Websmith Digital2.png circular logo + 60 language balloons (AWS-01 R01, 2026-08-18)**: the public Messenger Chat (`app/chat/[id]/ClientChat.tsx`) is a **centered compact chat card** (`min(440px,100%)` × `min(620px,92dvh)`, radius 22px, shadow, balanced 24px stage padding). Behind it (z-index 0, pointer-events none, never covers controls): **Websmith Digital2.png** in a **large circular mask** (96–150px, object-fit cover) floating on the LEFT, and **60 language circular bubbles** on the RIGHT that **continuously float bottom → top like balloons** (18–36s, negative delays = mid-flight on load, random horizontal 52–98%, gentle sway, reduced-motion stopped). Header buttons — **Client Login / Home / Open·Closed** — are the **SAME SIZE** (flex:1 × 32px) with **DIFFERENT colors** (blue / green / amber-red; status flips live via the client 3s poll). UI-only: JWT token, poll guard, send/reopen, sanitizer, contact_info, no-executive message, composer and the entire chat backend are untouched. Files: `app/chat/[id]/ClientChat.tsx`. Verified: `npx tsc --noEmit` EXIT 0, `npm run build` EXIT 0. NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 PHASE 6: Admin Ticket Card Redesign + Secure Public Client Messenger Chat (AWS-01 R01, 2026-08-18)**: (1) **Admin ticket card redesign (UI-only, `app/admin/messages/AdminMessagesClient.tsx`)** — ONE ticket = ONE self-contained card, identical structure for Active and Closed: header row inside the card (Query label + unread dot + ⋮ menu), body (customer name/email, date/time row, status chip `● Open`/`● Closed` from `status` ONLY + source + priority chips, subject/title, 2-line description clamp), footer (Client ID / last activity + quick Open/Close action button). The ⋮ menu keeps every existing action (Open/Close, **Copy Chat Link**, Delete, Resend); old split `cardHeader`/`cardActions`/`ticketRow`/`ticketMeta` styles removed; card styling rides the scoped `.query-ticket-row` CSS. (2) **Secure public Client Messenger Chat** — a separate standalone page (NO admin chrome, NO email, NO new accounts) reachable ONLY via a direct signed link: admin ⋮ → **Copy Chat Link** (`createTicketChatLink(id, origin?)` → ADMIN-ONLY `POST /api/tickets/[id]/chat-link`) produces `/chat/<ticketId>?token=<signed JWT>`. Token signed with the existing website `JWT_SECRET` (`lib/tickets/chat.ts` `signChatToken`/`verifyChatToken`, payload `{purpose:"client_chat", ticketId, email}`, 30-day expiry `CHAT_TOKEN_MAX_AGE_SECONDS`), verified server-side: `payload.ticketId === path id` AND `ticket.contactEmail` (lowercased) `=== payload.email`. `GET/POST /api/tickets/[id]/chat` (public but token-gated): reuses the existing ticket `messages[]` array (`senderType:"client"`, `direction:"inbound"`, `source:"chat"`), stamps `lastClientReplyAt` + `updatedAt`, reopens `closed → in_progress` (+ `chatStatus:"open"`), pushes `history {action:"client_reply", actorRole:"client"}`, in-memory rate limit 10 / 60s per `ticketId:email`; NO email sent — the admin Query Inbox 1s auto-poll surfaces chat messages within ~1s. Response sanitized (`sanitizeChatConversation`): only ticketId/subject/status/contactName/contactEmail/createdAt/messages[{id,senderType,senderName,message,createdAt,attachments[{name,url}]}] — never history/resolution/delivery internals/providerMessageId/sourceRef/clientId. UI: `app/chat/[id]/page.tsx` + `ClientChat.tsx` (Messenger-style: "Websmith Digital Support" header, client-left/admin-right bubbles, attachment links via public `GET /api/uploads/<id>`, 3s silent poll, Enter-to-send, mobile responsive). `/chat` added to `PUBLIC_ROUTE_PREFIXES`; `ClientLayout` `isStandaloneChatRoute` suppresses nav/footer/consent-banner/analytics on chat. No Get in Touch / onboarding / client-account / resolution / reply-thread / email / mailbox changes. Files: `lib/tickets/chat.ts`, `app/api/tickets/[id]/chat-link/route.ts`, `app/api/tickets/[id]/chat/route.ts`, `app/chat/[id]/page.tsx`, `app/chat/[id]/ClientChat.tsx`, `app/admin/messages/AdminMessagesClient.tsx`, `core/constants/routes.ts`, `app/ClientLayout.tsx`, `core/services/ticketService.ts`. Verified: `npx tsc --noEmit` EXIT 0, `npx next build` EXIT 0 (296 pages), token security 18/18 via temp verify script. NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 PHASE 3: Client Onboarding auto-create + admin-gated password reveal + blank Resolved Preview + First Welcome template + interactive source/priority chips (AWS-01 R01, 2026-08-18)**: (1) **Client Onboarding immediate auto-create** — a successful **Get in Touch** submission (`POST /api/tickets/public`) now creates/reuses the client account (`users` role `client`) via `createClientAccount` (existing `CL-####` sequential Client ID rules) and stamps the ticket `clientId`/`clientCustomId`/`clientAccountSource` (`created`/`existing`)/`clientAccountEmail` at insert time — the **Client Onboarding card in the Query Inbox shows the account immediately** (the UI now loads it via `getTicketClientAccount` when a conversation is opened). NO email is sent and NO temporary password is ever returned to the public caller. (2) **Temporary password is encrypted at rest + revealed only after admin-password verify** — `lib/tickets/email.ts` adds AES-256-GCM helpers (`encryptTemporaryPassword`/`decryptTemporaryPassword`/`resolveStoredTemporaryPassword`, key derived from the existing `JWT_SECRET`, format `enc:iv:tag:data`) and `createClientAccount` stores `temporaryPasswordEnc` on the user doc (bcrypt hash stays authoritative; plaintext never stored/logged). New admin-only `POST /api/tickets/[id]/reveal-password` (`{adminPassword}`) verifies the CURRENT admin password via `bcrypt.compare` (in-memory 5-attempt/10-min per-admin guard, 429) then decrypts — never logged, never in URLs/history/unnecessary responses. `send-client-portal-access` resolves an existing still-temporary account's password from `temporaryPasswordEnc` (never regenerates an existing client's password) and `client-account` GET adds `hasTemporaryPassword`. UI: the onboarding card shows **Reveal Temporary Password** (only when `hasTemporaryPassword`) → inline admin-password prompt → temporary 30s auto-hide reveal + Copy/Hide; never automatic. (3) **Resolved Preview starts BLANK** — no template is pre-selected on mount (the old `setGreetingKey(defaultKey)` is gone) and opening a conversation resets `reply`/`greetingKey`/`resolution`/`resolutionTemplateKey`/chat/reveal state (`handleSelectTicket`; the poll-driven `refreshOpenTicket` never resets); the Reply Thread `<select>` now has a "Select a template..." blank option and selecting a template auto-fills the Reply Thread textarea. (4) **First Welcome Message — professional rewrite + clickable Portal/Chat links (2026-08-19, see the master doc "R01 — First Welcome Message professional rewrite" progress entry)** — the `first-welcome` DB seed template body is now the professional structure: **"Welcome to Websmith Digital"** heading + `Hello {{client_name}},` + "request has reached the right team, and we are pleased to connect with you" + **Client Portal:** `[Client Portal]({{portal_url}})` (`https://www.websmithdigital.com/login`) + **Login Email:** `{{client_email}}` + **Continue Chat:** `[Continue Chat]({{chat_url}})` direct secure Messenger Chat link (wrapped in the existing `{{#if chat_url}}` block so it is dropped when no chat link resolves) + the closing "You can keep the conversation going anytime through your Client Portal or Secure Chat." line + `${SIGN_OFF}`; subject unchanged (`We've received your request - {{request_id}}`). The shared HTML renderer (`renderCustomerMessageHtml` + `renderInlineEmailText` in `lib/tickets/email.ts`) now turns `[label](url)` tokens into clickable `<a>` links (http/https only, HTML-escaped) and auto-linkifies bare URLs — the secure chat JWT lives ONLY in the `href`, never as visible text; `renderCustomerMessagePlain` unwraps tokens to `label: url`, and the First Welcome send (`app/api/tickets/public/route.ts`) passes the unwrapped plain text. `ensureResolutionTemplates` now bulkWrite-upserts missing seed keys (`$setOnInsert`) so new templates reach existing DBs without overwriting admin edits; `{{chat_url}}` is resolved client-side via `createTicketChatLink` (per-ticket cache; fallback = the prescribed customer-facing sentence, NEVER the portal `/login` URL — Continue Chat must open the Messenger Chat directly without login) and server-side via new `buildChatUrl()` in `lib/tickets/chat.ts` (added to `send-resolution-email` + `send-client-portal-access` data). (5) **Get in Touch / priority chips now open info popovers** — the source chip ("Get in Touch") and priority chip ("Medium") on the ticket card are interactive (`role="button"`, stopPropagation) and open a fixed popover with the ticket's EXISTING source info (channel/email/company/submitted/subject) or priority info (label + handling description) — no new backend, no duplicate data, card design preserved. Files: `lib/tickets/email.ts`, `lib/tickets/chat.ts`, `app/api/tickets/public/route.ts`, NEW `app/api/tickets/[id]/reveal-password/route.ts`, `app/api/tickets/[id]/send-client-portal-access/route.ts`, `app/api/tickets/[id]/client-account/route.ts`, `app/api/tickets/[id]/send-resolution-email/route.ts`, `core/services/ticketService.ts`, `app/admin/messages/AdminMessagesClient.tsx`. No Messenger Chat / email architecture / mailbox / no-reply / sales / support / sent / delete / restore / permanent-delete / SDK / license-system / schema changes. Verified: `npx tsc --noEmit` EXIT 0, `npm run build` EXIT 0. NOT deployed; awaits user approval.
- **Admin Messages Query Inbox — R01 FIX: `${COMPANY}` placeholder in the Welcome Email (AWS-01 R01, 2026-08-20, see master doc "R01 — FIX `${COMPANY}` PLACEHOLDER IN WELCOME EMAIL" progress entry)**: production welcome emails showed `Welcome to ${COMPANY} - <ticket_id>`. ROOT CAUSE: commit `47c46ae` seeded `first-welcome.subject` as a DOUBLE-QUOTED string `"Welcome to ${COMPANY} - {{request_id}}"` — `${COMPANY}` is JS template-literal syntax, never a renderer token (the renderer only knows `{{...}}`), so the LITERAL placeholder was stored in MongoDB `resolution_templates` and `$setOnInsert` never overwrote the broken production row. FIX (all in `lib/tickets/email.ts`): (1) `first-welcome` seed subject is now **`Welcome to Websmith Digital - {{request_id}}`**; (2) the two other double-quoted seed subjects (`new-project-discussion`, `website-web-application`) use the same template-literal `${COMPANY}` pattern the bodies already use (resolved to "Websmith Digital" at seed time, never stored literally); (3) `ensureResolutionTemplates` now runs a repair `updateMany` that replaces any literal `${COMPANY}` with `Websmith Digital` in stored `subject`/`body` rows (production heals on the next request; only rows containing the placeholder are touched); (4) `renderResolutionTemplate` resolves any residual literal `${COMPANY}` at render time — no template can ever send the literal. Ticket ID / chat URL / login URL / customer data / email layout and all other email flows unchanged; no new files, no duplicate templates. Verification: no literal `${COMPANY}` remains in any seed/template string.
- **Admin Messages Query Inbox — R01 WELCOME MESSAGE REWRITE: new structure + secure chat links (AWS-01 R01, 2026-08-20, see master doc "R01 — WELCOME MESSAGE REWRITE: new structure + secure chat links" progress entry)**: the welcome/support message (Get in Touch → `first-welcome` template) now follows the REQUIRED structure — **"Websmith Digital Support"** heading → `Hello {{client_name}},` → "Thank you for contacting Websmith Digital. Your request has reached the right team." → existing-customer Client Portal instruction → business-interest instruction ("You may be asked for your Client ID when continuing with our team") → `Client Portal:` + `[Client Portal]({{portal_url}})` → direct encrypted chat intro → `{{#if chat_url}}Direct Secure Chat: [Continue in Secure Chat]({{chat_url}}) {{/if}}` (label + link INSIDE the guard — unresolvable chat link removes the whole section, no dangling label) → "You can continue the conversation anytime through your Client Portal or Direct Secure Chat." → `${SIGN_OFF}`. **The full signed Secure Chat URL (`...?token=<jwt>`) is NEVER visible text anywhere**: `ensureResolutionTemplates` runs a one-time migration that re-seeds subject+body for any stored `first-welcome` row lacking the canonical **"Direct Secure Chat"** marker ($setOnInsert never touches existing rows); `renderCustomerMessagePlain` unwraps `[label](url)` to label-only when the URL contains `token=` (portal URL, token-free, stays `label: url`); and BOTH chat UIs render stored message text through the NEW client-safe pure module `core/services/messageRender.ts` (`renderMessageHtml`: escape-then-linkify `[label](url)` + bare URLs into `<a target="_blank" rel="noopener noreferrer">` — URL only in href, HTML-escaped otherwise, no injection) via `dangerouslySetInnerHTML` with scoped link CSS (`.qib-chat-scroll .qib-msg-text a` in AdminMessagesClient, `.ws-msg-text a` in ClientChat). Storage/history unchanged — legacy stored bodies render label-only, historical duplicates are pre-existing data (single generation path `sendWelcomeEmail`, once per ticket; nothing deleted). Verified: `scripts/verify-message-render.mts` 15/15 + `scripts/verify-welcome-template.mts` 16/16 + `npx tsc --noEmit` EXIT 0 + `npm run build` EXIT 0. Not deployed; awaits user approval.
- Keep this rule in sync with the master doc Progress Tracking entry.

- **Admin Messages Query Inbox — R01 FINAL FIX: Messenger Chat live real-time updates + clean message display (AWS-01 R01, 2026-08-20)**: the Query Inbox Messenger Chat now renders inbound Email and Secure Chat messages within the existing 1-second silent poll with the required hierarchy and without jumping or duplicating. ROOT CAUSE (UI-only): (1) `refreshOpenTicket()` re-fetched the whole 15-ticket `getTicketsPaged` page every second instead of the single open ticket, causing full-list churn and re-render of every card; (2) `ThreadMessage.source` union lacked `"chat"` and `"welcome_email"` so chat-vs-email could not be distinguished at the type level; (3) client name was not rendered above the message and the timestamp/source were not collapsed into the single bottom line. FIX (files: `app/admin/messages/AdminMessagesClient.tsx`, `core/services/ticketService.ts`, `app/api/tickets/route.ts`): (1) added an optional comma-separated `ids` filter to `GET /api/tickets` applied AFTER the role scope / `deletedAt` / status scope (cannot widen access); (2) added exported `getTicketQuiet(id)` (uses the existing `quietFetch` transport so a session expiry can never page-replace the admin) and extended `ThreadMessage.source` to `"email" | "chat" | "welcome_email" | "public_contact" | "portal" | "resolution_email" | "system"`; (3) `refreshOpenTicket` now fetches ONLY the open ticket (`getTicketQuiet(selectedTicket.id)`, diff-based, `useCallback` dep `[selectedTicket]`, no poll-timer changes) and clears the card menu; (4) `ThreadMessage` is rewritten to render **Client First Name** (ticket-generated name `contactName` || `clientId.name`, first token, title-stripped) as the TOP line and `{formatTimeOnly(createdAt)} · {clientSourceLabel(source)}` (`From Email` for `email`/`public_contact`/others, `From Chat` for `chat`) as the BOTTOM line; admin bubble uses `direction==="outbound"` with the existing `formatDate` + green/red delivery indicators unchanged; (5) scroll preservation: `chatScrollRef` + `nearBottomRef` → jump-to-bottom on conversation switch, and on message append pin-to-bottom ONLY when the user was already near the bottom (no forced jump); `onScroll` also closes the ⋮ card menu. No new polling mechanism; the single `POLL_INTERVAL_MS=1000` `syncInboundEmail()` → diff `refreshOpenTicket()` loop is unchanged. Outgoing Chat→client email, the universal receive system, Brevo send, chat-token gen, onboarding, client IDs, resolution templates, and all DB/auth/notification/storefront logic untouched. Verified: `npx tsc --noEmit` EXIT 0; local `npm run build` aborts only at the pre-existing `native-receive` QStash signing-key env step (identical on the untouched baseline). Deployed 2026-08-20 via Vercel production (296 pages, TypeScript green; 5 pre-existing Turbopack dynamic-filesystem warnings in `sdk-validator.ts`/`app/api/v1/communication/[id]/attach/route.ts`, unrelated to this change). Live acceptance test recommended: open a Query Inbox conversation, send a Secure Chat message + a test email reply, and confirm each appears ~1s later with the correct hierarchy (client first name top; `Time · From Chat`/`Time · From Email` bottom) without reload/jump/duplicate.

- Keep this rule in sync with the master doc Progress Tracking entry.

- **Admin Messages Query Inbox — R01 FAST LOAD + REAL-TIME FIX: lean card list + incremental messages endpoint + single 1s poll (AWS-01 R01, 2026-08-20, see master doc "Admin Messages Query Inbox — R01 FAST LOAD + REAL-TIME FIX" progress entry)**: fixes the two `/admin/messages` complaints — slow initial load and real-time Email/Secure Chat messages not appearing (silently, within ~1s). ROOT CAUSES: (1) `GET /tickets?scope=&page=&pageSize=` returned the FULL ticket documents (full `messages[]`, full `history[]` bodies, attachments, resolution) for all 15 page rows though the Query Inbox card renders only ~8 fields — the heavy thread payload was downloaded on every list load; (2) the auto-poll restarted whenever `selectedTicket` changed (`refreshOpenTicket` re-created the interval via its `[selectedTicket]` dep) and re-downloaded the WHOLE open conversation every second, so real-time Email/chat updates were flaky. FIX (files: `app/api/tickets/route.ts`, NEW `app/api/tickets/[id]/messages/route.ts`, `core/services/ticketService.ts`, `app/admin/messages/AdminMessagesClient.tsx`): (1) **Lean card list** — `GET /api/tickets?fields=card` projects only the card fields (`CARD_PROJECTION`: id/source/client*/contact*/subject/priority/status/chatStatus/lastClientReplyAt/adminReadAt/createdAt/updatedAt + the three `history.recipient/emailSubject/emailBody` subfields) and adds a server-computed `hasStoredEmail` Resend flag, stripping the `history` array from the payload — the initial load transfers only the light card data. Non-card consumers (`ids` single-ticket refresh, client list) are untouched (backward compatible). (2) **Incremental messages endpoint** — NEW admin-only `GET /api/tickets/[id]/messages?after=<ISO timestamp>` returns ONLY the messages newer than the caller's cursor (ascending) plus lightweight metadata (`updatedAt` / `lastClientReplyAt` / `hasNewClientReply` via the exported `hasNewClientReply` / `status`); `parseObjectId` + existing `apiHandler`/`json`/`badRequest`/`forbidden`/`notFound` contracts; no schema/email/IMAP/chat-infrastructure change. (3) **Single stable 1s poll** — the interval is created ONCE on mount (deps `[applyIncremental, markReadSelected, refreshCardsSilently]`, all `useCallback([])`-stable) and reads the current selection through `selectedRef` (id+status mirrored by a tiny effect, cursor advanced only on real conversation switch) — it NEVER restarts on state updates and never duplicates. Each tick: `Promise.all` the existing silent email bridge (`syncInboundEmail`) + `getTicketMessages(id, cursor)`; appends ONLY deltas via `applyIncremental` (idempotent by message `id` — new id appended once, existing id never re-appended, changed message updated in place) and clears the unread dot via `markReadSelected` when `hasNewClientReply`; a catch-up messages fetch runs after the bridge so a just-bridged email is picked up in the same cycle; when the bridge reports `matched > 0` the lean card list is refreshed silently (`refreshCardsSilently` reads `listStateRef` for scope/page/search, re-fetches `fields=card`, merges card metadata onto the open conversation WITHOUT dropping its thread). (4) **Full thread fetched once on open** — `handleSelectTicket` is async: it sets the lean card instantly, sets `cursorRef` to `now` (so the poll only picks up genuinely NEW messages), then fetches the full conversation via the EXISTING single-ticket `getTicketQuiet` (`GET /tickets?ids=`, quietFetch, full doc — unchanged) and sets `cursorRef` to the max thread time; `threadLoading` shows a one-time "Loading messages..." placeholder in the chat card only on select (never during the silent poll); re-clicking the SAME open card keeps the in-progress draft and does not re-fetch; `loadTickets` passes `fields: "card"` and merges only `CARD_FIELDS` onto the open conversation (full thread/history never lost); the old auto-mark-read-on-open effect is preserved. Verified: `npx tsc --noEmit` EXIT 0; `next build` compiles + TypeScript green and aborts only at the pre-existing `native-receive` QStash signing-key env step (identical on the untouched baseline). Not deployed; awaits user approval.

- Keep this rule in sync with the master doc Progress Tracking entry.

- **Admin Messages Query Inbox — R01 SEVEN-POINT LIVE FIX: WSD Request ID + email-header cleanup + on-demand native receive + live Get-in-Touch + compact chat (AWS-01 R01, 2026-08-21, see master doc "Admin Messages Query Inbox — R01 SEVEN-POINT LIVE FIX" progress entry)**: (1) **Customer-facing WSD Request ID** — every new ticket (Get in Touch + Client Portal) stores a `requestId` (`WSD-XXXXXX`, unambiguous alphabet, collision-checked via `generateRequestId()`/`generateUniqueRequestId(db)` in `lib/tickets/email.ts`) and ALL FIVE customer-facing email paths render it as `{{request_id}}` via `ticketRequestLabel(ticket)` (welcome / reply / resolution / onboarding / resend; pre-WSD tickets fall back to the legacy ObjectId — no migration); shown as chips on the card header, beside the conversation subject and in Client Details, and server-side searchable (`requestId` in `CARD_PROJECTION` + `SEARCH_FIELDS`). (2) **Email header/quote cleanup hardened** — `cleanInboundBody` cuts reply-header RUNS (≥2 consecutive From:/Sent:/To:/Subject:/Date: lines) ANYWHERE (not only after a blank line) and the Gmail `On … wrote:` intro also when directly followed by a quoted block; display-mirror `cleanClientBody` hardened identically. (3) Chat bubble format unchanged. (4) Silent 1s poll preserved (single interval, refs, incremental messages). (5) **Email→chat delay root cause fixed** — the universal native receive core was extracted verbatim into NEW `lib/communications/native-receive-core.ts` (`runNativeReceiveCycle()`); the QStash route is a thin signed wrapper around it, and `POST /api/tickets/inbound` schedules ONE throttled kick of that SAME cycle (`NATIVE_KICK_MIN_MS` 10s guard, executed via `after()` from `next/server`, response never blocked) while an admin polls — support@ mail reaches PostgreSQL in seconds instead of waiting up to 60s for the next cron fire, and the NEXT 1-second tick bridges it. STILL exactly ONE receiver / ONE pipeline (the bridge never touches IMAP or parses mail itself); the QStash cron remains the baseline receiver; Message-ID dedupe makes overlap harmless. (6) **Get in Touch drops live** — with no conversation open/closed selected, the same interval silently refreshes the lean card list every `LIST_REFRESH_TICKS = 5` ticks (~5s) via the existing `refreshCardsSilently()`. (7) **Compact Messenger Chat** — chat card height → `clamp(220px, 34dvh, 420px)` + tighter label row/scroll/bubble paddings; text stays 12px readable. Files: `lib/tickets/email.ts`, `app/api/tickets/public/route.ts`, `app/api/tickets/route.ts`, `[id]/replies` + `[id]/send-resolution-email` + `[id]/send-client-portal-access` + `[id]/resend`, `lib/tickets/inbound-core.ts`, NEW `lib/communications/native-receive-core.ts`, `app/internal/backend/communications/native-receive/route.ts`, `app/api/tickets/inbound/route.ts`, `core/services/ticketService.ts`, `app/admin/messages/AdminMessagesClient.tsx`. No mailbox/SMTP/IMAP-implementation/schema/auth/notification/storefront changes. Verified: `npx tsc --noEmit` EXIT 0; `next build` EXIT 0 (placeholder QStash keys; without them it aborts at the documented pre-existing env step identical to baseline); cleaner unit assertions 9/9; `npm test` 6/6 + 13/13. NOT deployed; awaits user approval.

- Keep this rule in sync with the master doc Progress Tracking entry.

## Universal Email Unsubscribe System

Keep in sync with the master doc Progress Tracking ("Universal Email Unsubscribe
System"):

- **Single centralized store**: all unsubscribe preferences live in ONE PostgreSQL
  table `email_preferences` (`lib/backend-db/index.ts`), with columns `email`,
  `email_hash` (sha256 of lowercased email, unique), `token` (64-char hex, unique),
  `is_unsubscribed`, `unsubscribed_at`, `created_at`, `updated_at`. No MongoDB
  collection, no separate store for public vs internal — PostgreSQL is the single
  source of truth (both `app/api/*` public routes and `app/internal/backend/*`
  routes share it via `getDb()`).
- **Essential emails never unsubscribe**: `lib/email/unsubscribe.ts` exports
  `ESSENTIAL_EMAIL_TYPES` (otp_verification, password_reset, license_*,
  trial_*, device_replacement, subscription_renewal_reminder, payment_*,
  welcome_customer) — these ALWAYS send, no footer, no check.
  `INTERNAL_EMAIL_TYPES` (admin_notification, new_sales_enquiry,
  conversation_created) are staff-only — no footer, no check.
  `shouldIncludeUnsubscribe()` returns true only for customer-facing
  non-essential types: `support_reply`, `sales_reply`.
- **Send guard + footer** (`lib/email/brevo.ts` `sendEmail`): before sending a
  non-essential customer email, `await isUnsubscribed(recipientEmail)` is
  checked; if true, the email is SKIPPED and logged with
  `status:'skipped'` + `error:'Recipient has unsubscribed'` (no Brevo call).
  If not unsubscribed, a single-use `token` is UPSERTed via `getUnsubscribeLink`
  and an Unsubscribe footer (`UNSUBSCRIBE_FOOTER_HTML` / `UNSUBSCRIBE_FOOTER_TEXT`)
  is appended before `</body>` / after the body text, linking to
  `/unsubscribe_global?token=<token>`. No existing email body content is
  altered beyond this append.
- **Public unsubscribe endpoint** (`app/api/unsubscribe`, POST + GET): verifies
  the token, sets `is_unsubscribed = TRUE` + `unsubscribed_at`, returns
  `{ success, email }`. Returns 400 for invalid/missing token, 200 for
  already-unsubscribed. No auth required (`/api/*` bypasses the proxy).
- **Public page** (`app/unsubscribe_global/page.tsx`): `use client`, reads
  `token` from URL, shows a confirmation card with "Unsubscribe me" + "Cancel"
  buttons, calls the API on confirm, shows success/error states. Uses the
  existing `PublicPage` + `SimplePublicBody` layout. Added to
  `core/constants/routes.ts` (`PUBLIC_PATHS` + `PUBLIC_EXACT_ROUTES`) +
  `proxy.ts` `PUBLIC_PATHS` so the proxy never gates it.
- **Graceful degradation**: if `getDb()` fails (DATABASE_URL not set, DB down),
  `isUnsubscribed` returns `false` (fail-open - emails continue to send) and
  `getUnsubscribeLink` returns the base URL without a token (page shows error).

## R01 — Redis Rate Limiting + Cookie Consent/Analytics + Store UI (2026-08-17)

See master doc Progress Tracking rows **"R01 — Redis-backed Rate Limiting"**,
**"R01 — Cookie Consent Banner + Consent-gated Analytics"** and
**"R01 — Software Store UI fixes"**. Never regress:

- **Redis-backed rate limiting is the pattern**: all public/auth throttling uses
  Upstash Redis counters via the shared `lib/redis-client.ts` (env
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, `Redis.fromEnv()`,
  **fail-open** on any Redis error — an unavailable Redis never locks out
  customers). Keys: `otp_send:<ip>` (5 / 10 min) + `otp_send_email:<email>`
  (5 / 10 min) + `otp_verify:<email>` (15 / 15 min) in `lib/otp/login-otp.ts`
  (covers website login + internal API login + resends);
  `pwd_reset:<ip>` (3 / hour, 429) in `app/api/auth/forgot-password/request/route.ts`;
  `portal_support:<ip>` (5 / 15 min, 429) in `app/api/portal/support-message/route.ts`
  (IP = `x-forwarded-for` first value → `x-real-ip` → unknown). Never revert to
  per-instance in-memory Maps for production throttling; keep catch-block
  fail-open semantics.
- **Cookie consent + analytics are consent-gated and UI-only**: the public
  website shows ONE bottom banner (`components/ui/CookieConsentBanner.tsx`,
  localStorage `cookie_consent_accepted`, Privacy Policy link, Accept/Reject)
  mounted via `app/ClientLayout.tsx` (dynamic, ssr:false, only on public
  non-auth non-store routes). `hooks/useAnalytics.ts` tracks `page_view` on
  route change ONLY after consent and never loads provider scripts without
  consent (external provider wires into `window.analytics`); the
  `AnalyticsTracker` component mounts it. No analytics on `/internal/*`,
  auth pages, or store/checkout pages.
- **Store navbar**: the `/software-store` sticky header's center search is
  `hidden sm:block` (mobile uses the hero search — same `query` state, synced);
  the sticky filter bar sits at `top-[61px]` (flush under the nav). Never
  reintroduce a permanently-visible navbar search that squeezes the icon
  cluster on phones, and never change the shared query state between the two
  search inputs.



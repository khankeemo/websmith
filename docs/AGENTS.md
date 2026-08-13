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
  Customer / Notifications / Universal Email), plus a pinned bottom with
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
- Keep this rule in sync with the master doc progress table (OPERATIONAL QA row).

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

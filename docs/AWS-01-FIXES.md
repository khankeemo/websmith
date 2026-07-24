# Universal License Platform – Immediate Fixes (AWS-01)

## Mandatory Rules

Before making any changes:

* Follow AWS-01.
* Read the Master Implementation Document before coding.
* Verify the root cause before changing anything.
* Do not guess or add temporary workarounds.
* Do not modify generated SDK code.
* Apply fixes only inside the Internal API architecture and approved runtime templates where required.
* Do not modify the Public Website.
* Keep the platform universal. Do not hardcode or reference any specific product.

---

# Issue 1 – Activation Dialog (Customer Information)
## Status: ✅ COMPLETED

## Root Cause
The `_activateLicense()` method in `universal_license_center.ts` auto-populated customer details from cache instead of requiring manual entry. The API route `/api/v1/license` (activate action) was missing validation for inactive, deleted, and already fully activated licenses.

## Changes Made
- **`template/typescript/universal_license_center.ts`**: Rewrote `_activateLicense()` to require manual entry of name, email, mobile, and license key. Added license validation before activation. Added confirmation dialog with masked license key, plan, expiry, remaining validity, device info, and restart prompt.
- **`app/api/v1/license/route.ts`**: Added validation for inactive, deleted, revoked, expired, and fully activated licenses before allowing activation. Added `is_deleted` and `device_count` fields to the activation query.

## Problem
The activation dialog currently auto-fetches customer information for new users.

This should never happen.

## Required Change
For first-time activation:

* Customer enters all required information manually.
* Do not auto-populate customer details.
* Do not assume customer identity.
* Validate all required fields before activation.
* Validate the license before allowing activation.
* Reject:

  * inactive licenses
  * revoked licenses
  * expired licenses
  * deleted licenses
  * already fully activated licenses (according to platform rules)

Only after successful validation should activation continue.

---

# Issue 2 – Hardware Replacement
## Status: ✅ COMPLETED

## Root Cause
The public API route `/api/v1/device` had a `replace` action available to customers. The SDK `client.ts` had a `replaceDevice()` method. The ULC had a `_replaceDevice()` method that allowed customers to initiate replacement.

## Changes Made
- **`app/api/v1/device/route.ts`**: Removed the `replace` action from the public API. Updated action list from `['bind', 'reset', 'replace']` to `['bind', 'reset']`.
- **`template/typescript/client.ts`**: Removed `replaceDevice()` method. Added `getSupportConversation()` and `replyToSupportRequest()` methods.
- **`template/typescript/license_engine.ts`**: Removed `replaceHardware()` method. Added `getSupportConversation()` and `replyToSupportRequest()` methods.
- **`template/typescript/universal_license_center.ts`**: Replaced `_replaceDevice()` with `_viewHardwareStatus()` - displays current hardware status and notifies user that replacement requires administrator approval.

## Current Behaviour

Hardware replacement appears to be available from the customer side.

## Required Behaviour

Customer application must NOT replace hardware.

Hardware replacement must be an administrator-only operation.

Customer application may only:

* display current hardware status
* notify user that replacement requires administrator approval
* provide a request workflow if supported

Actual hardware replacement must only occur through the Internal API administrative workflow.

---

# Issue 3 – Support Email Delivery
## Status: ✅ COMPLETED

## Root Cause
The support route `/api/v1/support` swallowed email delivery errors with `.catch(() => {})`, making it impossible to diagnose failures. The OTP send route used `process.env.SENDER_EMAIL` instead of the documented `BREVO_SENDER_EMAIL`.

## Changes Made
- **`app/api/v1/support/route.ts`**: Removed silent `.catch(() => {})`. Added proper error logging with console.error. Added audit log entry for email failures. Added audit log entry for support request creation.
- **`app/api/v1/auth/otp/send/route.ts`**: Changed sender email from `process.env.SENDER_EMAIL` to `process.env.BREVO_SENDER_EMAIL || process.env.SENDER_EMAIL` with fallback. Added detailed error logging for Brevo API responses.

## Current Behaviour

Support request reports success, but email is not received.

## Required Investigation

Do not guess.

Verify the complete pipeline:

SDK
↓

Internal API
↓

Database
↓

Audit Log
↓

Email Queue
↓

Brevo API
↓

Mailbox

Verify:

* request saved
* audit log created
* email queued
* Brevo API response
* delivery status
* SMTP/API errors
* retry handling
* failure logging

The support request must not be lost even if email delivery fails.

---

# Issue 4 – OTP Verification
## Status: ✅ COMPLETED

## Root Cause
Email normalization mismatch: The OTP send route stored the raw email (e.g., "User@Example.com") while the verify route queried the same email without normalization. If the client sent different casing ("user@example.com" vs "User@Example.com"), verification would fail. Additionally, the verify route lacked audit logging for failure cases.

## Changes Made
- **`app/api/v1/auth/otp/send/route.ts`**: Added email normalization (`.trim().toLowerCase()`) before storage.
- **`app/api/v1/auth/otp/verify/route.ts`**: Added email normalization (`.trim().toLowerCase()`) before lookup. Added audit log entries for: verified, already used, invalid, expired cases.

## Current Behaviour

OTP generation works.

OTP verification fails.

## Required Investigation

Find the exact root cause.

Verify:

* OTP creation
* hashing
* expiry
* lookup
* verification logic
* request payload
* API validation
* database update
* audit logging

Do not rewrite the OTP flow.

Fix only the proven root cause.

---

# Issue 5 – Activation Success Experience
## Status: ✅ COMPLETED

## Changes Made
- **`template/typescript/universal_license_center.ts`**: Updated `_activateLicense()` to display a confirmation dialog after successful activation containing: Activation Successful header, Customer Name, License Key (masked with `****`), Plan, Status, Activation Date, Expiry Date, Remaining Validity, and Device Information. Added restart prompt with "Restart Now" option (calls `process.exit(0)`) and "Restart Later" fallback.

After successful activation:

Do not immediately exit.

Display a confirmation dialog containing:

* Activation Successful
* Customer Name
* License Key (masked where appropriate)
* Plan
* License Status
* Activation Date
* Expiry Date
* Remaining Validity
* Device Information (if applicable)

After the user reviews the information:

Display:

"Activation completed successfully.

The application must now restart to apply your license."

Provide:

* Restart Now
* Restart Later (only if permitted by platform policy)

If restart is mandatory, only Restart Now should be available.

---

# Issue 6 – Universal License UI
## Status: ✅ COMPLETED

## Changes Made
- **`template/typescript/universal_license_center.ts`**: Improved menu layout with consistent box-drawn borders. Added "View Hardware Status" and "View Support Conversations" options. Improved formatting with consistent spacing and alignment across all dialogs.

## Note
UI improvements are applied to the TypeScript template ULC. Runtime generators (typescript.ts, python.ts) will need similar updates during SDK generation.

Review every customer-facing license dialog.

Improve:

* layout
* spacing
* typography
* alignment
* compactness
* responsiveness
* readability
* consistency

Maintain one universal design language across:

* Welcome
* Trial
* Activation
* Renewal
* Reactivation
* Support
* License Details
* Status
* Notifications

Do not remove existing functionality.

Improve presentation only.

---

# Issue 7 – Support Request & Reply Workflow
## Status: ✅ COMPLETED

## Changes Made
- **`lib/backend-db/index.ts`**: Added `conversation_messages` table with foreign key to `requests(request_id)`, sender_type (customer/admin), sender_name, sender_email, message, is_internal, email_sent, email_error, created_at.
- **`lib/email/brevo.ts`**: Added `support_reply` email template with subject "Re: Your Support Request - {{request_id}}".
- **`app/api/v1/admin/requests/route.ts`**: Updated PUT endpoint to store admin replies in `conversation_messages` table and use `support_reply` email template instead of `admin_notification`.
- **`app/api/v1/support/[requestId]/messages/route.ts`**: NEW - GET endpoint for retrieving conversation history with messages ordered by created_at ASC. Requires API key auth + hardware_id query param.
- **`app/api/v1/support/[requestId]/reply/route.ts`**: NEW - POST endpoint for customer replies. Stores message in conversation_messages, updates request timestamp, sends admin notification email.
- **`template/typescript/client.ts`**: Added `getSupportConversation(requestId)` and `replyToSupportRequest(requestId, message, name, email)` methods.
- **`template/typescript/license_engine.ts`**: Added `getSupportConversation(requestId)` and `replyToSupportRequest(requestId, message, name, email)` methods.
- **`template/typescript/universal_license_center.ts`**: Added `_viewSupportConversations()` method with request list selection, `_viewConversation()` method with threaded message display, and `_replyToConversation()` method. Added menu option "View Support Conversations" (option 10).

Current workflow is incomplete.

Implement a complete Internal API support system.

Requirements:

Customer:

* submit support request
* attach required information
* receive request ID
* receive acknowledgement

Internal API:

* store request
* store conversation
* maintain request status
* maintain timestamps
* maintain audit logs

Administrator:

* open request
* reply
* send email response
* continue conversation
* close request
* reopen request

Customer:

* receive administrator replies
* continue conversation

Support communication must function as a threaded conversation rather than one-way email.

This functionality applies to the Internal API only.

Do not implement it in the Public Website.

---

# Documentation

Update all affected Markdown documentation to reflect these architectural changes.

Update only documentation related to:

* activation
* hardware replacement
* support workflow
* OTP workflow
* license validation
* customer lifecycle
* administrator workflow
* Internal API architecture

Do not change unrelated documentation.

---

# Verification Required Before Completion

Do not mark this work complete until all of the following are verified:

* Activation validation
* New customer activation flow
* Hardware replacement permissions
* OTP generation
* OTP verification
* Support request creation
* Email delivery
* Administrator reply
* Conversation history
* Audit logs
* Database records
* License validation
* Restart workflow
* UI consistency

Provide a completion report with:

* Root causes found
* Files modified
* Documentation updated
* Tests performed
* Remaining issues (if any)

Do not assume success. Verify every change before closing the task.
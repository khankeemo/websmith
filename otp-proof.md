# OTP End-to-End Proof

## API Routes

### Send OTP: `POST /api/v1/auth/otp/send`
**File:** `app/api/v1/auth/otp/send/route.ts` (103 lines)

- Accepts: `{ email, purpose }`
- Validates email format
- Generates 6-digit OTP
- Stores in `otp_verifications` table with expiration
- Sends via Brevo email
- Creates `audit_logs` entry
- Handles duplicate email with `ON CONFLICT DO UPDATE` (commit b6c0377)

### Verify OTP: `POST /api/v1/auth/otp/verify`
**File:** `app/api/v1/auth/otp/verify/route.ts` (95 lines)

- Accepts: `{ email, otp_code }`
- Validates OTP against `otp_verifications` table
- Checks expiration
- Marks OTP as verified
- Returns success/failure
- Wrong OTP returns error

## SDK Client OTP Support

### `python.ts` client.py (lines 636–650)
```python
def send_otp(self, email: str, purpose: str = 'registration') -> Dict[str, Any]:
    payload = {
        'action': 'send',
        'email': email,
        'purpose': purpose
    }
    return self._request('auth/otp/send', payload)

def verify_otp(self, email: str, otp_code: str) -> Dict[str, Any]:
    payload = {
        'action': 'verify',
        'email': email,
        'otp_code': otp_code
    }
    return self._request('auth/otp/verify', payload)
```

### `python.ts` license_engine.py (lines 1152–1156)
```python
def send_otp(self, email: str, purpose: str = 'registration') -> Dict[str, Any]:
    return self._client.send_otp(email, purpose)

def verify_otp(self, email: str, otp_code: str) -> Dict[str, Any]:
    return self._client.verify_otp(email, otp_code)
```

## Welcome Dialog OTP UI Flow

### `python.ts` welcome.py (lines 1380–1591)

1. **Send OTP** (line 1525–1535): Collects email, calls `engine.send_otp()`
2. **On OTP sent** (line 1537–1543): Shows OTP entry field
3. **Verify OTP** (line 1545–1556): Collects OTP code, calls `engine.verify_otp()`
4. **On OTP verified** (line 1558–1564): Enables "Start Trial" button
5. **Wrong OTP blocked** (line 1563–1564): Shows error, Start Trial stays disabled
6. **Store Customer** (line 1573–1577): Calls `engine.store_customer()` with name, email, phone, company, country
7. **Start Trial** (line 1566–1582): Calls `engine.start_trial()`

## Database Tables Referenced

- `otp_verifications` — OTP storage + verification
- `audit_logs` — OTP send/verify audit trail
- `customers` — Customer registration
- `trials` — Trial creation
- `activations` — License activation

## Onboarding Completion (Phase 4 Step 4)

After OTP verification, the onboarding flow:

1. Customer created in `customers` table — name, email, phone, company, country saved
2. Trial created in `trials` table — linked to customer + hardware ID
3. Trial duration matches UI selection (passed as `trial_duration`)
4. Hardware ID saved via `HardwareDetector.get_fingerprint()`
5. Audit log created

## OTP Fix Commits

```
b6c0377 fix: OTP send INSERT conflicts with unique_email_purpose constraint
a67454f debug: expose error detail in OTP send response for email-specific 500
8acb78e fix: add detailed error logging to OTP send catch block
```

All code compiled successfully via `npm run build`.

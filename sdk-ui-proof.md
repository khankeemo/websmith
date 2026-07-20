# SDK Generator UI Proof

## File: `app/internal/api/developers/integrations/page.tsx`

## Quick Start Flow (line 914–942)
```
1. Product → 2. API Key → 3. SDK → 4. Template → 5. Generate
```
Verified: No Customer step, no hidden Customer placeholder, no extra screens.

## SDK Settings Defaults (Fixed)

### Device Limit: 1
```typescript
// Line 159 — CHANGED from 3 to 1
const [deviceLimit, setDeviceLimit] = useState(1);
```

### Offline Grace: 0
```typescript
// Line 160 — CHANGED from 30 to 0
const [offlineGraceDays, setOfflineGraceDays] = useState(0);
```

### Support Email: support@websmithdigital.com
```typescript
// Line 161 — CHANGED from '' to support@websmithdigital.com
const [supportEmail, setSupportEmail] = useState('support@websmithdigital.com');

// Line 1264 — placeholder CHANGED from support@example.com
placeholder="support@websmithdigital.com"
```

### Trial Duration: 1–30 Dropdown
```typescript
// Lines 1213-1219 — REPLACED fixed options with dynamic 1-30 range
{Array.from({ length: 30 }, (_, i) => i + 1).map(d => (
  <option key={d} value={d}>{d} Day{d !== 1 ? 's' : ''}</option>
))}
```

- Minimum: 1 day
- Maximum: 30 days
- Default: 7 days
- Values 60 and 90 REMOVED

## Request Payload (line 513–530)
All settings are sent to SDK generation:
```typescript
body: JSON.stringify({
  productId: selectedProduct,
  runtime: selectedRuntime,
  trial_enabled: trialEnabled,
  trial_duration: trialDuration,     // 1-30, passed to SDK
  email_verification: emailVerification,
  device_limit: deviceLimit,          // now defaults to 1
  offline_grace_days: offlineGraceDays, // now defaults to 0
  support_email: supportEmail,        // now defaults to support@websmithdigital.com
  allow_conversion: allowConversion,
})
```

## Build Status
`npm run build` — **PASS** (zero TypeScript errors)

## Git Hash
```
HEAD: e6a86e9 Merge branch 'deploy/internal-api-clean-v1'
```
Uncommitted changes: 3 files modified (page.tsx, runtime-builder.ts)

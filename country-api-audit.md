# Country API Integration Audit

## Summary
The SDK generator produces a `welcome.py` with hardcoded `COUNTRY_CODES` (52 entries). A `GET /api/v1/countries` endpoint exists but the generator never calls it. Fix: inject countries from DB into the generator context.

## Source of Truth: Database

### Schema (`lib/backend-db/index.ts:384–392`, `lib/migrations/runner.ts:67–74`)
```sql
CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dial TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Seed Data (47 countries in `lib/migrations/runner.ts:75–125`)
Includes codes: IN, US, GB, CA, AU, DE, FR, IT, ES, BR, JP, CN, KR, SG, AE, SA, ZA, NG, KE, EG, MX, AR, CL, CO, NL, SE, NO, DK, FI, CH, AT, BE, PT, IE, NZ, HK, MY, TH, VN, PH, PK, BD, TR, RU, UA, PL, RO, GR, IL

## API Layer (`app/api/v1/countries/route.ts`)

### Current Behavior
| Scenario | Behavior |
|----------|----------|
| DB available, rows found | Returns DB rows (code, name, dial) |
| DB available, no rows | Returns 3-item EMERGENCY_FALLBACK |
| DB unavailable | Logs warning, returns 3-item EMERGENCY_FALLBACK |
| Auth missing (no X-API-Key) | 401 |
| Rate limited | 429 |

### Issues Found
1. **Response lacks `flag` field** - DB schema has no `flag` column, so the API returns `{code, name, dial}` only. The hardcoded COUNTRY_CODES in python.ts includes a `flag` field with Unicode regional indicator emoji.
2. **EMERGENCY_FALLBACK hardcoded** (line 17-21) - duplicates 3 countries that are already in DB seed data.
3. **Error handler also returns fallback** (line 76) - even on uncaught exceptions.

## Generator Layer

### Primary: `app/internal/publisher/runtimes/python.ts` (lines 1339-1396)
- Function: `getPythonTemplates(context)`
- Template: `welcome.py` with hardcoded `COUNTRY_CODES = [...]` (52 entries)
- Each entry: `{code, name, dial, flag}` where flag is Unicode regional indicator
- Uses `${productName}`, `${supportEmail}` template interpolation via backtick strings
- This is THE file that generates the SDK's `welcome.py`

### Fallback: `app/internal/publisher/runtime-builder.ts` (lines 1333-1390)
- Identical hardcoded `COUNTRY_CODES` (52 entries)
- Only used if `RuntimeBuilder` called without per-runtime generator
- Currently `getPythonTemplates()` takes precedence (line 3038 dispatches to runtimes/)

## PublisherContext (`app/internal/publisher/index.ts:76-90`)
```typescript
interface PublisherContext {
  productId: string;
  product: ProductData;
  productName: string;
  plans: PlanData[];
  apiKey: string;
  apiSecret: string;
  runtime: string;
  kitVersion: string;
  generatedAt: string;
  jobId?: string;
  maxDevices?: number;
  trialDays?: number;
  supportEmail?: string;
}
```
**No `countries` field exists** - must be added.

## UI Layer (`app/internal/api/developers/integrations/page.tsx`)
- Line 163: `const [countryList, setCountryList] = useState<...>([]);` — **never populated** from API
- Used in the UI for country selection dropdown — currently always empty

## Changes Required

### Phase 2 — Fix API (`app/api/v1/countries/route.ts`)
1. Remove `EMERGENCY_FALLBACK` and inline 3-item array
2. Simplify: query DB, return `{success, data}` or `{success, data: []}` on failure
3. Ensure error handler returns empty array, not hardcoded fallback

### Phase 3 — Wire countries into generator
1. **`publisher/index.ts`**: Add `countries` to `PublisherContext`. In `publishProduct()`, after DB connection (line 432), fetch countries and include in context.
2. **`publisher/runtimes/python.ts`**: Replace hardcoded `COUNTRY_CODES = [...]` with `COUNTRY_CODES = ${JSON.stringify(context.countries)}` using context data.
3. **`publisher/runtime-builder.ts`**: Same replacement in fallback template.
4. **`page.tsx`**: Fetch `/api/v1/countries` (internal) and populate `setCountryList`.

### Phase 4 — Cleanup hardcoded data
1. Remove the 52-line array from `python.ts:1339-1396`
2. Remove the 52-line array from `runtime-builder.ts:1333-1390`

### Phase 5 — Test
1. Verify `GET /api/v1/countries` returns 47 countries from DB
2. Generate a test SDK and verify `welcome.py` contains dynamic country list
3. Verify UI dropdown shows country list

## Flag Handling
The hardcoded templates include emoji flags computed from country codes using Unicode Regional Indicator Symbols:
- Algorithm: For each char in ISO 3166-1 alpha-2 code, `0x1F1E6 + (ord(char) - ord('A'))`
- Example: `IN` → `\U0001F1EE\U0001F1F3` → `🇮🇳`
- **Recommendation**: Add `flag` field to DB schema OR compute it client-side in the generated code

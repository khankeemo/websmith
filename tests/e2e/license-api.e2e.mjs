#!/usr/bin/env node
/**
 * License Platform E2E Test — live public API + production DB
 *
 * Seeds an isolated E2E product/plan/API key/license directly in the
 * production database, exercises the live public License/Trial API on
 * Vercel, then cleans up every seeded row (including audit trails).
 *
 * Run:  node --experimental-strip-types tests/e2e/license-api.e2e.mjs
 * Env:  reads DATABASE_URL + NEXT_PUBLIC_API_URL from .env.production
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE_URL = process.env.E2E_BASE_URL || 'https://www.websmithdigital.com';

const failures = [];
let passCount = 0;

function test(name, fn) {
  return (async () => {
    try {
      await fn();
      passCount += 1;
      console.log(`  \u2713 ${name}`);
    } catch (e) {
      failures.push({ name, message: e.message });
      console.error(`  \u2717 ${name}: ${e.message}`);
    }
  })();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadEnvFile(file) {
  const env = {};
  const text = fs.readFileSync(file, 'utf-8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) {
      env[m[1]] = m[2].replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }
  }
  return env;
}

function genLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 24; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key.match(/.{1,4}/g).join('-');
}

async function main() {
  const envFile = fs.existsSync(path.join(ROOT, '.env.e2e'))
    ? path.join(ROOT, '.env.e2e')
    : path.join(ROOT, '.env.production');
  const env = loadEnvFile(envFile);
  const DATABASE_URL = env.DATABASE_URL;
  assert(DATABASE_URL, `${envFile} must contain DATABASE_URL (pull with: vercel env pull .env.e2e --environment=production)`);

  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  const ts = Date.now();
  const productId = `prod_e2e_${ts}`;
  const productName = `E2E Test Product ${ts}`;
  const planName = 'E2E Pro Plan';
  const apiKey = `pk_e2e_${ts}_${Math.random().toString(36).slice(2, 14).toUpperCase()}`;
  const licenseKey = genLicenseKey();
  const customerEmail = `e2e.${ts}@websmith.test`;
  const hardwareA = `hw-e2e-a-${ts}`;
  const hardwareB = `hw-e2e-b-${ts}`;
  const expiryDate = new Date(Date.now() + 365 * 86400000).toISOString();

  const seed = async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        `INSERT INTO products (product_id, name, description, version, price, is_active, company_name, product_type, website, api_key, created_at, updated_at, is_deleted)
         VALUES ($1, $2, 'E2E test product', '1.0.0', 99, 1, 'Websmith', 'software', '', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false)`,
        [productId, productName],
      );
      await c.query(
        `INSERT INTO plans (product_id, name, description, price, default_expiry_days, max_devices, is_active, features, display_order, is_trial_plan, trial_days_limit, created_at, updated_at)
         VALUES ($1, $2, 'E2E plan', 99, 365, 1, true, '[]'::jsonb, 1, false, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [productId, planName],
      );
      await c.query(
        `INSERT INTO developer_api_keys (product_id, api_key, secret_hash, status, permissions, rate_limit, created_at)
         VALUES ($1, $2, 'e2e', 'active', $3, 1000, CURRENT_TIMESTAMP)`,
        [productId, apiKey, JSON.stringify(['license:read', 'license:write', 'trial:read', 'device:write'])],
      );
      await c.query(
        `INSERT INTO licenses (license_key, product_id, customer_name, customer_email, customer_username, customer_phone,
           plan, status, inactive_reason, is_trial, expiry_date, duration_days, max_devices, device_count, notes,
           is_activated, activated_at, last_validated, created_at, updated_at)
         VALUES ($1, $2, 'E2E Customer', $3, 'e2ecustomer', '', $4, 'active', NULL, false, $5, 365, 1, 0, 'E2E', false, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [licenseKey, productId, customerEmail, planName, expiryDate],
      );
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  };

  const cleanup = async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`DELETE FROM licenses WHERE product_id = $1`, [productId]);
      await c.query(`DELETE FROM activations WHERE license_key = $1`, [licenseKey]);
      await c.query(`DELETE FROM renewal_history WHERE license_key = $1`, [licenseKey]);
      await c.query(`DELETE FROM customer_licenses WHERE license_key = $1`, [licenseKey]);
      await c.query(`DELETE FROM customers WHERE email = $1`, [customerEmail]);
      await c.query(`DELETE FROM trials WHERE customer_email = $1 AND product_id = $2`, [customerEmail, productId]);
      await c.query(`DELETE FROM developer_api_keys WHERE api_key = $1`, [apiKey]);
      await c.query(`DELETE FROM plans WHERE product_id = $1`, [productId]);
      await c.query(`DELETE FROM products WHERE product_id = $1`, [productId]);
      await c.query(`DELETE FROM audit_logs WHERE license_key = $1 OR hardware_id IN ($2, $3)`, [licenseKey, hardwareA, hardwareB]);
      await c.query(`DELETE FROM api_request_logs WHERE api_key_id IN (SELECT id FROM developer_api_keys WHERE api_key = $1)`, [apiKey]);
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      console.error('Cleanup failed:', e.message);
    } finally {
      c.release();
    }
  };

  const call = async (endpoint, { method = 'POST', body, key = apiKey } = {}) => {
    const headers = {};
    if (key) headers['X-API-Key'] = key;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = { raw: await res.text() };
    }
    return { status: res.status, json, headers: res.headers };
  };

  console.log('\n  Seeding E2E data...');
  try {
    await seed();
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exit(1);
  }

  console.log('\n  Running E2E tests...\n');

  const tests = [
    test('AUTH: missing API key rejected (401)', async () => {
      const r = await call('/api/v1/license', { key: null });
      assert(r.status === 401, `expected 401, got ${r.status}`);
      assert(r.json.error?.code === 'MISSING_API_KEY', `unexpected body: ${JSON.stringify(r.json)}`);
    }),

    test('AUTH: invalid API key rejected (401)', async () => {
      const r = await call('/api/v1/license', { key: 'pk_invalid_0000000000000000' });
      assert(r.status === 401, `expected 401, got ${r.status}`);
    }),

    test('VALIDATE: license key resolves before activation', async () => {
      const r = await call('/api/v1/license', { body: { action: 'validate', license_key: licenseKey } });
      assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert(r.json.success === true, `success != true`);
      assert(r.json.license?.license_key === licenseKey, 'license key mismatch');
      assert(r.json.license?.days_left > 0, 'days_left not positive');
      assert(r.json.license?.plan === planName, 'plan mismatch');
    }),

    test('ACTIVATE: first hardware activates successfully', async () => {
      const r = await call('/api/v1/license', {
        body: { action: 'activate', license_key: licenseKey, hardware_id: hardwareA, device_name: 'E2E Device A' },
      });
      assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert(r.json.status === 'licensed', `status != licensed: ${JSON.stringify(r.json)}`);
      assert(r.json.hardware?.is_activated === true, 'hardware not flagged activated');
    }),

    test('VALIDATE: hardware-bound validate reports this device activated', async () => {
      const r = await call('/api/v1/license', {
        body: { action: 'validate', license_key: licenseKey, hardware_id: hardwareA },
      });
      assert(r.status === 200, `expected 200, got ${r.status}`);
      assert(r.json.hardware?.is_activated === true, 'this device should be activated');
    }),

    test('ACTIVATE: same hardware re-activation is idempotent (already activated)', async () => {
      const r = await call('/api/v1/license', {
        body: { action: 'activate', license_key: licenseKey, hardware_id: hardwareA },
      });
      assert(r.status === 200, `expected 200, got ${r.status}`);
      assert(r.json.hardware?.is_activated === true, 'device should stay activated');
    }),

    test('ACTIVATE: second hardware blocked by device limit (MAX_DEVICES_EXCEEDED)', async () => {
      const r = await call('/api/v1/license', {
        body: { action: 'activate', license_key: licenseKey, hardware_id: hardwareB },
      });
      assert(r.status === 403, `expected 403, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert(r.json.error?.code === 'MAX_DEVICES_EXCEEDED', `unexpected code: ${JSON.stringify(r.json)}`);
    }),

    test('DEACTIVATE: device deactivates cleanly', async () => {
      const r = await call('/api/v1/license', {
        body: { action: 'deactivate', license_key: licenseKey, hardware_id: hardwareA },
      });
      assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert(r.json.success === true, 'deactivate failed');
    }),

    test('VALIDATE: after deactivation device is no longer activated', async () => {
      const r = await call('/api/v1/license', {
        body: { action: 'validate', license_key: licenseKey, hardware_id: hardwareA },
      });
      assert(r.status === 200, `expected 200, got ${r.status}`);
      assert(r.json.hardware?.is_activated === false, 'device should NOT be activated');
    }),

    test('RENEW: extends expiry by 365 days from current expiry', async () => {
      const before = await call('/api/v1/license', { body: { action: 'validate', license_key: licenseKey } });
      const oldExpiry = new Date(before.json.license?.expiry_date);
      const r = await call('/api/v1/license', {
        body: { action: 'renew', license_key: licenseKey },
      });
      assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
      const newExpiry = new Date(r.json.data?.new_expiry_date);
      const days = Math.round((newExpiry - oldExpiry) / 86400000);
      assert(days >= 364 && days <= 366, `expected +365 days, got +${days}`);
    }),

    test('RENEW: custom extra_days honored', async () => {
      const before = await call('/api/v1/license', { body: { action: 'validate', license_key: licenseKey } });
      const oldExpiry = new Date(before.json.license?.expiry_date);
      const r = await call('/api/v1/license', {
        body: { action: 'renew', license_key: licenseKey, extra_days: 30 },
      });
      assert(r.status === 200, `expected 200, got ${r.status}`);
      const days = Math.round((new Date(r.json.data?.new_expiry_date) - oldExpiry) / 86400000);
      assert(days >= 29 && days <= 31, `expected +30 days, got +${days}`);
    }),

    test('RENEWAL: verify-renewal returns eligibility + available plans', async () => {
      const r = await call('/api/v1/license/verify-renewal', { body: { license_key: licenseKey } });
      assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert(r.json.success === true, 'verify-renewal failed');
      assert(r.json.is_expired === false, 'license should not be expired');
      const plans = r.json.available_plans || [];
      assert(plans.some((p) => p.name === planName), `plan ${planName} not in available plans`);
    }),

    test('TRIAL: start creates active trial (isolated email/hardware)', async () => {
      const r = await call('/api/v1/trial', {
        body: {
          action: 'start',
          hardware_id: hardwareA,
          product_id: productId,
          customer_email: customerEmail,
          customer_name: 'E2E Trial User',
        },
      });
      assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert(r.json.success === true, 'trial start failed');
    }),

    test('TRIAL: duplicate trial rejected (TRIAL_ALREADY_CONSUMED)', async () => {
      const r = await call('/api/v1/trial', {
        body: {
          action: 'start',
          hardware_id: hardwareB,
          product_id: productId,
          customer_email: customerEmail,
          customer_name: 'E2E Trial User',
        },
      });
      assert(r.status === 400, `expected 400, got ${r.status}`);
      assert(r.json.error?.code === 'TRIAL_ALREADY_CONSUMED', `unexpected code: ${JSON.stringify(r.json)}`);
    }),

    test('TRIAL: status reports active trial for hardware', async () => {
      const r = await call('/api/v1/trial', {
        body: { action: 'status', hardware_id: hardwareA, product_id: productId },
      });
      assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
      assert(r.json.success === true, 'trial status failed');
    }),

    test('PUBLIC: store products endpoint reachable', async () => {
      const r = await call('/api/v1/store/products', { method: 'GET' });
      assert(r.status === 200, `expected 200, got ${r.status}`);
    }),
  ];

  await Promise.all(tests);

  console.log('\n  Cleaning up E2E data...');
  await cleanup();
  await pool.end();

  const total = passCount + failures.length;
  console.log(`\n  ${passCount}/${total} E2E tests passed\n`);
  if (failures.length > 0) {
    console.error('  FAILED:');
    for (const f of failures) {
      console.error(`   - ${f.name}: ${f.message}`);
    }
    process.exit(1);
  }
  console.log('  All E2E tests passed.\n');
}

main().catch((e) => {
  console.error('E2E harness error:', e);
  process.exit(1);
});

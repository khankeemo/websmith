#!/usr/bin/env node
/**
 * Multi-Runtime SDK Generation & Validation Smoke Test
 *
 * Generates each runtime's SDK source files through the real runtime
 * template generators, writes a minimal api-config.json + manifest.json,
 * then runs the production SDKValidator against each generated package.
 * This is the parity / no-drift check across all 13 runtimes.
 *
 * Run:  node --experimental-strip-types tests/sdk-generation/multi-runtime.test.mjs
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEST_DIR = path.join(ROOT, 'tests/sdk-generation');
const MODULE_ENTRY = path.join(TEST_DIR, 'multi-runtime-runner.mts');

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
  if (!condition) throw new Error(message);
}

const RUNNERS = [
  'python', 'node', 'php', 'java', 'dotnet', 'go', 'rust',
  'cpp', 'c', 'javascript', 'typescript', 'bun', 'deno',
];

async function main() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multi-runtime-'));

  const runnerSrc = `
import fs from 'node:fs';
import path from 'node:path';
import { getPythonTemplates } from '../../app/internal/publisher/runtimes/python.ts';
import { getNodeTemplates } from '../../app/internal/publisher/runtimes/node.ts';
import { getPhpTemplates } from '../../app/internal/publisher/runtimes/php.ts';
import { getJavaTemplates } from '../../app/internal/publisher/runtimes/java.ts';
import { getDotNetTemplates } from '../../app/internal/publisher/runtimes/dotnet.ts';
import { getGoTemplates } from '../../app/internal/publisher/runtimes/go.ts';
import { getRustTemplates } from '../../app/internal/publisher/runtimes/rust.ts';
import { getCppTemplates } from '../../app/internal/publisher/runtimes/cpp.ts';
import { getCTemplates } from '../../app/internal/publisher/runtimes/c.ts';
import { getJavaScriptTemplates } from '../../app/internal/publisher/runtimes/javascript.ts';
import { getTypeScriptTemplates } from '../../app/internal/publisher/runtimes/typescript.ts';
import { getBunTemplates } from '../../app/internal/publisher/runtimes/bun.ts';
import { getDenoTemplates } from '../../app/internal/publisher/runtimes/deno.ts';
import { SDKValidator } from '../../app/internal/publisher/sdk-validator.ts';

const outRoot = process.argv[2];
const apiUrl = process.env.WEBSMITH_API_URL || 'https://websmithdigital.com';
const generatedAt = new Date().toISOString();

const generators = {
  python: getPythonTemplates,
  node: getNodeTemplates,
  php: getPhpTemplates,
  java: getJavaTemplates,
  dotnet: getDotNetTemplates,
  go: getGoTemplates,
  rust: getRustTemplates,
  cpp: getCppTemplates,
  c: getCTemplates,
  javascript: getJavaScriptTemplates,
  typescript: getTypeScriptTemplates,
  bun: getBunTemplates,
  deno: getDenoTemplates,
};

const context = {
  productId: 'prod_smoketest',
  product: {
    id: 'prod_smoketest',
    name: 'Smoke Test Product',
    description: 'Multi-runtime smoke test',
    version: '1.0.0',
    company_name: 'Websmith',
    primary_color: '#3b82f6',
    support_email: 'support@websmithdigital.com',
    support_url: 'https://websmithdigital.com/support',
    logo_url: '',
    trial_enabled: true,
    trial_days: 7,
    trial_message: 'Start your free trial',
    hardware_binding: true,
    offline_days: 7,
    renewal_reminder_days: 7,
  },
  productName: 'Smoke Test Product',
  plans: [{
    id: 'plan_smoke',
    name: 'Pro',
    description: 'Smoke plan',
    price: 99,
    duration_days: 365,
    max_devices: 2,
    is_trial_plan: false,
    display_order: 1,
  }],
  apiKey: 'pk_smoke_test_key',
  apiSecret: 'sk_smoke_test_secret',
  runtime: 'python',
  kitVersion: '1.0.0',
  generatedAt,
  maxDevices: 2,
  trialDays: 7,
  supportEmail: 'support@websmithdigital.com',
};

const apiConfig = {
  product: { id: 'prod_smoketest', name: 'Smoke Test Product', version: '1.0.0', description: 'smoke' },
  api: { url: apiUrl, version: 'v1', public_key: 'pk_smoke_test_key', timeout: 30000, retry_count: 3 },
  store: { url: apiUrl + '/software-store', buy_url: apiUrl + '/internal/api/buy', renew_url: apiUrl + '/internal/api/renew' },
  trial: { enabled: true, days: 7, require_email: true, require_company: false, auto_convert: true, message: 'trial' },
  license: { enabled: true, hardware_binding: true, max_devices: 2, offline_days: 7, renewal_reminder_days: 7 },
  hardware: { fingerprint: { include_cpu: true, include_motherboard: true, include_mac: true, include_os: true, hash_algorithm: 'sha256' }, replacement: { enabled: true, require_approval: true, max_replacements_per_year: 2 } },
  offline: { enabled: true, cache_days: 7, encryption: 'fernet', validate_on_reconnect: true },
  security: { hmac_algorithm: 'sha256', timestamp_window: 300, require_nonce: true, rate_limit: { enabled: true, max_requests: 60, window_seconds: 60 } },
  branding: { company_name: 'Websmith', primary_color: '#3b82f6', support_email: 'support@websmithdigital.com', website_url: 'https://websmithdigital.com' },
  ui: { language: 'en', theme: 'dark' },
  features: { sms: false, offline: true, hardware_replacement: true },
  sdk: { version: '1.0.0', runtime_type: 'python', cache_days: 7, renewal_reminder_days: 7 },
};

const sdkValidator = new SDKValidator();
const results = [];

for (const name of Object.keys(generators)) {
  try {
    const ctx = { ...context, runtime: name };
    const files = generators[name](ctx);
    const pkgDir = path.join(outRoot, 'pkg-' + name);
    fs.mkdirSync(pkgDir, { recursive: true });
    for (const [filename, content] of Object.entries(files)) {
      const fp = path.join(pkgDir, filename);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, content, 'utf-8');
    }
    fs.mkdirSync(path.join(pkgDir, 'config'), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'config', 'api-config.json'), JSON.stringify(apiConfig, null, 2), 'utf-8');
    const manifest = { kit_version: '1.0.0', api_version: 'v1', runtime: name, generated_at: generatedAt, product_id: 'prod_smoketest', product_name: 'Smoke Test Product' };
    fs.writeFileSync(path.join(pkgDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    const report = await sdkValidator.validate(pkgDir, name);
    results.push({ runtime: name, valid: report.valid, errors: report.errors });
  } catch (e) {
    results.push({ runtime: name, valid: false, errors: [String((e && e.message) || e)] });
  }
}
console.log(JSON.stringify(results));
`;

  fs.writeFileSync(MODULE_ENTRY, runnerSrc, 'utf-8');

  let out;
  try {
    out = execFileSync(process.execPath, ['--experimental-strip-types', MODULE_ENTRY, outDir], {
      cwd: ROOT,
      encoding: 'utf-8',
      env: { ...process.env },
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    console.error('Runner crashed:', e.stdout || e.message);
    fs.rmSync(MODULE_ENTRY, { recursive: true, force: true });
    process.exit(1);
  }

  let results;
  try {
    results = JSON.parse(out.trim().split('\n').pop());
  } catch (e) {
    console.error('Runner output could not be parsed:', out.slice(-3000));
    fs.rmSync(MODULE_ENTRY, { recursive: true, force: true });
    throw new Error(`Runner failed: ${e.message}`);
  }

  const testPromises = results.map((r) =>
    test(`${r.runtime}: generated + validated`, () => {
      assert(r.valid, r.errors.join('; '));
    })
  );
  await Promise.all(testPromises);

  fs.rmSync(MODULE_ENTRY, { recursive: true, force: true });
  fs.rmSync(outDir, { recursive: true, force: true });

  const total = passCount + failures.length;
  console.log(`\n  ${passCount}/${total} tests passed`);
  if (failures.length > 0) {
    console.error('\n  FAILED:');
    for (const f of failures) console.error(`   - ${f.name}: ${f.message}`);
    process.exit(1);
  }
  console.log('  All runtimes generated and validated.\n');
}

main().catch((e) => {
  console.error('Test harness error:', e);
  process.exit(1);
});

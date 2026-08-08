
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

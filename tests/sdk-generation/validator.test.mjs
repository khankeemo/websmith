#!/usr/bin/env node
/**
 * SDK Generation Validator Test
 * Runs the SDK generator into a temp dir, then asserts:
 *   1. Every template file is present in the output (same relative path)
 *   2. No __pycache__ / build artifacts leak into the SDK
 *   3. No unreplaced {{PLACEHOLDER}} tokens in non-documentation files
 *   4. Documentation files are copied verbatim (placeholder tokens are documentation text)
 *   5. Non-documentation files are the template with the placeholder map applied
 *   6. manifest.json contains a real ISO-8601 generated_at timestamp
 *
 * Interpreter-free: never assumes Python exists.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE_DIR = path.join(ROOT, 'app/internal/publisher/template/python');
const GENERATOR = path.join(ROOT, 'scripts/generate-sdk.mjs');

const SUPPORTED_EXTENSIONS = ['.py', '.md', '.json', '.svg'];

const failures = [];
let passCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount += 1;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failures.push({ name, message: e.message });
    console.error(`  \u2717 ${name}: ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function collectFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      for (const sub of collectFiles(fullPath)) {
        results.push(entry + path.sep + sub);
      }
    } else {
      results.push(entry);
    }
  }
  return results;
}

function isDocumentationFile(fileName) {
  return fileName.split(/[\\/]/).includes('docs');
}

function buildExpectedPlaceholders() {
  return {
    '{{PRODUCT_NAME}}': 'ZEM MAC OS',
    '{{PRODUCT_ID}}': 'prod_zemmacos',
    '{{API_URL}}': process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || '',
    '{{SDK_VERSION}}': '1.0.0',
    '{{RUNTIME_TYPE}}': 'python',
    '{{COMPANY_NAME}}': '',
    '{{SUPPORT_EMAIL}}': '',
    '{{SALES_EMAIL}}': '',
    '{{WEBSITE_URL}}': '',
    '{{PRIMARY_COLOR}}': '',
    '{{TRIAL_DAYS}}': '',
    '{{MAX_DEVICES}}': '',
    '{{SENDER_NAME}}': '',
    '{{GENERATED_AT}}': null,
  };
}

function applyExpected(content, placeholders) {
  let result = content;
  for (const [key, value] of Object.entries(placeholders)) {
    if (value !== null) {
      result = result.split(key).join(value);
    }
  }
  return result;
}

function unreplacedTokens(content) {
  return content.match(/\{\{[A-Z_]+\}\}/g) || [];
}

async function main() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-validator-'));

  console.log('\n  Generating SDK...');
  execFileSync(process.execPath, [GENERATOR, outDir], {
    cwd: ROOT,
    encoding: 'utf-8',
    env: { ...process.env },
  });

  const templateFiles = collectFiles(TEMPLATE_DIR);
  const templateSet = new Set(templateFiles.map((f) => f.replaceAll(path.sep, '/')));
  const generatedFiles = collectFiles(outDir);
  const generatedSet = new Set(generatedFiles.map((f) => f.replaceAll(path.sep, '/')));

  test('All template files present in generated SDK', () => {
    const missing = [...templateSet].filter((f) => !generatedSet.has(f));
    assert(missing.length === 0, `Missing files: ${missing.join(', ')}`);
    assert(generatedSet.size === templateSet.size, `Expected ${templateSet.size} files, got ${generatedSet.size}`);
  });

  test('No build artifacts (__pycache__) in generated SDK', () => {
    const artifacts = generatedFiles.filter((f) => f.includes('__pycache__') || f.endsWith('.pyc'));
    assert(artifacts.length === 0, `Artifacts found: ${artifacts.join(', ')}`);
  });

  const docExpected = new Map();
  const nonDocExpected = new Map();
  const placeholders = buildExpectedPlaceholders();

  for (const rel of templateFiles) {
    const content = fs.readFileSync(path.join(TEMPLATE_DIR, rel), 'utf-8');
    if (isDocumentationFile(rel)) {
      docExpected.set(rel, content);
    } else {
      nonDocExpected.set(rel, applyExpected(content, placeholders));
    }
  }

  test('Documentation files copied verbatim (no placeholder substitution)', () => {
    const mismatched = [];
    for (const [rel, expected] of docExpected) {
      const generated = fs.readFileSync(path.join(outDir, rel), 'utf-8');
      if (generated !== expected) {
        mismatched.push(rel);
      }
    }
    assert(mismatched.length === 0, `Docs modified: ${mismatched.join(', ')}`);
  });

  test('No unreplaced placeholders in non-documentation files', () => {
    const leaking = [];
    for (const [rel, expected] of nonDocExpected) {
      const tokens = unreplacedTokens(expected).filter((t) => !(rel === 'manifest.json' && t === '{{GENERATED_AT}}'));
      if (tokens.length > 0) {
        leaking.push(`${rel} (${tokens.join(', ')})`);
      }
    }
    assert(leaking.length === 0, `Unreplaced tokens: ${leaking.join('; ')}`);
  });

  test('Non-documentation files match template with placeholder map applied', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf-8'));
    const mismatched = [];
    for (const [rel, expected] of nonDocExpected) {
      let expectedContent = expected;
      if (rel === 'manifest.json') {
        expectedContent = applyExpected(
          fs.readFileSync(path.join(TEMPLATE_DIR, rel), 'utf-8'),
          { ...placeholders, '{{GENERATED_AT}}': manifest.generated_at },
        );
      }
      const generated = fs.readFileSync(path.join(outDir, rel), 'utf-8');
      if (generated !== expectedContent) {
        mismatched.push(rel);
      }
    }
    assert(mismatched.length === 0, `Mismatched files: ${mismatched.join(', ')}`);
  });

  test('manifest.json has real ISO-8601 generated_at timestamp', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf-8'));
    assert(
      typeof manifest.generated_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(manifest.generated_at),
      `generated_at is not ISO-8601: ${JSON.stringify(manifest.generated_at)}`,
    );
    assert(manifest.generated_at !== '{{GENERATED_AT}}', 'generated_at placeholder was not replaced');
  });

  fs.rmSync(outDir, { recursive: true, force: true });

  const total = passCount + failures.length;
  console.log(`\n  ${passCount}/${total} tests passed`);
  if (failures.length > 0) {
    console.error(`\n  FAILED:\n`);
    for (const f of failures) {
      console.error(`   - ${f.name}: ${f.message}`);
    }
    process.exit(1);
  }
  console.log('  All SDK generation validations passed.\n');
}

main().catch((e) => {
  console.error('Test harness error:', e);
  process.exit(1);
});

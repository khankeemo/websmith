#!/usr/bin/env node
/**
 * Generate ZEM MAC OS Python SDK
 * Reads template files directly (no TypeScript parsing needed)
 */

import fs from 'fs';
import path from 'path';

const context = {
  productId: 'prod_zemmacos',
  productName: 'ZEM MAC OS',
  kitVersion: '1.0.0',
  runtime: 'python',
  generatedAt: new Date().toISOString(),
};

const TEMPLATE_DIR = path.resolve(import.meta.dirname, '../app/internal/publisher/template/python');

const SUPPORTED_EXTENSIONS = ['.py', '.md', '.json', '.svg'];

function getAllTemplateFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const subFiles = getAllTemplateFiles(fullPath);
      for (const sub of subFiles) {
        results.push(entry + path.sep + sub);
      }
    } else {
      results.push(entry);
    }
  }
  return results;
}

function shouldInclude(name) {
  const ext = path.extname(name).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

function buildPlaceholders() {
  const apiUrl = process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  return {
    '{{PRODUCT_NAME}}': 'ZEM MAC OS',
    '{{PRODUCT_ID}}': 'prod_zemmacos',
    '{{API_URL}}': apiUrl,
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
    '{{GENERATED_AT}}': context.generatedAt,
  };
}

function replacePlaceholders(content, placeholders) {
  let result = content;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.split(key).join(value);
  }
  return result;
}

function findUnreplacedPlaceholders(content) {
  const regex = /\{\{[A-Z_]+\}\}/g;
  return content.match(regex) || [];
}

function isDocumentationFile(fileName) {
  return fileName.split(/[\\/]/).includes('docs');
}

try {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    throw new Error(`Template directory not found: ${TEMPLATE_DIR}`);
  }

  const placeholders = buildPlaceholders();
  const allFiles = getAllTemplateFiles(TEMPLATE_DIR);
  const filesToProcess = allFiles.filter(f => shouldInclude(f));

  if (filesToProcess.length === 0) {
    throw new Error('No template files found to process');
  }

  const templates = {};

  for (const fileName of filesToProcess) {
    const filePath = path.join(TEMPLATE_DIR, fileName);
    let content = fs.readFileSync(filePath, 'utf-8');
    if (!isDocumentationFile(fileName)) {
      content = replacePlaceholders(content, placeholders);
    }

    const unreplaced = findUnreplacedPlaceholders(content);
    if (unreplaced.length > 0) {
      console.warn(`  ⚠ ${fileName} has unreplaced placeholders: ${unreplaced.join(', ')}`);
    }

    templates[fileName] = content;
    console.log(`  ✓ ${fileName}`);
  }

  const outDir = process.argv[2] || 'D:/ZEMmacos/SDKToolkit_prod_zemmacos_new';
  for (const [filename, content] of Object.entries(templates)) {
    const fp = path.join(outDir, filename);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, content, 'utf-8');
  }

  console.log(`\nSDK generated at: ${outDir}`);
  console.log(`Files: ${Object.keys(templates).length}`);
} catch (e) {
  console.error('Generation failed:', e.message);
  process.exit(1);
}

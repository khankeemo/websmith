/**
 * Node.js Runtime Generator
 *
 * Orchestration-only: loads template files from template/node/,
 * replaces placeholders, validates, and returns the file map.
 * Contains NO business logic — all logic lives in the template.
 */

import fs from 'fs';
import path from 'path';
import type { PublisherContext } from '../index';

const TEMPLATE_DIR = path.resolve(process.cwd(), 'app', 'internal', 'publisher', 'template', 'node');

const MANDATORY_FILES = [
  'index.js',
  'client.js',
  'cache.js',
  'crypto.js',
  'hardware.js',
  'license_engine.js',
  'universal_email_dialog.js',
  'universal_license_center.js',
  'manifest.json',
  'package.json',
  'README.md',
];

const SUBDIR_MANDATORY = [
  'assets' + path.sep + 'badge.svg',
  'assets' + path.sep + 'logo.svg',
  'config' + path.sep + 'api-config.json',
];

interface PlaceholderMap {
  [key: string]: string;
}

const PLACEHOLDER_KEYS = [
  'kit_version',
  'runtime',
  'generated_at',
  'product_id',
  'product_name',
  'package_name',
  'product_version',
  'product_description',
  'company_name',
  'year',
];

function buildPlaceholders(context: PublisherContext): PlaceholderMap {
  const product = (context.product || {}) as any;
  return {
    '${kit_version}': context.kitVersion || '1.0.0',
    '${runtime}': context.runtime || 'node',
    '${generated_at}': context.generatedAt || new Date().toISOString(),
    '${product_id}': context.productId || '',
    '${product_name}': context.productName || 'Product',
    '${package_name}': 'wsd-' + (context.productId || 'sdk') + '-sdk',
    '${product_version}': product.version || '',
    '${product_description}': product.description || '',
    '${company_name}': product.company_name || '',
    '${year}': String(new Date().getFullYear()),
  };
}

function replacePlaceholders(content: string, placeholders: PlaceholderMap): string {
  let result = content;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.split(key).join(value);
  }
  return result;
}

function findUnreplacedPlaceholders(content: string): string[] {
  const found: string[] = [];
  for (const key of PLACEHOLDER_KEYS) {
    const token = '${' + key + '}';
    if (content.includes(token)) found.push(token);
  }
  return found;
}

function getAllTemplateFiles(dir: string): string[] {
  const results: string[] = [];
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

function isRootFile(name: string): boolean {
  return !name.includes(path.sep);
}

export function getNodeTemplates(context: PublisherContext): Record<string, string> {
  const placeholders = buildPlaceholders(context);
  const templates: Record<string, string> = {};

  if (!fs.existsSync(TEMPLATE_DIR)) {
    throw new Error(
      `[${context.productName}] Node template directory not found: ${TEMPLATE_DIR}. ` +
      'Generation failed — template directory is required.'
    );
  }

  const stat = fs.statSync(TEMPLATE_DIR);
  if (!stat.isDirectory()) {
    throw new Error(
      `[${context.productName}] Node template path is not a directory: ${TEMPLATE_DIR}.`
    );
  }

  const allFiles = getAllTemplateFiles(TEMPLATE_DIR);
  const rootFiles = allFiles.filter(f => isRootFile(f));

  const missingFiles: string[] = [];
  for (const mandatoryFile of MANDATORY_FILES) {
    if (!rootFiles.includes(mandatoryFile)) {
      missingFiles.push(mandatoryFile);
    }
  }

  const missingSubdir: string[] = [];
  for (const subdirFile of SUBDIR_MANDATORY) {
    if (!allFiles.includes(subdirFile)) {
      missingSubdir.push(subdirFile);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `[${context.productName}] Node template validation failed — missing mandatory files:\n` +
      missingFiles.map(f => `  - ${f}`).join('\n') +
      '\nGeneration stopped.'
    );
  }

  if (missingSubdir.length > 0) {
    throw new Error(
      `[${context.productName}] Node template validation failed — missing mandatory assets/config:\n` +
      missingSubdir.map(f => `  - ${f}`).join('\n') +
      '\nGeneration stopped.'
    );
  }

  for (const fileName of rootFiles) {
    const filePath = path.join(TEMPLATE_DIR, fileName);
    let content = fs.readFileSync(filePath, 'utf-8');
    content = replacePlaceholders(content, placeholders);

    const unreplaced = findUnreplacedPlaceholders(content);
    if (unreplaced.length > 0) {
      throw new Error(
        `[${context.productName}] Node template "${fileName}" contains unreplaced placeholders:\n` +
        unreplaced.map(p => `  - ${p}`).join('\n') +
        '\nGeneration stopped.'
      );
    }

    templates[fileName] = content;
  }

  if (Object.keys(templates).length === 0) {
    throw new Error(
      `[${context.productName}] Node template directory is empty: ${TEMPLATE_DIR}. ` +
      'No template files found.'
    );
  }

  return templates;
}
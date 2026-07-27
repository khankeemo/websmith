/**
 * Python Runtime Generator
 *
 * Orchestration-only: loads template files from template/python/,
 * replaces placeholders, validates, and returns the file map.
 * Contains NO business logic — all logic lives in the template.
 */

import fs from 'fs';
import path from 'path';
import { PublisherContext } from '../index';

const TEMPLATE_DIR = path.resolve(__dirname, '..', 'template', 'python');

const MANDATORY_FILES = [
  '__init__.py',
  'client.py',
  'crypto.py',
  'hardware.py',
  'cache.py',
  'license_engine.py',
  'welcome.py',
  'universal_license_center.py',
  'README.md',
];

interface PlaceholderMap {
  [key: string]: string;
}

function buildPlaceholders(context: PublisherContext): PlaceholderMap {
  return {
    '{{PRODUCT_NAME}}': context.productName || 'Product',
    '{{SDK_VERSION}}': context.kitVersion || '1.0.0',
    '{{RUNTIME_TYPE}}': context.runtime || 'python',
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
  const regex = /\{\{[A-Z_]+\}\}/g;
  const matches = content.match(regex);
  return matches || [];
}

export function getPythonTemplates(context: PublisherContext): Record<string, string> {
  const placeholders = buildPlaceholders(context);
  const templates: Record<string, string> = {};

  // Verify template directory exists
  if (!fs.existsSync(TEMPLATE_DIR)) {
    throw new Error(
      `[${context.productName}] Python template directory not found: ${TEMPLATE_DIR}. ` +
      'Generation failed — template directory is required.'
    );
  }

  const stat = fs.statSync(TEMPLATE_DIR);
  if (!stat.isDirectory()) {
    throw new Error(
      `[${context.productName}] Python template path is not a directory: ${TEMPLATE_DIR}.`
    );
  }

  // Read all template files
  const entries = fs.readdirSync(TEMPLATE_DIR);
  const fileNames = entries.filter(
    e => e.endsWith('.py') || e.endsWith('.md')
  );

  // Validate mandatory files exist
  const missingFiles: string[] = [];
  for (const mandatoryFile of MANDATORY_FILES) {
    if (!fileNames.includes(mandatoryFile)) {
      missingFiles.push(mandatoryFile);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `[${context.productName}] Python template validation failed — missing mandatory files:\n` +
      missingFiles.map(f => `  - ${f}`).join('\n') +
      '\nGeneration stopped.'
    );
  }

  // Read and process each template file
  for (const fileName of fileNames) {
    const filePath = path.join(TEMPLATE_DIR, fileName);
    let content = fs.readFileSync(filePath, 'utf-8');

    content = replacePlaceholders(content, placeholders);

    // Check for unreplaced placeholders
    const unreplaced = findUnreplacedPlaceholders(content);
    if (unreplaced.length > 0) {
      throw new Error(
        `[${context.productName}] Python template "${fileName}" contains unreplaced placeholders:\n` +
        unreplaced.map(p => `  - ${p}`).join('\n') +
        '\nGeneration stopped.'
      );
    }

    templates[fileName] = content;
  }

  if (Object.keys(templates).length === 0) {
    throw new Error(
      `[${context.productName}] Python template directory is empty: ${TEMPLATE_DIR}. ` +
      'No template files found.'
    );
  }

  return templates;
}

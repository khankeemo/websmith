#!/usr/bin/env node
/**
 * Generate ZEM MAC OS Python SDK
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

const TMPL_DIR = path.resolve(import.meta.dirname, '../app/internal/publisher/runtimes');

// Read the template file and strip TypeScript + import
let tsCode = fs.readFileSync(path.join(TMPL_DIR, 'python.ts'), 'utf-8');

// Remove the import line
tsCode = tsCode.replace(/^import .*$/m, '');
// Remove all TypeScript type annotations (simplified approach)
tsCode = tsCode.replace(/: Record<string, string>/g, '');
tsCode = tsCode.replace(/: PublisherContext/g, '');
// Fix export
tsCode = tsCode.replace('export function', 'function');

// Extract just the function body creation logic by wrapping in a getter
const fn = new Function('context', `
  "use strict";
  const __init__ = "${context.productName}";
  const __version__ = "${context.kitVersion}";
  const __runtime__ = "${context.runtime}";
  ${tsCode}
  return getPythonTemplates(context);
`);

try {
  const templates = fn(context);
  const outDir = process.argv[2] || 'D:/ZEMmacOS/SDKToolkit_prod_zemmacos_new';
  for (const [filename, content] of Object.entries(templates)) {
    const fp = path.join(outDir, filename);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, content, 'utf-8');
    console.log(`  ✓ ${filename}`);
  }
  console.log(`\nSDK generated at: ${outDir}`);
} catch (e) {
  console.error('Generation failed:', e.message);
  console.error('The TypeScript stripping may need adjustment.');
  process.exit(1);
}

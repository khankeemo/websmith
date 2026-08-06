import fs from 'fs';
import path from 'path';
import type { PublisherContext } from '../index';

const TEMPLATE_DIR = path.resolve(process.cwd(), 'app', 'internal', 'publisher', 'template', 'typescript');

const MANDATORY_FILES = [
  'client.ts',
  'cache.ts',
  'crypto.ts',
  'hardware.ts',
  'index.ts',
  'license_engine.ts',
  'universal_license_center.ts',
  'universal_email_dialog.ts',
  'package.json',
  'tsconfig.json',
  'manifest.json',
  'README.md',
];

const RUNTIME_ONLY_EXTENSIONS = ['.ts', '.json', '.md'];

interface PlaceholderMap {
  [key: string]: string;
}

function buildPlaceholders(context: PublisherContext): PlaceholderMap {
  const apiUrl = process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  const product = context.product || {} as any;
  const safeName = context.productName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const pkgName = `@websmith/${safeName}-sdk`;
  const companyName = product.company_name || context.productName;
  const supportEmail = context.supportEmail || product.support_email || '';
  const offlineDays = product.offline_days ?? 0;
  const trialDays = context.trialDays ?? product.trial_days ?? 7;
  const maxDevices = context.maxDevices ?? (product.hardware_binding ? 1 : 999);
  const primaryColor = product.primary_color || '#6366f1';

  return {
    '{{PRODUCT_NAME}}': context.productName || 'Product',
    '{{PRODUCT_ID}}': context.productId || '',
    '{{API_URL}}': apiUrl,
    '{{SDK_VERSION}}': context.kitVersion || '1.0.0',
    '{{RUNTIME_TYPE}}': context.runtime || 'typescript',
    '{{COMPANY_NAME}}': companyName,
    '{{SUPPORT_EMAIL}}': supportEmail,
    '{{SALES_EMAIL}}': '',
    '{{WEBSITE_URL}}': '',
    '{{PRIMARY_COLOR}}': primaryColor,
    '{{TRIAL_DAYS}}': String(trialDays),
    '{{MAX_DEVICES}}': String(maxDevices),
    '{{SENDER_NAME}}': '',
    '{{PACKAGE_NAME}}': pkgName,
    '{{PRODUCT_DESCRIPTION}}': `${context.productName} SDK — license management client for ${context.runtime}`,
    '{{YEAR}}': String(new Date().getFullYear()),
    '{{GENERATED_AT}}': context.generatedAt || new Date().toISOString(),
    '{{OFFLINE_DAYS}}': String(offlineDays),
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

export function getTypeScriptTemplates(context: PublisherContext): Record<string, string> {
  const placeholders = buildPlaceholders(context);
  const templates: Record<string, string> = {};

  if (!fs.existsSync(TEMPLATE_DIR)) {
    throw new Error(
      `[${context.productName}] TypeScript template directory not found: ${TEMPLATE_DIR}. ` +
      'Generation failed — template directory is required.'
    );
  }

  const stat = fs.statSync(TEMPLATE_DIR);
  if (!stat.isDirectory()) {
    throw new Error(
      `[${context.productName}] TypeScript template path is not a directory: ${TEMPLATE_DIR}.`
    );
  }

  const allFiles = getAllTemplateFiles(TEMPLATE_DIR);
  const rootFiles = allFiles.filter(f => isRootFile(f));
  const fileNames = rootFiles.filter(
    f => f.endsWith('.ts') || f.endsWith('.json') || f.endsWith('.md')
  );

  const missingFiles: string[] = [];
  for (const mandatoryFile of MANDATORY_FILES) {
    if (!rootFiles.includes(mandatoryFile)) {
      missingFiles.push(mandatoryFile);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `[${context.productName}] TypeScript template validation failed — missing mandatory files:\n` +
      missingFiles.map(f => `  - ${f}`).join('\n') +
      '\nGeneration stopped.'
    );
  }

  for (const fileName of fileNames) {
    const filePath = path.join(TEMPLATE_DIR, fileName);
    let content = fs.readFileSync(filePath, 'utf-8');

    content = replacePlaceholders(content, placeholders);

    const unreplaced = findUnreplacedPlaceholders(content);
    if (unreplaced.length > 0) {
      throw new Error(
        `[${context.productName}] TypeScript template "${fileName}" contains unreplaced placeholders:\n` +
        unreplaced.map(p => `  - ${p}`).join('\n') +
        '\nGeneration stopped.'
      );
    }

    templates[fileName] = content;
  }

  if (Object.keys(templates).length === 0) {
    throw new Error(
      `[${context.productName}] TypeScript template directory is empty: ${TEMPLATE_DIR}. ` +
      'No template files found.'
    );
  }

  return templates;
}

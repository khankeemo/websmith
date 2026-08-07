/**
 * Python Runtime Generator
 *
 * Orchestration-only: loads template files from template/python/,
 * replaces placeholders, validates, and returns the file map.
 * Contains NO business logic — all logic lives in the template.
 */

import fs from 'fs';
import path from 'path';
import type { PublisherContext } from '../index';

const TEMPLATE_DIR = path.resolve(process.cwd(), 'app', 'internal', 'publisher', 'template', 'python');

const MANDATORY_FILES = [
  '__init__.py',
  'client.py',
  'crypto.py',
  'hardware.py',
  'cache.py',
  'license_engine.py',
  'live_log.py',
  'event_bus.py',
  'workflow_progress.py',
  'dialog_manager.py',
  'ui_styles.py',
  'config_manager.py',
  'session.py',
  'permissions.py',
  'feature_flags.py',
  'offline_mode.py',
  'idempotency.py',
  'timeout_rules.py',
  'communication_queue.py',
  'notification_center.py',
  'error_catalog.py',
  'security.py',
  'migration.py',
  'health_check.py',
  'metrics.py',
  'version_compat.py',
  'support_workflow.py',
  'rollback.py',
  'welcome.py',
  'universal_license_center.py',
  'universal_success_dialog.py',
  'universal_restart_dialog.py',
  'activation.py',
  'renewal.py',
  'reactivation.py',
  'trial.py',
  'communication.py',
  'notifications.py',
  'support.py',
  'sales.py',
  'config.py',
  'manifest.json',
  'Integrations.md',
];

const RUNTIME_ONLY_EXTENSIONS = ['.py', '.md'];

const SUBDIR_MANDATORY = [
  'assets' + path.sep + 'badge.svg',
  'assets' + path.sep + 'logo.svg',
  'config' + path.sep + 'api-config.json',
];

interface PlaceholderMap {
  [key: string]: string;
}

function buildPlaceholders(context: PublisherContext): PlaceholderMap {
  const apiUrl = process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  const appUrl = process.env.WEBSMITH_APP_URL || apiUrl;
  const product = context.product || {} as any;
  return {
    '{{PRODUCT_NAME}}': context.productName || 'Product',
    '{{PRODUCT_ID}}': context.productId || '',
    '{{API_URL}}': apiUrl,
    '{{APP_URL}}': appUrl,
    '{{SDK_VERSION}}': context.kitVersion || '1.0.0',
    '{{RUNTIME_TYPE}}': context.runtime || 'python',
    '{{COMPANY_NAME}}': product.company_name || '',
    '{{SUPPORT_EMAIL}}': context.supportEmail || product.support_email || '',
    '{{SALES_EMAIL}}': '',
    '{{WEBSITE_URL}}': '',
    '{{PRIMARY_COLOR}}': product.primary_color || '',
    '{{TRIAL_DAYS}}': String(context.trialDays ?? product.trial_days ?? ''),
    '{{MAX_DEVICES}}': String(context.maxDevices ?? ''),
    '{{SENDER_NAME}}': '',
    '{{GENERATED_AT}}': context.generatedAt || new Date().toISOString(),
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

function isDocumentationFile(fileName: string): boolean {
  return fileName.split(path.sep).includes('docs');
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

  // Read all template files recursively
  const allFiles = getAllTemplateFiles(TEMPLATE_DIR);
  const rootFiles = allFiles.filter(f => isRootFile(f));
  const fileNames = rootFiles.filter(
    f => f.endsWith('.py') || f.endsWith('.md') || f === 'manifest.json'
  );

  // Validate mandatory root files exist
  const missingFiles: string[] = [];
  for (const mandatoryFile of MANDATORY_FILES) {
    if (!rootFiles.includes(mandatoryFile)) {
      missingFiles.push(mandatoryFile);
    }
  }

  // Validate mandatory subdirectory files exist
  const missingSubdir: string[] = [];
  for (const subdirFile of SUBDIR_MANDATORY) {
    if (!allFiles.includes(subdirFile)) {
      missingSubdir.push(subdirFile);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `[${context.productName}] Python template validation failed — missing mandatory files:\n` +
      missingFiles.map(f => `  - ${f}`).join('\n') +
      '\nGeneration stopped.'
    );
  }

  if (missingSubdir.length > 0) {
    throw new Error(
      `[${context.productName}] Python template validation failed — missing mandatory assets/config:\n` +
      missingSubdir.map(f => `  - ${f}`).join('\n') +
      '\nGeneration stopped.'
    );
  }

  // Read and process each runtime template file
  for (const fileName of fileNames) {
    const filePath = path.join(TEMPLATE_DIR, fileName);
    let content = fs.readFileSync(filePath, 'utf-8');

    if (!isDocumentationFile(fileName)) {
      content = replacePlaceholders(content, placeholders);
    }

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

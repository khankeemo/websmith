/**
 * C++ Runtime Generator
 *
 * Orchestration-only: loads template files from template/cpp/,
 * replaces placeholders, validates, and returns the file map.
 * Contains NO business logic — all logic lives in the template.
 */

import fs from 'fs';
import path from 'path';
import type { PublisherContext } from '../index';

const TEMPLATE_DIR = path.resolve(process.cwd(), 'app', 'internal', 'publisher', 'template', 'cpp');

const MANDATORY_FILES = [
  'client.hpp',
  'CMakeLists.txt',
  'README.md',
  'manifest.json',
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
  'api_version',
  'runtime',
  'generated_at',
  'product_id',
  'product_name',
  'cmake_project',
  'api_url',
  'support_email',
];

function buildPlaceholders(context: PublisherContext): PlaceholderMap {
  const productName = context.productName;
  const cmakeProject = productName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return {
    '${kit_version}': context.kitVersion,
    '${api_version}': 'v1',
    '${runtime}': context.runtime || 'cpp',
    '${generated_at}': context.generatedAt || new Date().toISOString(),
    '${product_id}': context.productId,
    '${product_name}': context.productName,
    '${cmake_project}': cmakeProject,
    '${api_url}': process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || '',
    '${support_email}': context.supportEmail || 'support@websmithdigital.com',
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

export function getCppTemplates(context: PublisherContext): Record<string, string> {
  const placeholders = buildPlaceholders(context);
  const templates: Record<string, string> = {};

  if (!fs.existsSync(TEMPLATE_DIR)) {
    throw new Error(
      `[${context.productName}] C++ template directory not found: ${TEMPLATE_DIR}. ` +
      'Generation failed — template directory is required.'
    );
  }

  const stat = fs.statSync(TEMPLATE_DIR);
  if (!stat.isDirectory()) {
    throw new Error(
      `[${context.productName}] C++ template path is not a directory: ${TEMPLATE_DIR}.`
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
      `[${context.productName}] C++ template validation failed — missing mandatory files:\n` +
      missingFiles.map(f => `  - ${f}`).join('\n') +
      '\nGeneration stopped.'
    );
  }

  if (missingSubdir.length > 0) {
    throw new Error(
      `[${context.productName}] C++ template validation failed — missing mandatory assets/config:\n` +
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
        `[${context.productName}] C++ template "${fileName}" contains unreplaced placeholders:\n` +
        unreplaced.map(p => `  - ${p}`).join('\n') +
        '\nGeneration stopped.'
      );
    }

    templates[fileName] = content;
  }

  if (Object.keys(templates).length === 0) {
    throw new Error(
      `[${context.productName}] C++ template directory is empty: ${TEMPLATE_DIR}. ` +
      'No template files found.'
    );
  }

  return templates;
}
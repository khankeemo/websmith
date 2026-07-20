/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/internal/publisher/manifest-builder.ts
 * Purpose: Generates manifest.json for the package
 * Author: Websmith
 *
 * RESPONSIBILITY:
 * - Build manifest from PublisherContext and ApiConfig
 * - Write manifest.json to package directory
 *
 * MANIFEST SOURCE OF TRUTH:
 * - Specification documented in docs/system-map/MANIFEST_SPEC.md
 * - This file implements that specification
 *
 * CONTRACT:
 * - Manifest contains only fields required by downstream consumers
 * - RuntimeBuilder uses 'runtime' field
 * - Partner applications may use for version checking
 *
 * DESIGN DECISIONS (2026-06-27):
 * - V1 manifest is minimal - only required fields
 * - Future fields will be added when consumers require them
 * - Manifest interface defined locally for clarity
 * ---------------------------------------------------------
 */

import fs from 'fs/promises';
import path from 'path';
import { PublisherContext } from './index';
import { ApiConfig } from './config-builder';

// Manifest interface defined locally
export interface Manifest {
  kit_version: string;
  api_version: string;
  runtime: string;
  generated_at: string;
  product_id: string;
  product_name: string;
}

export interface ManifestBuildOptions {
  context: PublisherContext;
  apiConfig: ApiConfig;
  packageDir: string;
}

export class ManifestBuilder {
  /**
   * Generate manifest.json and write to package directory
   */
  async build(options: ManifestBuildOptions): Promise<Manifest> {
    const { context, apiConfig, packageDir } = options;

    const manifest: Manifest = {
      kit_version: context.kitVersion,
      api_version: apiConfig.api.version,
      runtime: context.runtime,
      generated_at: context.generatedAt,
      product_id: context.productId,
      product_name: context.product.name
    };

    // Write manifest to package directory
    const manifestPath = path.join(packageDir, 'manifest.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    return manifest;
  }
}
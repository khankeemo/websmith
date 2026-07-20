/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/internal/publisher/zip-builder.ts
 * Purpose: Creates ZIP package from package directory
 * Author: Websmith
 *
 * RESPONSIBILITY:
 * - Create ZIP archive from package directory
 * - Generate SHA-256 checksum
 * - Return zipPath and checksum to Publisher
 *
 * DESIGN DECISIONS:
 * - SHA-256 for checksum (Node.js built-in, standard)
 * - ZIP stored in /tmp/{productName}/ (Vercel serverless compatible)
 * - Files cleaned up after download or on expiration
 * - archiver used for ZIP creation (verified in package.json)
 * - Product-based temp directories for isolation
 * - Compression level 1 for speed (Vercel Hobby 10s limit)
 * ---------------------------------------------------------
 */

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { createWriteStream } from 'fs';

// ✅ FIX: Archiver v8 exports named exports
// The Archiver class is the correct export to use
import { ZipArchive } from 'archiver';

export interface ZipBuildOptions {
  sourcePath: string;
  productId: string;
  packageId: string;
  productName: string;
}

export interface ZipBuildResult {
  zipPath: string;
  checksum: string;
  packageId: string;
}

export class ZipBuilder {
  constructor() {
    // No hardcoded tempRoot - will be set dynamically via build method
  }

  /**
   * Get product-specific temp directory
   * Structure: /tmp/{productName}/
   */
  private getTempRoot(productName: string): string {
    const cleanName = productName.replace(/[^a-zA-Z0-9]/g, '');
    const safeName = cleanName || 'unknown';
    return path.resolve('/tmp', safeName);
  }

  async create(options: ZipBuildOptions): Promise<ZipBuildResult> {
    const { sourcePath, productId, packageId, productName } = options;

    await this.verifySource(sourcePath);

    const tempRoot = this.getTempRoot(productName);
    await fs.mkdir(tempRoot, { recursive: true });

    const displayName = productName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9_\-]/g, '');
    const zipFilename = `WSD_SDKToolkit_${displayName}.zip`;
    const zipPath = path.join(tempRoot, zipFilename);

    await this.createZip(sourcePath, zipPath, productName, productId);

    const checksum = await this.generateChecksum(zipPath);

    return {
      zipPath,
      checksum,
      packageId
    };
  }

  private async verifySource(sourcePath: string): Promise<void> {
    try {
      const stat = await fs.stat(sourcePath);
      if (!stat.isDirectory()) {
        throw new Error(`Source path is not a directory: ${sourcePath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Source directory not found: ${sourcePath}`);
      }
      throw error;
    }
  }

  private createZip(sourcePath: string, zipPath: string, productName?: string, productId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);

      // ✅ OPTIMIZED: Use level 1 for speed (Vercel Hobby 10s limit)
      // level 9 = slow (~3-5s) → causes 504 timeout
      // level 1 = fast (~1s) → stays under 10s limit
      const archive = new ZipArchive({
        zlib: { level: 1 }
      });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      const displayName = (productName || 'Toolkit').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9_\-]/g, '') || 'Toolkit';
      const dirName = `WSD_SDKToolkit_${displayName}`;
      archive.directory(sourcePath, dirName);
      archive.finalize();
    });
  }

  private async generateChecksum(zipPath: string): Promise<string> {
    const fileBuffer = await fs.readFile(zipPath);
    const hash = createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  async cleanup(zipPath: string): Promise<void> {
    try {
      const resolvedPath = path.resolve(zipPath);
      const tempRoot = path.dirname(resolvedPath);
      const resolvedRoot = path.resolve(tempRoot);
      if (resolvedPath.startsWith(resolvedRoot)) {
        await fs.unlink(resolvedPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
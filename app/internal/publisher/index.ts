/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/internal/publisher/index.ts
 * Purpose: Main Publisher entry point - orchestrates package generation
 * Author: Websmith
 * 
 * RESPONSIBILITY:
 * - Orchestrate complete package generation workflow
 * - OWN stage lifecycle with checkpoints
 * - TRUE skip completed stages (do NOT re-execute)
 * - Persist stage artifacts to database for resume
 * - Restore artifacts on timeout recovery
 * - Measure and persist stage durations
 * - Handle retry decisions
 * - Save stage-specific errors
 * - Only cleanup on successful completion
 * - Mark job as completed/failed via queue helpers
 * ---------------------------------------------------------
 */

import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getDb } from '@/lib/backend-db';
import { logRequest } from '@/lib/public-api/audit';
import { 
  beginStage, 
  completeStage, 
  saveStageError,
  updateJobStatus,
  completeJob,  // ✅ ADDED
  failJob,      // ✅ ADDED
} from '@/lib/public-api/queue';
import { ProductValidator, ValidationResult } from './validator';
import { ConfigBuilder } from './config-builder';
import { RuntimeSelector } from './runtime-selector';
import { RuntimeBuilder } from './runtime-builder';
import { ManifestBuilder } from './manifest-builder';
import { ZipBuilder } from './zip-builder';
import { SDKValidator } from './sdk-validator';

// ============================================================
// TYPES
// ============================================================

export interface ProductData {
  id: string;
  name: string;
  description?: string;
  version?: string;
  company_name?: string;
  primary_color?: string;
  support_email?: string;
  support_url?: string;
  logo_url?: string;
  trial_enabled: boolean;
  trial_days: number;
  trial_message?: string;
  hardware_binding: boolean;
  offline_days: number;
  renewal_reminder_days: number;
}

export interface PlanData {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  max_devices: number;
  is_trial_plan: boolean;
  features?: string[];
  display_order: number;
}

export interface CountryData {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

export interface PublisherContext {
  productId: string;
  product: ProductData;
  productName: string;
  plans: PlanData[];
  apiKey: string;
  apiSecret?: string;
  runtime: string;
  kitVersion: string;
  generatedAt: string;
  jobId?: string;
  maxDevices?: number;
  trialDays?: number;
  supportEmail?: string;
  offlineGraceDays?: number;
  cacheDays?: number;
  trialMessage?: string;
  emailVerification?: boolean;
  allowConversion?: boolean;
}

export interface PublishResult {
  zipPath: string;
  checksum: string;
  packageId: string;
  expiresIn: number;
  runtime: string;
  version: string;
  generatedAt: string;
  size?: number;
  productName?: string;
  filename?: string;
}

export interface PublishConfig {
  productId: string;
  apiKey: string;
  apiSecret?: string;
  runtime?: string;
  platforms?: string[];
  maxDevices?: number;
  trialDays?: number;
  supportEmail?: string;
  offlineGraceDays?: number;
  cacheDays?: number;
  trialMessage?: string;
  emailVerification?: boolean;
  allowConversion?: boolean;
  
  // Checkpoint/Resume fields
  jobId?: string;
  checkpoints?: Record<string, number>;
  stageArtifacts?: Record<string, any>;
  retryCount?: number;
  maxRetries?: number;
}

// ============================================================
// STAGE DEFINITIONS
// ============================================================

const STAGES = ['validate', 'config', 'runtime', 'manifest', 'zip', 'validate-sdk'] as const;
type StageName = typeof STAGES[number];

// ============================================================
// STAGE RUNNER HELPER
// ============================================================

interface StageRunnerContext {
  jobId?: string;
  checkpoints: Record<string, number>;
  stageArtifacts: Record<string, any>;
  stageState: Record<string, any>;
  productName: string;
}

/**
 * Generic stage runner - handles checkpoint/resume logic for any stage
 * ✅ Persists artifacts to database for true resume support
 */
async function runStage<T>(
  stageName: StageName,
  context: StageRunnerContext,
  builder: () => Promise<T>,
  artifactExtractor?: (result: T) => Record<string, any>,
  onComplete?: (result: T) => Promise<void>
): Promise<T | null> {
  const { jobId, checkpoints, stageArtifacts, stageState, productName } = context;

  // Special case: runtime output directory is ephemeral (/tmp) and may not persist
  if (stageName === 'runtime' && checkpoints[stageName]) {
    const artifact = stageArtifacts[stageName];
    if (artifact?.packagePath) {
      try {
        await fs.access(artifact.packagePath);
      } catch {
        console.warn(`⚠️ Runtime output directory (${artifact.packagePath}) not found - will re-run`);
        delete checkpoints[stageName];
        // Manifest wrote into the runtime directory - must re-run too
        delete checkpoints['manifest'];
      }
    }
  }

  // ✅ TRUE skip - do NOT execute if already completed
  if (checkpoints[stageName]) {
    console.log(`⏭️ Stage "${stageName}" already completed - skipping`);
    
    // ✅ Restore from persisted artifacts (not from RAM!)
    const artifact = stageArtifacts[stageName];
    if (artifact) {
      console.log(`📦 Restoring artifacts for "${stageName}" from database`);
      
      // ✅ Different stages store different artifact structures
      let restoredResult: T | null = null;
      
      if (stageName === 'validate') {
        // For validate, we need the full validation result
        // Check if we have the full result stored
        if (artifact.validationResult) {
          restoredResult = artifact.validationResult as T;
        } else {
          // Fallback: try to reconstruct
          restoredResult = artifact as T;
        }
      } else if (stageName === 'config') {
        // ✅ Store and restore the full config object
        if (artifact.config) {
          restoredResult = artifact.config as T;
        } else {
          restoredResult = artifact as T;
        }
      } else if (stageName === 'runtime') {
        // ✅ For runtime, return the packagePath
        if (artifact.packagePath) {
          restoredResult = artifact.packagePath as T;
        } else {
          restoredResult = artifact as T;
        }
      } else if (stageName === 'manifest') {
        restoredResult = true as T;
      } else if (stageName === 'zip') {
        // ✅ For zip, reconstruct the full zipResult
        if (artifact.zipPath) {
          restoredResult = {
            zipPath: artifact.zipPath,
            checksum: artifact.checksum,
            packageId: artifact.packageId,
          } as T;
        } else {
          restoredResult = artifact as T;
        }
      } else if (stageName === 'validate-sdk') {
        restoredResult = true as T;
      } else {
        restoredResult = artifact as T;
      }
      
      // Store in stageState for subsequent stages
      stageState[stageName] = restoredResult;
      return restoredResult;
    }
    
    // Fallback - try to get from stageState (in-memory, may be lost on timeout)
    const saved = stageState[stageName];
    if (saved !== undefined) {
      return saved as T;
    }
    
    console.warn(`⚠️ No artifacts found for "${stageName}" despite checkpoint`);
    return null;
  }

  // Stage not completed - execute it
  console.log(`⏳ Running stage: ${stageName}`);

  try {
    if (jobId) await beginStage(jobId, stageName);
    const stageStart = Date.now();

    // Execute the builder
    const result = await builder();

    // Store result in stage state for potential resume
    stageState[stageName] = result;

    // ✅ Extract and persist artifacts for resume
    let artifacts = {};
    if (artifactExtractor) {
      artifacts = artifactExtractor(result);
    } else {
      // Default: store the result itself
      artifacts = { result };
    }

    // ✅ Update stageArtifacts for persistence
    const updatedArtifacts = {
      ...stageArtifacts,
      [stageName]: artifacts,
    };
    context.stageArtifacts = updatedArtifacts;

    // Persist artifacts to database
    if (jobId) {
      await updateJobStatus(jobId, {
        stage_artifacts: updatedArtifacts,
      });
    }

    // Complete the stage with checkpoint
    if (jobId) {
      const duration = Date.now() - stageStart;
      const updatedCheckpoints = {
        ...checkpoints,
        [stageName]: Date.now(),
      };
      context.checkpoints = updatedCheckpoints;
      await completeStage(jobId, stageName, updatedCheckpoints, duration);
    }

    // Optional post-completion handler
    if (onComplete) {
      await onComplete(result);
    }

    console.log(`✅ Stage "${stageName}" completed successfully`);
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Stage "${stageName}" failed:`, errorMessage);
    
    // Save stage error
    if (jobId) {
      await saveStageError(jobId, stageName, errorMessage);
    }
    
    throw error;
  }
}

// ============================================================
// PUBLISHER CLASS
// ============================================================

export class Publisher {
  private validator: ProductValidator;
  private configBuilder: ConfigBuilder;
  private runtimeSelector: RuntimeSelector;
  private runtimeBuilder: RuntimeBuilder;
  private manifestBuilder: ManifestBuilder;
  private zipBuilder: ZipBuilder;
  private sdkValidator: SDKValidator;

  private readonly KIT_VERSION: string;
  private readonly PACKAGE_EXPIRY: number;
  private tempRoot: string = '';

  constructor() {
    this.validator = new ProductValidator();
    this.configBuilder = new ConfigBuilder();
    this.runtimeSelector = new RuntimeSelector();
    this.runtimeBuilder = new RuntimeBuilder();
    this.manifestBuilder = new ManifestBuilder();
    this.zipBuilder = new ZipBuilder();
    this.sdkValidator = new SDKValidator();

    this.KIT_VERSION = this.getKitVersion();
    this.PACKAGE_EXPIRY = this.getPackageExpiry();
  }

  /**
   * Static method for runtime validation without instance creation
   */
  static getSupportedRuntimes(): string[] {
    return ['python', 'node', 'php', 'java', 'dotnet', 'go', 'rust', 'cpp', 'c', 'javascript', 'typescript', 'bun', 'deno'];
  }

  /**
   * Instance method for backward compatibility
   */
  getSupportedRuntimes(): string[] {
    return Publisher.getSupportedRuntimes();
  }

  /**
   * Get kit version from environment or package.json
   */
  private getKitVersion(): string {
    if (process.env.WEBSMITH_CONTROLKIT_VERSION) {
      return process.env.WEBSMITH_CONTROLKIT_VERSION;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../../../package.json');
      return pkg.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Get package expiry from environment or default
   */
  private getPackageExpiry(): number {
    const env = process.env.WEBSMITH_PACKAGE_EXPIRY;
    if (env) {
      const parsed = parseInt(env, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 3600; // 1 hour default
  }

  /**
   * Get product-specific temp directory
   */
  private getTempRoot(productName: string): string {
    const cleanName = productName.replace(/[^a-zA-Z0-9]/g, '');
    const safeName = cleanName || 'unknown';
    return path.resolve('/tmp', safeName);
  }

  /**
   * Get the next incomplete stage
   */
  private getNextStage(checkpoints: Record<string, number>): StageName | null {
    for (const stage of STAGES) {
      if (!checkpoints[stage]) {
        return stage;
      }
    }
    return null;
  }

  /**
   * Restore product data from database when validation is skipped
   * ✅ FIXED: Uses product_id instead of id (verified database schema)
   */
  private async restoreProductData(productId: string, db: any): Promise<{ product: ProductData; plans: PlanData[] }> {
    const productResult = await db.query(
      `SELECT * FROM products WHERE product_id = $1 AND is_active = true`,
      [productId]
    );
    
    if (productResult.rows.length === 0) {
      throw new Error(`Product ${productId} not found`);
    }
    
    const product = productResult.rows[0];
    
    const plansResult = await db.query(
      `SELECT * FROM plans WHERE product_id = $1 AND is_active = true ORDER BY display_order ASC`,
      [productId]
    );
    
    return { product, plans: plansResult.rows };
  }

  // ============================================================
  // MAIN PUBLISH METHOD (WITH TRUE CHECKPOINT/RESUME)
  // ============================================================

  /**
   * Main publish method - orchestrates complete package generation
   * with true checkpoint/resume support including artifact persistence
   */
  async publishProduct(config: PublishConfig): Promise<PublishResult> {
    const startTime = Date.now();
    const runtime = config.runtime || 'python';
    const db = await getDb();

    // Fetch countries for SDK generation
    let countries: CountryData[] = [];
    try {
      function codeToFlag(code: string): string {
        return String.fromCodePoint(...code.split('').map(c => 0x1F1E6 + c.codePointAt(0)! - 65));
      }
      const countryResult = await db.query(
        'SELECT code, name, dial, min_digits, max_digits FROM countries WHERE is_active = TRUE ORDER BY display_order ASC, name ASC'
      );
      countries = countryResult.rows.map((r: any) => ({ ...r, flag: codeToFlag(r.code) }));
    } catch (err) {
      console.warn('[publisher] Could not fetch countries:', err);
    }

    // Extract checkpoint fields
    const jobId = config.jobId;
    let checkpoints = config.checkpoints || {};
    let stageArtifacts = config.stageArtifacts || {};
    const retryCount = config.retryCount || 0;
    const maxRetries = config.maxRetries || 3;

    // Track current stage explicitly for error handling
    let currentStage: StageName | null = null;

    // Stage state - persists results for the current execution
    // ✅ Note: This is in-memory and will be lost on timeout
    // ✅ We rely on stageArtifacts for true resume
    const stageState: Record<string, any> = {};

    // Track validation result for error context
    let validationResult: ValidationResult | null = null;
    let productName: string | undefined;
    let zipResult: any = null;

    // Determine if we should resume or start fresh
    const nextStage = this.getNextStage(checkpoints);
    const isResume = nextStage !== null && Object.keys(checkpoints).length > 0;

    if (isResume) {
      console.log(`🔄 Resuming from stage: ${nextStage}`);
      console.log(`📦 Restoring artifacts from database:`, Object.keys(stageArtifacts));
    }

    try {
      // ============================================================
      // STAGE CONTEXT
      // ============================================================
      
      const stageContext: StageRunnerContext = {
        jobId,
        checkpoints,
        stageArtifacts,
        stageState,
        productName: productName || config.productId,
      };

      // ============================================================
      // 1. VALIDATE PRODUCT AND API KEY
      // ============================================================
      
      currentStage = 'validate';
      
      validationResult = await runStage<ValidationResult>(
        'validate',
        stageContext,
        async () => {
          const result = await this.validator.validate(
            config.productId,
            config.apiKey,
            db
          );
          
          if (!result.valid) {
            throw new Error(result.errors.join('; '));
          }
          
          return result;
        },
        (result) => {
          // ✅ Extract artifacts for validation - NO duplicate productId
          return {
            productId: config.productId,
            productName: result.productName || result.product?.name,
            validationResult: result, // ✅ Store full result for restore
          };
        },
        async (result) => {
          // Store validation result for later use
          validationResult = result;
          productName = result.productName || result.product?.name;
        }
      );

      // If validation was skipped, restore product data from DB
      if (checkpoints.validate && !validationResult) {
        console.log(`📊 Restoring product data from database...`);
        const restored = await this.restoreProductData(config.productId, db);
        validationResult = {
          valid: true,
          product: restored.product,
          plans: restored.plans,
          productName: restored.product.name,
          errors: [],
          errorCode: undefined,
        };
        productName = restored.product.name;
      }

      productName = productName || validationResult?.product?.name || config.productId;
      stageContext.productName = productName;

      // Update checkpoints and artifacts from stage context
      checkpoints = stageContext.checkpoints;
      stageArtifacts = stageContext.stageArtifacts;

      // ============================================================
      // 2. BUILD SHARED CONTEXT
      // ============================================================
      
      if (!validationResult) {
        throw new Error('Validation result is required');
      }

      const context: PublisherContext = {
        productId: config.productId,
        product: validationResult.product,
        productName: productName,
        plans: validationResult.plans,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret || '',
        runtime: runtime,
        kitVersion: this.KIT_VERSION,
        generatedAt: new Date().toISOString(),
        jobId,
        maxDevices: config.maxDevices,
        trialDays: config.trialDays,
        supportEmail: config.supportEmail,
        offlineGraceDays: config.offlineGraceDays,
        cacheDays: config.cacheDays,
        trialMessage: config.trialMessage,
        emailVerification: config.emailVerification,
        allowConversion: config.allowConversion,
      };

      console.log(`📦 Publishing SDK for: ${context.productName} (${runtime})`);

      // Create temp directory
      this.tempRoot = this.getTempRoot(context.productName);
      await fs.mkdir(this.tempRoot, { recursive: true });

      // ============================================================
      // 3. BUILD RICH CONFIGURATION
      // ============================================================
      
      currentStage = 'config';
      
      const apiConfig = await runStage(
        'config',
        stageContext,
        async () => {
          return await this.configBuilder.build(context);
        },
        (result) => {
          // ✅ Store full config object for resume
          return {
            config: result,          // ✅ Full config object
            configPath: this.tempRoot,
            runtime: runtime,
          };
        }
      );
      
      // Update checkpoints and artifacts from stage context
      checkpoints = stageContext.checkpoints;
      stageArtifacts = stageContext.stageArtifacts;

      if (!apiConfig) {
        throw new Error('Config build failed');
      }

      // ============================================================
      // 4. SELECT RUNTIME
      // ============================================================
      
      const runtimeInfo = await this.runtimeSelector.select(runtime);

      // ============================================================
      // 5. BUILD PACKAGE
      // ============================================================
      
      currentStage = 'runtime';
      
      const packagePath = await runStage(
        'runtime',
        stageContext,
        async () => {
          return await this.runtimeBuilder.build({
            context,
            apiConfig,
            runtime: runtimeInfo
          });
        },
        (result) => {
          // ✅ Store packagePath and metadata for resume
          return {
            packagePath: result,
            runtimeDir: path.dirname(result),
            runtime: runtime,
            productId: config.productId,
          };
        }
      );
      
      // Update checkpoints and artifacts from stage context
      checkpoints = stageContext.checkpoints;
      stageArtifacts = stageContext.stageArtifacts;

      if (!packagePath) {
        throw new Error('Runtime build failed');
      }

      // ============================================================
      // 6. GENERATE MANIFEST
      // ============================================================
      
      currentStage = 'manifest';
      
      await runStage(
        'manifest',
        stageContext,
        async () => {
          await this.manifestBuilder.build({
            context,
            apiConfig,
            packageDir: packagePath
          });
          return true;
        },
        () => {
          // ✅ Store manifest path for resume
          return {
            manifestPath: path.join(packagePath, 'manifest.json'),
            packagePath: packagePath,
          };
        }
      );
      
      // Update checkpoints and artifacts from stage context
      checkpoints = stageContext.checkpoints;
      stageArtifacts = stageContext.stageArtifacts;

      // ============================================================
      // 7. CREATE ZIP
      // ============================================================
      
      currentStage = 'zip';
      
      zipResult = await runStage(
        'zip',
        stageContext,
        async () => {
          return await this.zipBuilder.create({
            sourcePath: packagePath,
            productId: config.productId,
            packageId: this.generatePackageId(),
            productName: context.productName
          });
        },
        (result) => {
          // ✅ Store full zipResult for resume
          return {
            zipPath: result.zipPath,
            checksum: result.checksum,
            packageId: result.packageId,
            productName: context.productName,
          };
        }
      );
      
      // Update checkpoints and artifacts from stage context
      checkpoints = stageContext.checkpoints;
      stageArtifacts = stageContext.stageArtifacts;

      if (!zipResult) {
        throw new Error('ZIP build failed');
      }

      // ============================================================
      // 8. VALIDATE GENERATED SDK (validate-sdk stage)
      // ============================================================
      
      currentStage = 'validate-sdk';

      const validation = await runStage(
        'validate-sdk',
        stageContext,
        async () => {
          return await this.sdkValidator.validate(packagePath, runtime);
        },
        (result) => {
          return {
            validationResult: result,
            packagePath: packagePath,
            runtime: runtime,
          };
        }
      );

      checkpoints = stageContext.checkpoints;
      stageArtifacts = stageContext.stageArtifacts;

      if (validation && !validation.valid) {
        const errorSummary = validation.errors.slice(0, 5).join('; ');
        const warningSummary = validation.warnings.length > 0
          ? ` (${validation.warnings.length} warnings)`
          : '';
        throw new Error(
          `SDK validation failed: ${validation.errors.length} error(s), ${validation.warnings.length} warnings(s). ` +
          `Errors: ${errorSummary}${warningSummary}`
        );
      }

      if (validation && validation.warnings.length > 0) {
        console.warn(`⚠️ SDK validation warnings (${validation.warnings.length}):`);
        for (const w of validation.warnings) {
          console.warn(`  ⚠️ ${w}`);
        }
      }

      // ============================================================
      // 9. GET FILE SIZE
      // ============================================================
      
      let size: number | undefined;
      try {
        const stat = await fs.stat(zipResult.zipPath);
        size = stat.size;
      } catch {
        // Size is optional; ignore if not available
      }

      // ============================================================
      // 10. CLEANUP TEMPORARY DIRECTORY (ONLY ON SUCCESS)
      // ============================================================
      
      await this.runtimeBuilder.cleanup(packagePath);

      // ============================================================
      // 10. AUDIT LOG (SUCCESS)
      // ============================================================
      
      const duration = Date.now() - startTime;
      await logRequest({
        apiKeyId: 'publisher_internal',
        endpoint: '/internal/publisher/publish',
        method: 'POST',
        statusCode: 200,
        ipAddress: 'internal',
        userAgent: 'Publisher',
        latencyMs: duration,
        requestRedacted: {
          product_id: config.productId,
          product_name: context.productName,
          runtime: runtime,
          package_id: zipResult.packageId,
          size: size,
          action: 'publish_success'
        }
      });

      console.log(`✅ SDK published successfully for: ${context.productName}`);

      // ============================================================
      // 11. BUILD RESULT
      // ============================================================
      
      // Read ZIP file and encode as base64 for persistent storage
      let zipData: string | undefined;
      try {
        const zipBuffer = await fs.readFile(zipResult.zipPath);
        zipData = zipBuffer.toString('base64');
      } catch {
        console.warn(`⚠️ Could not read ZIP file for base64 encoding: ${zipResult.zipPath}`);
      }

      const result: PublishResult & { zipData?: string } = {
        zipPath: zipResult.zipPath,
        checksum: zipResult.checksum,
        packageId: zipResult.packageId,
        expiresIn: this.PACKAGE_EXPIRY,
        runtime: runtime,
        version: this.KIT_VERSION,
        generatedAt: context.generatedAt,
        size,
        productName: context.productName,
        ...(zipData && { zipData }),
        filename: `WSD_SDKToolkit_${context.productName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9_\-]/g, '')}.zip`,
      };

      // ============================================================
      // 12. MARK JOB AS COMPLETED (CRITICAL FIX)
      // ============================================================
      
      if (jobId) {
        await completeJob(jobId, result);
        console.log(`✅ Job ${jobId} marked as completed`);
      }

      // ============================================================
      // 13. RETURN RESULT
      // ============================================================
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown publisher error';
      const productNameForError = productName || config.productId;

      // ============================================================
      // Save stage error with explicit current stage
      // ============================================================
      if (jobId && currentStage) {
        await saveStageError(jobId, currentStage, errorMessage);
      } else if (jobId) {
        // Fallback - try to infer from checkpoints
        const nextStage = this.getNextStage(checkpoints);
        if (nextStage) {
          await saveStageError(jobId, nextStage, errorMessage);
        }
      }

      // ============================================================
      // MARK JOB AS FAILED (CRITICAL FIX)
      // ============================================================
      if (jobId) {
        await failJob(jobId, errorMessage);
        console.log(`❌ Job ${jobId} marked as failed`);
      }

      // ============================================================
      // AUDIT LOG (FAILURE)
      // ============================================================
      
      await logRequest({
        apiKeyId: 'publisher_internal',
        endpoint: '/internal/publisher/publish',
        method: 'POST',
        statusCode: 500,
        ipAddress: 'internal',
        userAgent: 'Publisher',
        latencyMs: Date.now() - startTime,
        requestRedacted: {
          product_id: config.productId,
          product_name: productNameForError,
          runtime: runtime,
          action: 'publish_failure',
          error: errorMessage,
          failed_stage: currentStage || 'unknown',
          error_code: validationResult?.errorCode || 'PUBLISH_ERROR'
        }
      });

      console.error(`❌ Publisher error for ${productNameForError}:`, errorMessage);

      // ============================================================
      // THROW WITH CONTEXT
      // ============================================================
      
      if (error instanceof Error) {
        error.message = `[${productNameForError}] ${error.message}`;
        throw error;
      }
      
      throw new Error(`[${productNameForError}] Unknown publisher error`);
    }
  }

  /**
   * Generate unique package ID using crypto.randomUUID
   */
  private generatePackageId(): string {
    return `pkg_${randomUUID()}`;
  }
}
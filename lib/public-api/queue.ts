/**
 * Websmith Universal License API Center V1
 * File: lib/public-api/queue.ts
 * Purpose: SDK Job Lifecycle Management
 * 
 * RESPONSIBILITIES:
 * - Create SDK jobs in sdk_jobs table
 * - Publish to QStash to trigger workflow
 * - Update job status
 * - Manage checkpoints and stage metrics
 * - Manage retry and resume counts
 * - Store stage errors and artifacts
 * - Provide getNextPendingJob() for async processor
 * 
 * ARCHITECTURE:
 * - Single pipeline only (Pipeline A)
 * - QStash triggers workflow via /api/upstash/workflow
 * - Publisher executes asynchronously via QStash
 * - Queue is state management + trigger
 */

import { getDb } from '@/lib/backend-db';
import { Client } from '@upstash/qstash';

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_MAX_RETRIES = 3;

// ============================================================
// QSTASH CLIENT
// ============================================================

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// ============================================================
// TYPES
// ============================================================

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobData {
  status: JobStatus;
  payload: {
    productId: string;
    apiKey: string;
    runtime: string;
    template_id?: number | null;
    trial_enabled?: boolean;
    trial_duration?: number;
    email_verification?: boolean;
    device_limit?: number;
    offline_grace_days?: number;
    support_email?: string;
    allow_conversion?: boolean;
  };
  result?: any;
  error?: string;
  created: number;
  started?: number;
  completed?: number;
  
  current_stage?: string;
  stage_started_at?: number;
  retry_count?: number;
  max_retries?: number;
  resume_count?: number;
  checkpoints?: Record<string, number>;
  stage_metrics?: Record<string, number>;
  stage_errors?: Record<string, string>;
  stage_artifacts?: Record<string, any>;
  
  logs?: Array<{ timestamp: number; message: string; level: string }>;
  download_url?: string;
  filename?: string;
  product_name?: string;
}

// ============================================================
// JOB CREATION (With Transaction) + QStash Publish
// ============================================================

/**
 * Create a new SDK generation job and publish to QStash
 * Returns jobId for status polling
 */
export async function enqueueSDKJob(payload: {
  productId: string;
  apiKey: string;
  runtime: string;
  template_id?: number | null;
  trial_enabled?: boolean;
  trial_duration?: number;
  email_verification?: boolean;
  device_limit?: number;
  offline_grace_days?: number;
  cache_days?: number;
  trial_message?: string;
  support_email?: string;
  allow_conversion?: boolean;
}): Promise<string> {
  const db = await getDb();
  const jobId = `sdk_${crypto.randomUUID()}`;

  console.log(`[SDK] ========================================`);
  console.log(`[SDK] enqueueSDKJob STARTED for job: ${jobId}`);
  console.log(`[SDK] Product: ${payload.productId}, Runtime: ${payload.runtime}`);
  console.log(`[SDK] API Key: ${payload.apiKey ? payload.apiKey.substring(0, 8) + '...' : '<missing>'}`);
  console.log(`[SDK] ========================================`);

  // Use transaction for atomic job creation
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO sdk_jobs (
        job_id, status, payload, created_at, 
        current_stage, stage_started_at,
        retry_count, max_retries, resume_count, 
        checkpoints, stage_metrics, stage_errors, stage_artifacts,
        logs, download_url, filename, product_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        jobId, 
        'pending', 
        JSON.stringify(payload), 
        new Date(),
        null,                // current_stage
        null,                // stage_started_at
        0,                   // retry_count
        DEFAULT_MAX_RETRIES, // max_retries
        0,                   // resume_count
        JSON.stringify({}),  // checkpoints
        JSON.stringify({}),  // stage_metrics
        JSON.stringify({}),  // stage_errors
        JSON.stringify({}),  // stage_artifacts
        JSON.stringify([]),  // logs
        null,                // download_url
        null,                // filename
        null,                // product_name
      ]
    );

    await client.query('COMMIT');
    
    console.log(`[SDK] ✅ Job INSERT successful for job: ${jobId}`);

    // Verify row exists
    const verify = await client.query(
      `SELECT status, created_at FROM sdk_jobs WHERE job_id = $1`,
      [jobId]
    );
    console.log(`[SDK] DB verification:`, verify.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[SDK] ❌ Failed to create job: ${jobId}`, error);
    throw error;
  } finally {
    client.release();
  }

  // ============================================================
  // QSTASH PUBLISH WITH FULL LOGGING
  // ============================================================

  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL environment variable is not set. SDK generation requires this to be configured.');
  }
  const callbackUrl = `${baseUrl}/api/upstash/workflow`;

  console.log(`[SDK] ========================================`);
  console.log(`[SDK] About to call qstash.publishJSON`);
  console.log(`[SDK] Callback URL: ${callbackUrl}`);
  console.log(`[SDK] QStash token exists: ${!!process.env.QSTASH_TOKEN}`);
  console.log(`[SDK] QStash URL exists: ${!!process.env.QSTASH_URL}`);
  console.log(`[SDK] Payload:`, {
    productId: payload.productId,
    apiKey: payload.apiKey ? `${payload.apiKey.substring(0, 8)}...` : '<missing>',
    runtime: payload.runtime,
    jobId,
  });
  console.log(`[SDK] ========================================`);

  try {
    console.log(`[SDK] Calling qstash.publishJSON...`);
    console.time(`[SDK] QStash publish time`);

    const result = await qstash.publishJSON({
      url: callbackUrl,
      body: {
        productId: payload.productId,
        apiKey: payload.apiKey,
        runtime: payload.runtime,
        jobId,
      },
      retries: 3,
    });

    console.timeEnd(`[SDK] QStash publish time`);
    console.log(`[SDK] ✅ QStash publish SUCCESS for job: ${jobId}`);
    console.log(`[SDK] QStash response:`, JSON.stringify(result, null, 2));

    if (result && typeof result === 'object') {
      console.log(`[SDK] Response keys:`, Object.keys(result));
      if ('messageId' in result) {
        console.log(`[SDK] ✅ Message ID: ${result.messageId}`);
      }
    }

    console.log(`[SDK] ✅ QStash published for job: ${jobId}`);

  } catch (error) {
    console.timeEnd(`[SDK] QStash publish time`);
    console.error(`[SDK] ❌ QStash publish FAILED for job: ${jobId}`);
    console.error(`[SDK] Error type:`, typeof error);
    console.error(`[SDK] Error message:`, error instanceof Error ? error.message : String(error));
    console.error(`[SDK] Error stack:`, error instanceof Error ? error.stack : 'No stack');
    
    // If error has additional properties, log them
    if (error && typeof error === 'object') {
      console.error(`[SDK] Error keys:`, Object.keys(error));
      console.error(`[SDK] Full error:`, JSON.stringify(error, null, 2));
    }
    
    throw error;
  }

  console.log(`[SDK] ✅ enqueueSDKJob COMPLETED for job: ${jobId}`);
  console.log(`[SDK] ========================================`);

  return jobId;
}

// ============================================================
// LOG FUNCTIONS
// ============================================================

export async function addLog(
  jobId: string, 
  message: string, 
  level: 'info' | 'success' | 'warning' | 'error' = 'info'
): Promise<void> {
  const db = await getDb();
  const currentLogs = await getLogs(jobId);
  
  const logEntry = {
    timestamp: Date.now(),
    message,
    level,
  };
  
  const updatedLogs = [...currentLogs, logEntry];
  
  await db.query(
    `UPDATE sdk_jobs SET logs = $1 WHERE job_id = $2`,
    [JSON.stringify(updatedLogs), jobId]
  );
}

export async function getLogs(jobId: string): Promise<any[]> {
  const db = await getDb();
  const result = await db.query(
    `SELECT logs FROM sdk_jobs WHERE job_id = $1`,
    [jobId]
  );
  return result.rows[0]?.logs || [];
}

// ============================================================
// JOB STATUS
// ============================================================

export async function getJobStatus(jobId: string): Promise<JobData | null> {
  const db = await getDb();
  const result = await db.query(
    `SELECT 
      job_id, status, payload, result, error, 
      EXTRACT(EPOCH FROM created_at) as created, 
      EXTRACT(EPOCH FROM started_at) as started, 
      EXTRACT(EPOCH FROM completed_at) as completed,
      current_stage,
      EXTRACT(EPOCH FROM stage_started_at) as stage_started_at,
      retry_count,
      max_retries,
      resume_count,
      checkpoints,
      stage_metrics,
      stage_errors,
      stage_artifacts,
      logs,
      download_url,
      filename,
      product_name
     FROM sdk_jobs WHERE job_id = $1`,
    [jobId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    status: row.status,
    payload: row.payload,
    result: row.result,
    error: row.error,
    created: Math.floor(Number(row.created) * 1000),
    started: row.started ? Math.floor(Number(row.started) * 1000) : undefined,
    completed: row.completed ? Math.floor(Number(row.completed) * 1000) : undefined,
    current_stage: row.current_stage || undefined,
    stage_started_at: row.stage_started_at ? Math.floor(Number(row.stage_started_at) * 1000) : undefined,
    retry_count: row.retry_count || 0,
    max_retries: row.max_retries || DEFAULT_MAX_RETRIES,
    resume_count: row.resume_count || 0,
    checkpoints: row.checkpoints || {},
    stage_metrics: row.stage_metrics || {},
    stage_errors: row.stage_errors || {},
    stage_artifacts: row.stage_artifacts || {},
    logs: row.logs || [],
    download_url: row.download_url,
    filename: row.filename,
    product_name: row.product_name,
  };
}

// ============================================================
// JOB STATUS UPDATES
// ============================================================

export async function updateJobStatus(
  jobId: string,
  updates: Partial<JobData>
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(updates.status);
  }
  if (updates.result !== undefined) {
    fields.push(`result = $${idx++}`);
    values.push(JSON.stringify(updates.result));
  }
  if (updates.error !== undefined) {
    fields.push(`error = $${idx++}`);
    values.push(updates.error);
  }
  if (updates.started !== undefined) {
    fields.push(`started_at = $${idx++}`);
    values.push(new Date(updates.started));
  }
  if (updates.completed !== undefined) {
    fields.push(`completed_at = $${idx++}`);
    values.push(new Date(updates.completed));
  }
  
  if (updates.current_stage !== undefined) {
    fields.push(`current_stage = $${idx++}`);
    values.push(updates.current_stage);
  }
  if (updates.stage_started_at !== undefined) {
    fields.push(`stage_started_at = $${idx++}`);
    values.push(new Date(updates.stage_started_at));
  }
  if (updates.retry_count !== undefined) {
    fields.push(`retry_count = $${idx++}`);
    values.push(updates.retry_count);
  }
  if (updates.max_retries !== undefined) {
    fields.push(`max_retries = $${idx++}`);
    values.push(updates.max_retries);
  }
  if (updates.resume_count !== undefined) {
    fields.push(`resume_count = $${idx++}`);
    values.push(updates.resume_count);
  }
  if (updates.checkpoints !== undefined) {
    fields.push(`checkpoints = $${idx++}`);
    values.push(JSON.stringify(updates.checkpoints));
  }
  if (updates.stage_metrics !== undefined) {
    fields.push(`stage_metrics = $${idx++}`);
    values.push(JSON.stringify(updates.stage_metrics));
  }
  if (updates.stage_errors !== undefined) {
    fields.push(`stage_errors = $${idx++}`);
    values.push(JSON.stringify(updates.stage_errors));
  }
  if (updates.stage_artifacts !== undefined) {
    fields.push(`stage_artifacts = $${idx++}`);
    values.push(JSON.stringify(updates.stage_artifacts));
  }
  
  if (updates.download_url !== undefined) {
    fields.push(`download_url = $${idx++}`);
    values.push(updates.download_url);
  }
  if (updates.filename !== undefined) {
    fields.push(`filename = $${idx++}`);
    values.push(updates.filename);
  }
  if (updates.product_name !== undefined) {
    fields.push(`product_name = $${idx++}`);
    values.push(updates.product_name);
  }

  if (fields.length === 0) return;

  values.push(jobId);
  await db.query(
    `UPDATE sdk_jobs SET ${fields.join(', ')} WHERE job_id = $${idx}`,
    values
  );
}

// ============================================================
// STAGE LIFECYCLE
// ============================================================

export async function beginStage(
  jobId: string,
  stage: string
): Promise<void> {
  await updateJobStatus(jobId, {
    current_stage: stage,
    stage_started_at: Date.now(),
  });
  await addLog(jobId, `⏳ Started stage: ${stage}`, 'info');
}

export async function completeStage(
  jobId: string,
  stage: string,
  checkpoints: Record<string, number>,
  duration: number
): Promise<void> {
  const updatedCheckpoints = {
    ...checkpoints,
    [stage]: Date.now(),
  };
  
  const db = await getDb();
  const result = await db.query(
    `SELECT stage_metrics FROM sdk_jobs WHERE job_id = $1`,
    [jobId]
  );
  
  const stageMetrics = result.rows[0]?.stage_metrics || {};
  stageMetrics[`${stage}_duration`] = duration;
  
  await updateJobStatus(jobId, {
    checkpoints: updatedCheckpoints,
    stage_metrics: stageMetrics,
  });
  
  await addLog(jobId, `✅ Completed stage: ${stage} (${(duration / 1000).toFixed(2)}s)`, 'success');
}

// ============================================================
// RETRY FUNCTIONS
// ============================================================

export async function incrementRetryCount(jobId: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE sdk_jobs SET retry_count = COALESCE(retry_count, 0) + 1 WHERE job_id = $1`,
    [jobId]
  );
}

export async function incrementResumeCount(jobId: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE sdk_jobs SET resume_count = COALESCE(resume_count, 0) + 1 WHERE job_id = $1`,
    [jobId]
  );
}

export async function saveStageError(
  jobId: string,
  stage: string,
  error: string
): Promise<void> {
  const db = await getDb();
  const result = await db.query(
    `SELECT stage_errors FROM sdk_jobs WHERE job_id = $1`,
    [jobId]
  );
  
  const stageErrors = result.rows[0]?.stage_errors || {};
  stageErrors[stage] = error;
  
  await db.query(
    `UPDATE sdk_jobs SET stage_errors = $1 WHERE job_id = $2`,
    [JSON.stringify(stageErrors), jobId]
  );
  
  await addLog(jobId, `❌ Stage "${stage}" failed: ${error}`, 'error');
}

export async function saveStageArtifacts(
  jobId: string,
  artifacts: Record<string, any>
): Promise<void> {
  await updateJobStatus(jobId, {
    stage_artifacts: artifacts,
  });
}

// ============================================================
// COMPLETE / FAIL
// ============================================================

export async function completeJob(jobId: string, result: any): Promise<void> {
  const downloadUrl = result.downloadUrl || result.download_url || null;
  const filename = result.filename || null;
  const productName = result.productName || result.product_name || null;
  
  await updateJobStatus(jobId, {
    status: 'completed',
    result,
    completed: Date.now(),
    current_stage: 'complete',
    download_url: downloadUrl,
    filename: filename,
    product_name: productName,
  });
  
  await addLog(jobId, '🎉 Job completed successfully!', 'success');
}

export async function failJob(jobId: string, error: string): Promise<void> {
  await updateJobStatus(jobId, {
    status: 'failed',
    error,
    completed: Date.now(),
  });
  await addLog(jobId, `💥 Job failed: ${error}`, 'error');
}

// ============================================================
// PENDING JOB FETCHER (For Async Processor)
// ============================================================

/**
 * Get the next pending job for processing
 * Used by the async SDK processor
 */
export async function getNextPendingJob(): Promise<{ jobId: string; data: JobData } | null> {
  const db = await getDb();
  const result = await db.query(
    `SELECT 
      job_id, status, payload, result, error, 
      EXTRACT(EPOCH FROM created_at) as created,
      current_stage,
      EXTRACT(EPOCH FROM stage_started_at) as stage_started_at,
      retry_count,
      max_retries,
      resume_count,
      checkpoints,
      stage_metrics,
      stage_errors,
      stage_artifacts,
      logs,
      download_url,
      filename,
      product_name
     FROM sdk_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    jobId: row.job_id,
    data: {
      status: row.status,
      payload: row.payload,
      result: row.result,
      error: row.error,
      created: Math.floor(Number(row.created) * 1000),
      current_stage: row.current_stage || undefined,
      stage_started_at: row.stage_started_at ? Math.floor(Number(row.stage_started_at) * 1000) : undefined,
      retry_count: row.retry_count || 0,
      max_retries: row.max_retries || DEFAULT_MAX_RETRIES,
      resume_count: row.resume_count || 0,
      checkpoints: row.checkpoints || {},
      stage_metrics: row.stage_metrics || {},
      stage_errors: row.stage_errors || {},
      stage_artifacts: row.stage_artifacts || {},
      logs: row.logs || [],
      download_url: row.download_url,
      filename: row.filename,
      product_name: row.product_name,
    }
  };
}

// ============================================================
// ZIP DATA LOOKUP (For download endpoint)
// ============================================================

export async function findJobByFilename(filename: string): Promise<{ zipData?: string; zipPath?: string; productName?: string } | null> {
  const db = await getDb();
  const searchPattern = `%${filename.replace(/%/g, '%%').replace(/_/g, '\\_')}`;
  const result = await db.query(
    `SELECT result, product_name FROM sdk_jobs 
     WHERE status = 'completed' 
       AND result->>'zipPath' LIKE $1 ESCAPE '\\'
     ORDER BY created_at DESC LIMIT 1`,
    [searchPattern]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  let parsedResult: any = {};
  try {
    parsedResult = typeof row.result === 'string' ? JSON.parse(row.result) : row.result;
  } catch {}
  return {
    zipData: parsedResult.zipData || undefined,
    zipPath: parsedResult.zipPath || undefined,
    productName: row.product_name || parsedResult.productName || undefined,
  };
}

// ============================================================
// CLEANUP
// ============================================================

export async function cleanupOldJobs(daysToKeep: number = 7): Promise<number> {
  const db = await getDb();
  const result = await db.query(
    `DELETE FROM sdk_jobs WHERE status IN ('completed', 'failed') AND created_at < NOW() - $1::interval RETURNING job_id`,
    [`${daysToKeep} days`]
  );
  return result.rowCount || 0;
}
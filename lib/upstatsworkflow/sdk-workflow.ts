/**
 * lib/upstatsworkflow/sdk-workflow.ts
 * 
 * SDK Workflow - Orchestrates SDK generation via QStash
 * 
 * RESPONSIBILITIES:
 * - Receive workflow payload
 * - Validate payload
 * - Load job from sdk_jobs
 * - Call Publisher.publishProduct()
 * - Return workflow result
 * 
 * ARCHITECTURE:
 * - Single pipeline only (Pipeline A)
 * - Publisher owns SDK generation
 * - Queue owns job state
 * - Workflow only orchestrates
 */

import { Publisher } from '@/app/internal/publisher';
import { getJobStatus } from '@/lib/public-api/queue';

export interface WorkflowPayload {
  jobId: string;
  productId: string;
  apiKey: string;
  runtime: string;
}

export interface WorkflowResult {
  success: boolean;
  jobId: string;
  status: 'completed' | 'failed';
  error?: string;
  result?: any;
}

export async function executeSDKWorkflow(
  payload: WorkflowPayload | null
): Promise<WorkflowResult> {
  console.log(`[Workflow] 001 starting SDK workflow`);

  console.time(`[Workflow] Total`);

  try {
    console.log(`[Workflow] 002 payload:`, payload);

    // 1. Validate payload
    if (!payload) {
      console.error('[Workflow] 003 ❌ Payload is null or undefined');
      throw new Error('Payload is required');
    }

    console.log(`[Workflow] 004 payload type:`, typeof payload);
    console.log(`[Workflow] 005 payload keys:`, Object.keys(payload));

    const { jobId, productId, apiKey, runtime } = payload;

    if (!jobId) {
      console.error('[Workflow] 006 ❌ Missing jobId in payload:', payload);
      throw new Error('Missing jobId');
    }
    if (!productId) {
      console.error('[Workflow] 007 ❌ Missing productId in payload:', payload);
      throw new Error('Missing productId');
    }
    if (!apiKey) {
      console.error('[Workflow] 008 ❌ Missing apiKey in payload:', payload);
      throw new Error('Missing apiKey');
    }
    if (!runtime) {
      console.error('[Workflow] 009 ❌ Missing runtime in payload:', payload);
      throw new Error('Missing runtime');
    }

    console.log(`[Workflow] 010 payload validated for job: ${jobId}`);
    console.log(`[Workflow] 011 productId: ${productId}, runtime: ${runtime}`);

    // 2. Load job from database
    console.log(`[Workflow] 012 BEFORE getJobStatus() for job: ${jobId}`);

    const job = await getJobStatus(jobId);

    console.log(`[Workflow] 013 AFTER getJobStatus() for job: ${jobId}`);
    console.log(`[Workflow] 014 job:`, job);

    if (!job) {
      console.error(`[Workflow] 015 ❌ Job ${jobId} not found in database`);
      throw new Error(`Job ${jobId} not found`);
    }

    console.log(`[Workflow] 016 job status: ${job.status}`);

    // 3. Check if already completed/failed
    if (job.status === 'completed') {
      console.log(`[Workflow] 017 ✅ Job ${jobId} already completed`);
      console.timeEnd(`[Workflow] Total`);
      return { success: true, jobId, status: 'completed', result: job.result };
    }
    if (job.status === 'failed') {
      console.log(`[Workflow] 018 ❌ Job ${jobId} already failed`);
      console.timeEnd(`[Workflow] Total`);
      return { success: false, jobId, status: 'failed', error: job.error };
    }

    // 4. Execute Publisher
    console.log(`[Workflow] 019 BEFORE new Publisher() for job: ${jobId}`);

    const publisher = new Publisher();

    console.log(`[Workflow] 020 AFTER new Publisher() - instance created`);

    console.log(`[Workflow] 021 BEFORE publishProduct() for job: ${jobId}`);
    console.log(`[Workflow] 022 config:`, {
      productId,
      apiKeyExists: !!apiKey,
      runtime,
      jobId,
      checkpoints: job.checkpoints || {},
      stageArtifacts: job.stage_artifacts || {},
      retryCount: job.retry_count || 0,
      maxRetries: job.max_retries || 3,
    });

    // Extract SDK settings overrides from job payload
    const jobPayload = (job.payload || {}) as Record<string, unknown>;
    const maxDevices = jobPayload.device_limit as number | undefined;
    const trialDays = jobPayload.trial_duration as number | undefined;
    const supportEmail = jobPayload.support_email as string | undefined;
    const offlineGraceDays = jobPayload.offline_grace_days as number | undefined;
    const cacheDays = jobPayload.cache_days as number | undefined;
    const trialMessage = jobPayload.trial_message as string | undefined;
    const emailVerification = jobPayload.email_verification as boolean | undefined;
    const allowConversion = jobPayload.allow_conversion as boolean | undefined;

    const result = await publisher.publishProduct({
      productId,
      apiKey,
      runtime,
      jobId,
      checkpoints: job.checkpoints || {},
      stageArtifacts: job.stage_artifacts || {},
      retryCount: job.retry_count || 0,
      maxRetries: job.max_retries || 3,
      maxDevices,
      trialDays,
      supportEmail,
      offlineGraceDays,
      cacheDays,
      trialMessage,
      emailVerification,
      allowConversion,
    });

    console.log(`[Workflow] 023 AFTER publishProduct() - completed for job: ${jobId}`);
    console.log(`[Workflow] 024 Publisher return type:`, typeof result);
    console.log(`[Workflow] 025 result:`, result);

    console.timeEnd(`[Workflow] Total`);

    return {
      success: true,
      jobId,
      status: 'completed',
      result,
    };

  } catch (error) {
    console.timeEnd(`[Workflow] Total`);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack';

    console.error(`[Workflow] ❌ Workflow execution failed`);
    console.error(`[Workflow] error message:`, errorMessage);
    console.error(`[Workflow] error stack:`, errorStack);

    throw error;
  }
}
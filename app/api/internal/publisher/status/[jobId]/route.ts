/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/api/internal/publisher/status/[jobId]/route.ts
 * Purpose: Check job status for async SDK generation
 * Author: Websmith
 * 
 * RETURNS:
 * - Basic job fields: status, created, started, completed, error
 * - Download fields: download_url, filename, product_name
 * - Checkpoint fields: current_stage, retry_count, max_retries, 
 *   resume_count, checkpoints, stage_metrics, stage_errors
 * ---------------------------------------------------------
 */

import { NextRequest, NextResponse } from "next/server";
import { getJobStatus } from "@/lib/public-api/queue";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Job ID required" },
        { status: 400 }
      );
    }
    
    const job = await getJobStatus(jobId);
    
    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }
    
    // Build download URL if job is completed
    let downloadUrl: string | null = null;
    let filename: string | null = null;
    
    if (job.status === "completed" && job.result) {
      const zipPath = job.result.zipPath;
      if (zipPath) {
        filename = zipPath.split("/").pop() || null;
        if (filename) {
          downloadUrl = `/api/internal/publisher/download/${encodeURIComponent(filename)}`;
        }
      }
    }
    
    // ============================================================
    // Return ALL fields including checkpoint data
    // ============================================================
    return NextResponse.json({
      success: true,
      job_id: jobId,
      status: job.status,
      created: job.created,
      started: job.started,
      completed: job.completed,
      
      // Error field (only if present)
      ...(job.error && { error: job.error }),
      
      // Download fields (only if complete)
      ...(downloadUrl && { download_url: downloadUrl, filename }),
      ...(job.result?.productName && { product_name: job.result.productName }),
      
      // Checkpoint/Resume fields
      current_stage: job.current_stage || null,
      retry_count: job.retry_count || 0,
      max_retries: job.max_retries || 3,
      resume_count: job.resume_count || 0,
      checkpoints: job.checkpoints || {},
      stage_metrics: job.stage_metrics || {},
      stage_errors: job.stage_errors || {},
    });
    
  } catch (error) {
    console.error("❌ Status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get status" },
      { status: 500 }
    );
  }
}
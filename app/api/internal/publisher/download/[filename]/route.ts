/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/api/internal/publisher/download/[filename]/route.ts
 * Purpose: Download a generated package ZIP file
 * Author: Websmith
 *
 * RESPONSIBILITY:
 * - Serve generated ZIP files from database or temporary storage
 * - Validate filename for security
 * - Audit download requests
 *
 * STORAGE STRATEGY:
 * 1. Primary: Database (base64 zipData in job result) — works on Vercel
 * 2. Fallback: Filesystem temp/ directory — works locally
 * ---------------------------------------------------------
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { constants, createReadStream } from 'fs';
import { Readable } from 'stream';
import path from 'path';
import { logRequest } from '@/lib/public-api/audit';
import { findJobByFilename } from '@/lib/public-api/queue';

// Temporary storage directory (local dev fallback)
const TEMP_ROOT = path.resolve(process.cwd(), 'temp');


// 1 hour in seconds (files expire after 1 hour)
const FILE_EXPIRY_SECONDS = 3600;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const startTime = Date.now();

  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const referer = req.headers.get('referer') || 'unknown';

  try {
    // ============================================================
    // 1. VALIDATE FILENAME (Security)
    // ============================================================
    
    const isLegacyFormat = /^[A-Za-z0-9._-]+\.zip$/.test(filename);
    if (!isLegacyFormat) {
      await logRequest({
        apiKeyId: 'download',
        endpoint: '/internal/publisher/download',
        method: 'GET',
        statusCode: 400,
        latencyMs: Date.now() - startTime,
        ipAddress,
        userAgent,
        requestRedacted: { 
          filename, 
          action: 'invalid_filename_format',
        }
      });
      
      return NextResponse.json(
        { success: false, error: 'Invalid filename format.', error_code: 'INVALID_FILENAME_FORMAT' },
        { status: 400 }
      );
    }

    // ============================================================
    // 2. TRY DATABASE (Primary for Vercel production)
    // ============================================================
    
    const jobInfo = await findJobByFilename(filename);
    let zipBuffer: Buffer | null = null;

    if (jobInfo?.zipData) {
      zipBuffer = Buffer.from(jobInfo.zipData, 'base64');
    }

    // ============================================================
    // 3. FALLBACK TO FILESYSTEM (Local dev)
    // ============================================================
    
    let fileStats: Awaited<ReturnType<typeof fs.stat>> | null = null;
    let filePath: string | null = null;

    if (!zipBuffer) {
      filePath = path.join(TEMP_ROOT, filename);
      
      try {
        fileStats = await fs.stat(filePath);
        await fs.access(filePath, constants.R_OK);
      } catch {
        // Not found on filesystem either
      }
    }

    // ============================================================
    // 4. NOT FOUND
    // ============================================================
    
    if (!zipBuffer && !fileStats) {
      await logRequest({
        apiKeyId: 'download',
        endpoint: '/internal/publisher/download',
        method: 'GET',
        statusCode: 404,
        latencyMs: Date.now() - startTime,
        ipAddress,
        userAgent,
        requestRedacted: { filename, action: 'file_not_found' }
      });
      
      return NextResponse.json(
        { success: false, error: 'File not found. The SDK package may have expired.', error_code: 'FILE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // ============================================================
    // 5. AUDIT LOG
    // ============================================================
    
    await logRequest({
      apiKeyId: 'download',
      endpoint: '/internal/publisher/download',
      method: 'GET',
      statusCode: 200,
      latencyMs: Date.now() - startTime,
      ipAddress,
      userAgent,
      requestRedacted: {
        filename,
        product_name: jobInfo?.productName || 'Unknown',
        file_size: zipBuffer ? zipBuffer.length : (fileStats?.size || 0),
        source: zipBuffer ? 'database' : 'filesystem',
        action: 'download_success'
      }
    });

    // ============================================================
    // 6. STREAM RESPONSE
    // ============================================================

    if (zipBuffer) {
      // Serve from database (Vercel production)
      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': zipBuffer.length.toString(),
          'Cache-Control': 'private, max-age=0, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        }
      });
    }

    // Serve from filesystem (local dev)
    if (filePath && fileStats) {
      const nodeStream = createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

      return new NextResponse(webStream, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileStats.size.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=0, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        }
      });
    }

    throw new Error('Unreachable: both zipBuffer and filePath are null');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await logRequest({
      apiKeyId: 'download',
      endpoint: '/internal/publisher/download',
      method: 'GET',
      statusCode: 500,
      latencyMs: Date.now() - startTime,
      ipAddress,
      userAgent,
      requestRedacted: { filename, error: errorMessage, action: 'download_failure' }
    });

    return NextResponse.json(
      { success: false, error: 'Failed to download SDK package. Please try again.', error_code: 'DOWNLOAD_FAILED' },
      { status: 500 }
    );
  }
}

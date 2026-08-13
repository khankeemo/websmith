// FILE: app/internal/backend/communications/attachments/[id]/route.ts
// PURPOSE: Internal download endpoint for conversation attachments. Serves the
//          bytes from PostgreSQL (durable) with a disk fallback for legacy
//          rows — so attachment download/preview works on serverless hosts
//          (Vercel) where runtime-written public/ files are not web-served.
// ACCESS: Internal admin only — the proxy already gates /internal/backend/*
//         via the api_center_token cookie (relied on here because the reader
//         uses plain <a>/<img>/<iframe>/fetch links that cannot set the
//         x-api-center-user-email header).

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { resolveAttachmentById } from "@/lib/communications/attachments";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ success: false, error: "Attachment not found" }, { status: 404 });
    }
    client = await (await getDb()).connect();
    const att = await resolveAttachmentById(client, id);
    if (!att || !att.content) {
      return NextResponse.json({ success: false, error: "Attachment not found" }, { status: 404 });
    }
    const ascii = att.fileName.replace(/[^\x20-\x7e]/g, "_");
    const headers = new Headers();
    headers.set("Content-Type", att.mimeType || "application/octet-stream");
    headers.set("Content-Length", String(att.content.length));
    headers.set(
      "Content-Disposition",
      `attachment; filename="${ascii.replace(/["\\]/g, "")}"; filename*=UTF-8''${encodeURIComponent(att.fileName)}`
    );
    headers.set("Cache-Control", "private, no-store");
    return new NextResponse(new Uint8Array(att.content), { status: 200, headers });
  } catch (error) {
    console.error("Attachment download error:", error);
    return NextResponse.json({ success: false, error: "Failed to load attachment" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
// FILE: app/api/media/[assetKey]/route.ts
// PURPOSE: Serves website media bytes from Neon (the single media store).
//          Cache-Control mirrors the deployed production behavior
//          (public, max-age=31536000, immutable) — safe because every upload
//          mints a NEW asset id, so the URL always changes and no browser or
//          CDN can keep serving stale bytes for a previously-immutable URL.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/backend-db";
import { getMediaAssetById } from "@/lib/media/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assetKey: string }> }
) {
  let client = null;
  try {
    const { assetKey } = await params;
    if (!assetKey) {
      return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
    }
    client = await (await getDb()).connect();
    const asset = await getMediaAssetById(client, assetKey);
    if (!asset || !asset.data) {
      return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
    }
    const ascii = asset.file_name.replace(/[^\x20-\x7e]/g, "_");
    const headers = new Headers();
    headers.set("Content-Type", asset.content_type || "application/octet-stream");
    headers.set("Content-Length", String(asset.data.length));
    headers.set(
      "Content-Disposition",
      `inline; filename="${ascii.replace(/["\\]/g, "")}"; filename*=UTF-8''${encodeURIComponent(asset.file_name)}`
    );
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new NextResponse(new Uint8Array(asset.data), { status: 200, headers });
  } catch (error) {
    console.error("Media asset load error:", error);
    return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
  } finally {
    if (client) client.release();
  }
}
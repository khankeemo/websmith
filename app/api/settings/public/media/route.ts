// FILE: app/api/settings/public/media/route.ts
// PURPOSE: Public media registry — the single source of truth for website
//          media slot records (migrated from MongoDB to Neon). GET is public
//          (Neon only, no Mongo dependency); POST uploads a slot's media via
//          the EXISTING admin auth (JWT + role check) and always mints a NEW
//          asset id, so consumers can never be served stale immutable bytes.

import { apiHandler, json, unauthorized, badRequest } from "@/lib/server/api";
import { getDb } from "@/lib/backend-db";
import { MEDIA_SLOT_INDEX, MAX_MEDIA_FILE_SIZE } from "@/lib/media";
import { getMediaAssets, upsertMediaAsset } from "@/lib/media/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let client = null;
  try {
    client = await (await getDb()).connect();
    const data = await getMediaAssets(client);
    return json({ data });
  } catch (error) {
    console.error("Media registry read error:", error);
    return json({ data: {} });
  } finally {
    if (client) client.release();
  }
}

const uploadHandler = async ({ request, user }: any) => {
  if (!user) throw unauthorized();
  if (user.role !== "admin") throw unauthorized("Insufficient permissions");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Invalid multipart form data");
  }

  const slotKey = String(form.get("slotKey") ?? "").trim();
  const slot = MEDIA_SLOT_INDEX.get(slotKey);
  if (!slot) throw badRequest("Invalid media slot key");

  const file = form.get("file");
  if (!file || typeof file === "string" || !file.size) {
    throw badRequest("A media file is required");
  }
  if (file.size > MAX_MEDIA_FILE_SIZE) {
    throw badRequest(`File exceeds the ${Math.floor(MAX_MEDIA_FILE_SIZE / 1024 / 1024)}MB limit`);
  }

  const contentType = file.type || "application/octet-stream";
  const allowedTypes = slot.accept.split(",").map((t) => t.trim());
  if (contentType !== "application/octet-stream" && !allowedTypes.includes(contentType)) {
    throw badRequest(`Unsupported file type. Supported: ${slot.accept}`);
  }

  const fileName = (file.name || "media-file").replace(/[\\/]/g, "").trim() || "media-file";
  const data = Buffer.from(await file.arrayBuffer());

  const client = await (await getDb()).connect();
  try {
    const record = await upsertMediaAsset(client, slotKey, {
      fileName,
      contentType,
      fileSize: data.length,
      data,
    });
    return json({ data: record });
  } finally {
    client.release();
  }
};

export const POST = apiHandler(uploadHandler, { auth: "required" });
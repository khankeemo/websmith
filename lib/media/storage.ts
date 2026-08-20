// Neon media persistence — the single authoritative media store.
// The media system was migrated from MongoDB to Neon: this module owns the
// media_assets table (created/ensured in lib/backend-db getDb) and every
// read/write path used by the public media API routes.

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Pool, PoolClient } from "pg";

export type MediaDb = { query: Pool["query"] };

export type MediaAssetRow = {
  id: string;
  slot_key: string;
  file_name: string;
  content_type: string;
  file_size: number;
  data?: Buffer;
  updated_at: Date;
};

export type MediaRecord = {
  url: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  updatedAt: string;
};

export function toMediaRecord(row: MediaAssetRow): MediaRecord {
  return {
    url: `/api/media/${row.id}`,
    fileName: row.file_name,
    contentType: row.content_type,
    fileSize: Number(row.file_size),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export async function getMediaAssets(db: MediaDb): Promise<Record<string, MediaRecord>> {
  const result = await db.query<MediaAssetRow>(
    `SELECT id, slot_key, file_name, content_type, file_size, updated_at
     FROM media_assets
     ORDER BY slot_key`
  );
  const map: Record<string, MediaRecord> = {};
  for (const row of result.rows) {
    map[row.slot_key] = toMediaRecord(row);
  }
  return map;
}

export async function getMediaAssetById(db: MediaDb, id: string): Promise<MediaAssetRow | null> {
  const result = await db.query<MediaAssetRow>(
    `SELECT id, slot_key, file_name, content_type, file_size, data, updated_at
     FROM media_assets
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

// Upsert a slot's media with a FRESH uuid on every upload, so the media URL
// always changes and no browser/CDN can keep serving stale bytes for a
// previously-immutable URL.
export async function upsertMediaAsset(
  db: MediaDb,
  slotKey: string,
  file: { fileName: string; contentType: string; fileSize: number; data: Buffer }
): Promise<MediaRecord> {
  const result = await db.query<MediaAssetRow>(
    `INSERT INTO media_assets (id, slot_key, file_name, content_type, file_size, data, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())
     ON CONFLICT (slot_key) DO UPDATE SET
       id = gen_random_uuid(),
       file_name = EXCLUDED.file_name,
       content_type = EXCLUDED.content_type,
       file_size = EXCLUDED.file_size,
       data = EXCLUDED.data,
       updated_at = now()
     RETURNING id, slot_key, file_name, content_type, file_size, updated_at`,
    [slotKey, file.fileName, file.contentType, file.fileSize, file.data]
  );
  return toMediaRecord(result.rows[0]);
}

// One-time preservation of the valid record migrated from the previous media
// store (slot global_collaboration_video, id 92ffc061-5cbd-4a6d-b165-e36c1a80f0ed,
// file API-Center.mp4 — byte-identical to public/videos/API-Center.mp4, verified
// against production). Idempotent: only inserts when the slot is absent, and
// only when the committed asset file is readable at runtime.
export async function seedMigratedMedia(client: PoolClient): Promise<void> {
  const PRESERVED_SLOT_KEY = "global_collaboration_video";
  const PRESERVED_ID = "92ffc061-5cbd-4a6d-b165-e36c1a80f0ed";
  const PRESERVED_FILE = "API-Center.mp4";
  const PRESERVED_CONTENT_TYPE = "video/mp4";
  const PRESERVED_UPDATED_AT = "2026-08-19T15:39:42.752Z";

  const existing = await client.query(
    `SELECT 1 FROM media_assets WHERE slot_key = $1`,
    [PRESERVED_SLOT_KEY]
  );
  if (existing.rows.length > 0) return;

  const filePath = join(process.cwd(), "public", "videos", PRESERVED_FILE);
  if (!existsSync(filePath)) return;

  const data = readFileSync(filePath);
  await client.query(
    `INSERT INTO media_assets (id, slot_key, file_name, content_type, file_size, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $7::timestamptz)
     ON CONFLICT (slot_key) DO NOTHING`,
    [PRESERVED_ID, PRESERVED_SLOT_KEY, PRESERVED_FILE, PRESERVED_CONTENT_TYPE, data.length, data, PRESERVED_UPDATED_AT]
  );
}
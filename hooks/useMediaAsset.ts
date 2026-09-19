"use client";

// Single frontend media source: fetches GET /api/settings/public/media once per
// page session, fills every slot's fallback, and re-fetches when an admin
// upload succeeds (refreshMediaAssets → MEDIA_UPDATED_EVENT). Consumers never
// hold a stale map after an upload.

import { useEffect, useState } from "react";
import {
  MEDIA_SLOT_INDEX,
  MEDIA_UPDATED_EVENT,
  MediaAsset,
  emptyMediaAsset,
} from "../lib/media";

let cache: Record<string, MediaAsset> | null = null;
let inflight: Promise<Record<string, MediaAsset>> | null = null;

async function fetchMediaMap(): Promise<Record<string, MediaAsset>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch("/api/settings/public/media", {
          cache: "no-store",
        });
        const data = res.ok ? ((await res.json()).data ?? {}) : {};
        const map: Record<string, MediaAsset> = {};
        for (const slot of MEDIA_SLOT_INDEX.values()) {
          const record = data[slot.key] || null;
          map[slot.key] = record
            ? {
                url: record.url,
                fileName: record.fileName ?? "",
                contentType: record.contentType ?? "",
                fileSize: record.fileSize ?? 0,
                updatedAt: record.updatedAt ?? "",
                managed: true,
              }
            : emptyMediaAsset(slot.key);
        }
        cache = map;
        return map;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

// Called after a successful admin upload: drops the cached map and notifies
// every mounted useMediaAsset consumer to re-fetch the fresh record.
export function refreshMediaAssets(): void {
  cache = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEDIA_UPDATED_EVENT));
  }
}

export function useMediaAsset(key: string): MediaAsset {
  const [asset, setAsset] = useState<MediaAsset>(() => emptyMediaAsset(key));

  useEffect(() => {
    if (!MEDIA_SLOT_INDEX.has(key)) {
      setAsset(emptyMediaAsset(key));
      return;
    }
    let alive = true;
    const load = () => {
      fetchMediaMap()
        .then((map) => {
          if (alive) setAsset(map[key] ?? emptyMediaAsset(key));
        })
        .catch(() => {
          if (alive) setAsset(emptyMediaAsset(key));
        });
    };
    load();
    window.addEventListener(MEDIA_UPDATED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(MEDIA_UPDATED_EVENT, load);
    };
  }, [key]);

  return asset;
}
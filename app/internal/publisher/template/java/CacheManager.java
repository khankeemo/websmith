package com.websmith.sdk;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;

public class CacheManager {
    private final Path cacheDir;
    private final Path cacheFile;
    private final Path tmpFile;
    private final Path corruptFile;
    private final long ttlMillis;
    private final Gson gson;
    private Map<String, CacheEntry> cache;

    private static class CacheEntry {
        Object value;
        long cachedAt;

        CacheEntry() {}

        CacheEntry(Object value, long cachedAt) {
            this.value = value;
            this.cachedAt = cachedAt;
        }
    }

    public CacheManager(JsonObject config) {
        JsonObject offline = config != null && config.has("offline")
            ? config.getAsJsonObject("offline") : new JsonObject();
        int ttlDays = 0;
        if (offline.has("cache_days")) {
            try { ttlDays = offline.get("cache_days").getAsInt(); } catch (Exception ignored) {}
        }
        this.ttlMillis = ttlDays * 24L * 60L * 60L * 1000L;

        String productId = "";
        if (config != null && config.has("product") && config.getAsJsonObject("product").has("id")) {
            productId = config.getAsJsonObject("product").get("id").getAsString();
        }
        String safeName = productId.replaceAll("[^a-zA-Z0-9_-]", "_");
        if (safeName.isEmpty()) safeName = "unknown";

        String home = System.getProperty("user.home", ".");
        this.cacheDir = new File(home, ".websmith/" + safeName).toPath();
        this.cacheFile = cacheDir.resolve("cache.json");
        this.tmpFile = cacheDir.resolve("cache.tmp");
        this.corruptFile = cacheDir.resolve("cache.corrupt");
        this.gson = new Gson();
        this.cache = null;
    }

    public CacheManager() {
        this(null);
    }

    private void ensureCacheDir() {
        try {
            Files.createDirectories(cacheDir);
        } catch (IOException ignored) {}
    }

    private Map<String, CacheEntry> loadCache() {
        if (cache != null) return cache;
        ensureCacheDir();
        if (!Files.exists(cacheFile)) {
            cache = new HashMap<>();
            return cache;
        }
        try {
            String content = new String(Files.readAllBytes(cacheFile));
            @SuppressWarnings("unchecked")
            Map<String, Object> raw = gson.fromJson(content, Map.class);
            cache = new HashMap<>();
            if (raw != null) {
                for (Map.Entry<String, Object> entry : raw.entrySet()) {
                    if (entry.getValue() instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> m = (Map<String, Object>) entry.getValue();
                        CacheEntry ce = new CacheEntry();
                        ce.value = m.get("value");
                        if (m.get("cachedAt") instanceof Number) {
                            ce.cachedAt = ((Number) m.get("cachedAt")).longValue();
                        }
                        cache.put(entry.getKey(), ce);
                    }
                }
            }
            return cache;
        } catch (Exception e) {
            preserveCorruptCache();
            cache = new HashMap<>();
            return cache;
        }
    }

    private void preserveCorruptCache() {
        if (Files.exists(cacheFile)) {
            try {
                Files.move(cacheFile, corruptFile, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                try { Files.delete(cacheFile); } catch (IOException ignored) {}
            }
        }
    }

    private void saveCache() {
        if (cache == null) return;
        ensureCacheDir();
        try {
            String json = gson.toJson(cache);
            Files.write(tmpFile, json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            Files.move(tmpFile, cacheFile, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            try { Files.deleteIfExists(tmpFile); } catch (IOException ignored) {}
        }
    }

    public Object get(String key) {
        Map<String, CacheEntry> c = loadCache();
        CacheEntry entry = c.get(key);
        if (entry == null) return null;
        if (isExpired(entry)) {
            c.remove(key);
            saveCache();
            return null;
        }
        return entry.value;
    }

    public void set(String key, Object value) {
        Map<String, CacheEntry> c = loadCache();
        c.put(key, new CacheEntry(value, System.currentTimeMillis()));
        saveCache();
    }

    public void remove(String key) {
        Map<String, CacheEntry> c = loadCache();
        if (c.containsKey(key)) {
            c.remove(key);
            saveCache();
        }
    }

    public void clear() {
        cache = new HashMap<>();
        saveCache();
    }

    public Path getCacheDir() {
        return cacheDir;
    }

    private boolean isExpired(CacheEntry entry) {
        return (System.currentTimeMillis() - entry.cachedAt) > ttlMillis;
    }
}

#include "cache.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#ifdef _WIN32
#include <direct.h>
#include <windows.h>
#else
#include <unistd.h>
#include <sys/stat.h>
#endif

static void ensure_dir(const char* dir) {
#ifdef _WIN32
    _mkdir(dir);
#else
    mkdir(dir, 0755);
#endif
}

static char* read_file_str(const char* path) {
    FILE* f = fopen(path, "r");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    rewind(f);
    char* content = malloc(len + 1);
    if (!content) { fclose(f); return NULL; }
    size_t read = fread(content, 1, len, f);
    content[read] = '\0';
    fclose(f);
    return content;
}

static void write_file_str(const char* path, const char* content) {
    FILE* f = fopen(path, "w");
    if (!f) return;
    fputs(content, f);
    fclose(f);
}

CacheManager* wsd_cache_new(const char* config_dir) {
    CacheManager* cache = calloc(1, sizeof(CacheManager));
    if (!cache) return NULL;
    const char* home = getenv("USERPROFILE");
    if (!home) home = getenv("HOME");
    if (!home) home = ".";
    snprintf(cache->cache_dir, sizeof(cache->cache_dir), "%s/.websmith/%s", home, config_dir ? config_dir : "unknown");
    snprintf(cache->cache_file, sizeof(cache->cache_file), "%s/cache.json", cache->cache_dir);
    snprintf(cache->tmp_file, sizeof(cache->tmp_file), "%s/cache.tmp", cache->cache_dir);
    snprintf(cache->corrupt_file, sizeof(cache->corrupt_file), "%s/cache.corrupt", cache->cache_dir);
    cache->ttl_days = 30;
    cache->data = wsd_json_map_new();
    return cache;
}

void wsd_cache_free(CacheManager* cache) {
    if (!cache) return;
    wsd_json_free(cache->data);
    free(cache);
}

static void wsd_cache_load(CacheManager* cache) {
    if (cache->loaded) return;
    ensure_dir(cache->cache_dir);
    char* content = read_file_str(cache->cache_file);
    if (!content) { cache->loaded = 1; return; }
    wsd_json_free(cache->data);
    cache->data = wsd_json_parse(content);
    if (!cache->data) cache->data = wsd_json_map_new();
    free(content);
    cache->loaded = 1;
}

static void wsd_cache_save(CacheManager* cache) {
    ensure_dir(cache->cache_dir);
    char* content = strdup("{");
    if (!content) return;
    size_t cap = 256, len = 1;
    for (int i = 0; i < cache->data->count; ++i) {
        if (i > 0) {
            size_t needed = len + 2;
            if (needed >= cap) { cap *= 2; content = realloc(content, cap); if (!content) return; }
            content[len++] = ','; content[len] = '\0';
        }
        char* ek = wsd_json_escape(cache->data->keys[i]);
        char* ev = wsd_json_escape(cache->data->values[i]);
        size_t needed = len + strlen(ek) + strlen(ev) + 8;
        if (needed >= cap) { cap = needed * 2; content = realloc(content, cap); if (!content) { free(ek); free(ev); return; } }
        len += sprintf(content + len, "\"%s\":\"%s\"", ek ? ek : "", ev ? ev : "");
        free(ek);
        free(ev);
    }
    if (len + 2 >= cap) { cap = len + 4; content = realloc(content, cap); if (!content) return; }
    content[len] = '}';
    content[len + 1] = '\0';
    write_file_str(cache->tmp_file, content);
    free(content);
    remove(cache->cache_file);
    rename(cache->tmp_file, cache->cache_file);
}

int wsd_cache_is_expired(CacheManager* cache, const char* key) {
    wsd_cache_load(cache);
    const char* entry_json = wsd_json_get(cache->data, key);
    if (!entry_json) return 1;
    JsonMap* entry = wsd_json_parse(entry_json);
    if (!entry) return 1;
    const char* cached_at = wsd_json_get(entry, "cached_at");
    int expired = 1;
    if (cached_at) {
        double ct = atof(cached_at);
        double ttl_sec = (double)cache->ttl_days * 24 * 60 * 60;
        double now = (double)time(NULL);
        expired = (now - ct) > ttl_sec;
    }
    wsd_json_free(entry);
    return expired;
}

char* wsd_cache_get(CacheManager* cache, const char* key) {
    wsd_cache_load(cache);
    const char* entry_json = wsd_json_get(cache->data, key);
    if (!entry_json) return NULL;
    if (wsd_cache_is_expired(cache, key)) {
        wsd_cache_delete(cache, key);
        return NULL;
    }
    JsonMap* entry = wsd_json_parse(entry_json);
    if (!entry) return NULL;
    const char* value = wsd_json_get(entry, "value");
    char* result = value ? strdup(value) : NULL;
    wsd_json_free(entry);
    return result;
}

void wsd_cache_set(CacheManager* cache, const char* key, const char* value) {
    wsd_cache_load(cache);
    char ts[32];
    sprintf(ts, "%ld", (long)time(NULL));
    char entry[4096];
    snprintf(entry, sizeof(entry), "{\"value\":\"%s\",\"cached_at\":\"%s\"}", value ? value : "", ts);
    wsd_json_set(cache->data, key, entry);
    wsd_cache_save(cache);
}

void wsd_cache_delete(CacheManager* cache, const char* key) {
    wsd_cache_load(cache);
    if (!cache->data) return;
    for (int i = 0; i < cache->data->count; ++i) {
        if (strcmp(cache->data->keys[i], key) == 0) {
            free(cache->data->keys[i]);
            free(cache->data->values[i]);
            for (int j = i; j < cache->data->count - 1; ++j) {
                cache->data->keys[j] = cache->data->keys[j + 1];
                cache->data->values[j] = cache->data->values[j + 1];
            }
            cache->data->count--;
            wsd_cache_save(cache);
            return;
        }
    }
}

void wsd_cache_clear(CacheManager* cache) {
    wsd_json_free(cache->data);
    cache->data = wsd_json_map_new();
    wsd_cache_save(cache);
}

int wsd_cache_is_valid(CacheManager* cache) {
    return !wsd_cache_is_expired(cache, "license_status");
}

int wsd_cache_exists(CacheManager* cache) {
    FILE* f = fopen(cache->cache_file, "r");
    if (f) { fclose(f); return 1; }
    return 0;
}

JsonMap* wsd_cache_get_license_status(CacheManager* cache) {
    char* val = wsd_cache_get(cache, "license_status");
    if (!val) return NULL;
    JsonMap* map = wsd_json_parse(val);
    free(val);
    return map;
}

void wsd_cache_set_license_status(CacheManager* cache, JsonMap* status) {
    if (!status) return;
    size_t cap = 256;
    char* json = malloc(cap);
    if (!json) return;
    json[0] = '{';
    size_t pos = 1;
    for (int i = 0; i < status->count; ++i) {
        if (i > 0) { json[pos++] = ','; if (pos >= cap - 64) { cap *= 2; json = realloc(json, cap); } }
        char* ek = wsd_json_escape(status->keys[i]);
        char* ev = wsd_json_escape(status->values[i]);
        size_t needed = pos + strlen(ek) + strlen(ev) + 6;
        if (needed >= cap) { cap = needed * 2; json = realloc(json, cap); }
        pos += sprintf(json + pos, "\"%s\":\"%s\"", ek ? ek : "", ev ? ev : "");
        free(ek); free(ev);
    }
    json[pos++] = '}';
    json[pos] = '\0';
    wsd_cache_set(cache, "license_status", json);
    free(json);
}

void wsd_cache_invalidate_license_status(CacheManager* cache) {
    wsd_cache_delete(cache, "license_status");
}

void wsd_cache_set_onboarding_complete(CacheManager* cache) {
    char ts[32];
    sprintf(ts, "%ld", (long)time(NULL));
    char entry[4096];
    snprintf(entry, sizeof(entry), "{\"value\":\"true\",\"cached_at\":\"%s\"}", ts);
    wsd_json_set(cache->data, "onboarding_complete", entry);
    wsd_cache_save(cache);
}

int wsd_cache_is_onboarding_complete(CacheManager* cache) {
    char* val = wsd_cache_get(cache, "onboarding_complete");
    if (!val) return 0;
    int result = (strcmp(val, "true") == 0);
    free(val);
    return result;
}

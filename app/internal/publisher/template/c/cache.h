#ifndef WSD_CACHE_H
#define WSD_CACHE_H

#include "crypto.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    char cache_dir[512];
    char cache_file[1024];
    char tmp_file[1024];
    char corrupt_file[1024];
    int ttl_days;
    JsonMap* data;
    int loaded;
} CacheManager;

CacheManager* wsd_cache_new(const char* config_dir);
void wsd_cache_free(CacheManager* cache);
char* wsd_cache_get(CacheManager* cache, const char* key);
void wsd_cache_set(CacheManager* cache, const char* key, const char* value);
void wsd_cache_delete(CacheManager* cache, const char* key);
void wsd_cache_clear(CacheManager* cache);
int wsd_cache_is_expired(CacheManager* cache, const char* key);
int wsd_cache_is_valid(CacheManager* cache);
int wsd_cache_exists(CacheManager* cache);
JsonMap* wsd_cache_get_license_status(CacheManager* cache);
void wsd_cache_set_license_status(CacheManager* cache, JsonMap* status);
void wsd_cache_invalidate_license_status(CacheManager* cache);
void wsd_cache_set_onboarding_complete(CacheManager* cache);
int wsd_cache_is_onboarding_complete(CacheManager* cache);

#ifdef __cplusplus
}
#endif

#endif

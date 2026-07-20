#ifndef WSD_WELCOME_H
#define WSD_WELCOME_H

#include "crypto.h"
#include "client.h"
#include "hardware.h"
#include "cache.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    int skipped;
    int onboarding_complete;
    char name[128];
    char email[128];
    char hardware_id[128];
} WelcomeResult;

int wsd_is_onboarding_complete(CacheManager* cache);
WelcomeResult wsd_welcome_show(ApiClient* client, const char* product_name, CacheManager* cache);

#ifdef __cplusplus
}
#endif

#endif

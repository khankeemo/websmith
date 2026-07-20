#ifndef WSD_ACTIVATION_H
#define WSD_ACTIVATION_H

#include "crypto.h"
#include "client.h"
#include "hardware.h"
#include "cache.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    int activated;
    int cancelled;
    char license_key[256];
} ActivationResult;

ActivationResult wsd_activation_show(ApiClient* client, const char* product_name);

#ifdef __cplusplus
}
#endif

#endif

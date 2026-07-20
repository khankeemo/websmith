#ifndef WSD_LICENSE_ENGINE_H
#define WSD_LICENSE_ENGINE_H

#include "crypto.h"
#include "client.h"
#include "hardware.h"
#include "cache.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    int valid;
    char status[32];
    char expires_at[64];
    int days_remaining;
    char plan[64];
    char hardware_id[128];
    char message[256];
    char license_key[256];
    int trial_active;
} LicenseStatus;

typedef struct {
    ApiClient* client;
    HardwareDetector* hardware;
    CacheManager* cache;
    LicenseStatus status;
    int has_status;
    char license_key[256];
    JsonMap* config;
} LicenseEngine;

LicenseEngine* wsd_engine_new(const char* config_path);
void wsd_engine_free(LicenseEngine* engine);

LicenseStatus* wsd_initialize(LicenseEngine* engine);
const char* wsd_get_hardware_id_c(LicenseEngine* engine);
LicenseStatus* wsd_get_status(LicenseEngine* engine);
const char* wsd_get_license_key_c(LicenseEngine* engine);
int wsd_has_license_key(LicenseEngine* engine);

JsonMap* wsd_validate(LicenseEngine* engine, const char* license_key);
JsonMap* wsd_activate(LicenseEngine* engine, const char* license_key);
JsonMap* wsd_start_trial_c(LicenseEngine* engine, const char* email, const char* customer_name);
JsonMap* wsd_convert_trial_c(LicenseEngine* engine, const char* plan, const char* customer_name, const char* customer_email);
JsonMap* wsd_renew(LicenseEngine* engine, int extra_days);
JsonMap* wsd_deactivate(LicenseEngine* engine, const char* license_key);
JsonMap* wsd_replace_hardware(LicenseEngine* engine);
JsonMap* wsd_bind_device_c(LicenseEngine* engine, const char* license_key, const char* device_name);

#ifdef __cplusplus
}
#endif

#endif

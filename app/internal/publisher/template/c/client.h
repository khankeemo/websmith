#ifndef WSD_CLIENT_H
#define WSD_CLIENT_H

#include "crypto.h"
#include "hardware.h"
#include "cache.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    char base_url[512];
    char api_version[16];
    char api_key[256];
    char api_secret[256];
    double timeout_sec;
    int retry_count;
    char product_id[128];
    HardwareDetector* hardware;
    CacheManager* cache;
} ApiClient;

ApiClient* wsd_client_new(const char* config_path);
void wsd_client_free(ApiClient* client);

JsonMap* wsd_validate_license(ApiClient* client, const char* license_key, const char* hardware_id);
JsonMap* wsd_activate_license(ApiClient* client, const char* license_key, const char* hardware_id);
JsonMap* wsd_deactivate_license(ApiClient* client, const char* license_key, const char* hardware_id);
JsonMap* wsd_renew_license(ApiClient* client, const char* license_key, int extra_days);
JsonMap* wsd_start_trial(ApiClient* client, const char* email, const char* customer_name, JsonMap* customer_data);
JsonMap* wsd_get_trial_status(ApiClient* client, const char* hardware_id);
JsonMap* wsd_convert_trial(ApiClient* client, const char* hardware_id, const char* plan, const char* customer_name, const char* customer_email);
JsonMap* wsd_bind_device(ApiClient* client, const char* license_key, const char* hardware_id, const char* device_name);
JsonMap* wsd_replace_device(ApiClient* client, const char* license_key, const char* new_hardware_id, const char* old_hardware_id);
JsonMap* wsd_get_products(ApiClient* client);
JsonMap* wsd_update_customer(ApiClient* client, const char* name, const char* email, const char* phone, const char* hardware_id);

#ifdef __cplusplus
}
#endif

#endif

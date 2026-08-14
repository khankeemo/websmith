#ifndef WEBSMITH_CLIENT_H
#define WEBSMITH_CLIENT_H

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdint.h>
#include <time.h>
#include <curl/curl.h>
#include <cjson/cJSON.h>
#include <openssl/hmac.h>
#include <openssl/sha.h>

#ifdef _WIN32
#include <windows.h>
#include <iphlpapi.h>
#include <nb30.h>
#pragma comment(lib, "iphlpapi.lib")
#else
#include <unistd.h>
#include <ifaddrs.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <netdb.h>
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define WEBSMITH_MAX_RETRIES 3
#define WEBSMITH_BACKOFF_MS 1000
#define WEBSMITH_CACHE_MAX_ENTRIES 64
#define WEBSMITH_MAX_PATH 4096

typedef struct {
    int success;
    char* error;
    char* data;
} websmith_result_t;

typedef struct {
    char* api_key;
    char* api_secret;
    char* api_url;
} websmith_client_t;

typedef struct {
    char* fingerprint;
    char* cpu_id;
    char* motherboard_id;
    char* mac_address;
    char* os;
} websmith_hardware_t;

typedef struct {
    char key[256];
    char value[4096];
    time_t expires_at;
} websmith_cache_entry_t;

typedef struct {
    websmith_cache_entry_t entries[WEBSMITH_CACHE_MAX_ENTRIES];
    int count;
    char cache_dir[WEBSMITH_MAX_PATH];
} websmith_cache_t;

typedef struct {
    websmith_client_t* client;
    websmith_cache_t* cache;
    char license_key[512];
    char license_data[8192];
    char status[64];
    char inactive_reason[256];
    time_t expires_at;
    int is_valid;
} websmith_license_engine_t;

websmith_result_t websmith_result_ok(const char* data);
websmith_result_t websmith_result_err(const char* error);
void websmith_result_free(websmith_result_t* result);

websmith_client_t* websmith_client_new(const char* api_key, const char* api_secret);
void websmith_client_free(websmith_client_t* client);

websmith_hardware_t* websmith_hardware_new(void);
char* websmith_hardware_fingerprint(websmith_hardware_t* hw);
void websmith_hardware_free(websmith_hardware_t* hw);

char* websmith_hmac_sign(const char* api_secret, const char* timestamp, const char* nonce, const char* body);
int websmith_hex_encode(const unsigned char* in, size_t len, char* out, size_t out_len);

websmith_result_t websmith_api_request(websmith_client_t* client, const char* endpoint, const char* json_body);

websmith_result_t websmith_validate_license(websmith_client_t* client, const char* license_key, const char* device_id);
websmith_result_t websmith_activate_license(websmith_client_t* client, const char* license_key, const char* device_id);
websmith_result_t websmith_deactivate_license(websmith_client_t* client, const char* license_key, const char* device_id);
websmith_result_t websmith_renew_license(websmith_client_t* client, const char* license_key);
websmith_result_t websmith_start_trial(websmith_client_t* client, const char* email, const char* customer_name, const char* plan);
websmith_result_t websmith_check_trial(websmith_client_t* client, const char* hardware_id);
websmith_result_t websmith_get_trial_status(websmith_client_t* client, const char* hardware_id);
websmith_result_t websmith_get_products(websmith_client_t* client);
websmith_result_t websmith_convert_trial(websmith_client_t* client, const char* hardware_id, const char* plan, const char* name, const char* email);
websmith_result_t websmith_bind_device(websmith_client_t* client, const char* license_key, const char* device_id, const char* device_name);

websmith_cache_t* websmith_cache_new(const char* cache_dir);
websmith_result_t websmith_cache_get(websmith_cache_t* cache, const char* key);
int websmith_cache_set(websmith_cache_t* cache, const char* key, const char* value, time_t ttl);
void websmith_cache_clear(websmith_cache_t* cache);
void websmith_cache_free(websmith_cache_t* cache);

websmith_license_engine_t* websmith_engine_new(websmith_client_t* client, websmith_cache_t* cache);
int websmith_engine_load_license(websmith_license_engine_t* engine, const char* license_key);
int websmith_engine_validate(websmith_license_engine_t* engine);
int websmith_engine_activate(websmith_license_engine_t* engine, const char* device_id);
int websmith_engine_deactivate(websmith_license_engine_t* engine);
int websmith_engine_renew(websmith_license_engine_t* engine);
int websmith_engine_start_trial(websmith_license_engine_t* engine, const char* email, const char* customer_name, const char* plan);
int websmith_engine_check_trial(websmith_license_engine_t* engine, const char* hardware_id);
int websmith_engine_convert_trial(websmith_license_engine_t* engine, const char* hardware_id, const char* plan, const char* name, const char* email);
int websmith_engine_bind_device(websmith_license_engine_t* engine, const char* license_key, const char* device_id, const char* device_name);
websmith_result_t websmith_engine_view_hardware_status(websmith_license_engine_t* engine);
int websmith_engine_is_valid(websmith_license_engine_t* engine);
void websmith_engine_free(websmith_license_engine_t* engine);


#ifdef __cplusplus
}
#endif

#endif

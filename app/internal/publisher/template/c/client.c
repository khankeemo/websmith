#include "client.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <curl/curl.h>
#include <time.h>
#ifdef _WIN32
#include <windows.h>
#else
#include <unistd.h>
#endif

static size_t write_cb(void* contents, size_t size, size_t nmemb, void* userp) {
    size_t total = size * nmemb;
    char** out = (char**)userp;
    size_t old = *out ? strlen(*out) : 0;
    *out = realloc(*out, old + total + 1);
    if (!*out) return 0;
    memcpy(*out + old, contents, total);
    (*out)[old + total] = '\0';
    return total;
}

static char* parse_config_value(JsonMap* map, const char* key1, const char* key2) {
    const char* v = wsd_json_get(map, key1);
    if (v) return strdup(v);
    v = wsd_json_get(map, key2);
    if (v) return strdup(v);
    return strdup("");
}

static void sleep_ms(int ms) {
#ifdef _WIN32
    Sleep(ms);
#else
    struct timespec ts;
    ts.tv_sec = ms / 1000;
    ts.tv_nsec = (ms % 1000) * 1000000;
    nanosleep(&ts, NULL);
#endif
}

ApiClient* wsd_client_new(const char* config_path) {
    ApiClient* client = calloc(1, sizeof(ApiClient));
    if (!client) return NULL;
    client->timeout_sec = 30.0;
    client->retry_count = 3;
    strcpy(client->api_version, "v1");

    char* content = NULL;
    FILE* f = fopen(config_path, "r");
    if (f) {
        fseek(f, 0, SEEK_END);
        long len = ftell(f);
        rewind(f);
        content = malloc(len + 1);
        if (content) {
            fread(content, 1, len, f);
            content[len] = '\0';
        }
        fclose(f);
    }
    if (content) {
        JsonMap* root = wsd_json_parse(content);
        if (root) {
            const char* api_json = wsd_json_get(root, "api");
            if (!api_json) {
                JsonMap* api_map = wsd_json_parse(api_json);
                if (api_map) {
                    const char* url = wsd_json_get(api_map, "url");
                    if (url) strncpy(client->base_url, url, sizeof(client->base_url) - 1);
                    const char* ver = wsd_json_get(api_map, "version");
                    if (ver) strncpy(client->api_version, ver, sizeof(client->api_version) - 1);
                    const char* pk = wsd_json_get(api_map, "public_key");
                    if (pk) strncpy(client->api_key, pk, sizeof(client->api_key) - 1);
                    const char* sec = wsd_json_get(api_map, "secret");
                    if (sec) strncpy(client->api_secret, sec, sizeof(client->api_secret) - 1);
                    wsd_json_free(api_map);
                }
            }
            const char* prod_json = wsd_json_get(root, "product");
            if (prod_json) {
                JsonMap* prod = wsd_json_parse(prod_json);
                if (prod) {
                    const char* id = wsd_json_get(prod, "id");
                    if (id) strncpy(client->product_id, id, sizeof(client->product_id) - 1);
                    wsd_json_free(prod);
                }
            }
        }
        wsd_json_free(root);
        free(content);
    }
    client->hardware = wsd_hardware_new();
    curl_global_init(CURL_GLOBAL_ALL);
    return client;
}

void wsd_client_free(ApiClient* client) {
    if (!client) return;
    wsd_hardware_free(client->hardware);
    wsd_cache_free(client->cache);
    curl_global_cleanup();
    free(client);
}

static JsonMap* wsd_request(ApiClient* client, const char* endpoint, JsonMap* payload, int retries) {
    char url[1024];
    snprintf(url, sizeof(url), "%s/api/%s/%s", client->base_url, client->api_version, endpoint);
    int max_retries = (retries >= 0) ? retries : client->retry_count;

    if (client->product_id[0] && !wsd_json_get(payload, "product_id")) {
        wsd_json_set(payload, "product_id", client->product_id);
    }

    for (int attempt = 0; attempt <= max_retries; ++attempt) {
        char* keys[64];
        char* values[64];
        int count = 0;
        for (int i = 0; i < payload->count && count < 64; ++i) {
            keys[count] = payload->keys[i];
            values[count] = payload->values[i];
            count++;
        }
        char* body = wsd_json_stringify((const char* const*)keys, (const char* const*)values, count);

        char* timestamp = wsd_generate_timestamp();
        char* nonce = wsd_generate_nonce();
        char path[256];
        snprintf(path, sizeof(path), "/api/%s/%s", client->api_version, endpoint);
        char* signature = wsd_sign_request(body, client->api_secret, timestamp, nonce, "POST", path, "");

        CURL* curl = curl_easy_init();
        char* response = NULL;
        long status_code = 0;

        if (curl) {
            struct curl_slist* headers = NULL;
            char hbuf[1024];
            snprintf(hbuf, sizeof(hbuf), "x-api-key: %s", client->api_key);
            headers = curl_slist_append(headers, hbuf);
            snprintf(hbuf, sizeof(hbuf), "x-timestamp: %s", timestamp);
            headers = curl_slist_append(headers, hbuf);
            snprintf(hbuf, sizeof(hbuf), "x-nonce: %s", nonce);
            headers = curl_slist_append(headers, hbuf);
            snprintf(hbuf, sizeof(hbuf), "x-signature: %s", signature);
            headers = curl_slist_append(headers, hbuf);
            headers = curl_slist_append(headers, "Content-Type: application/json");

            curl_easy_setopt(curl, CURLOPT_URL, url);
            curl_easy_setopt(curl, CURLOPT_POST, 1L);
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body);
            curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, (long)strlen(body));
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_cb);
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
            curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, (long)(client->timeout_sec * 1000));
            curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

            CURLcode res = curl_easy_perform(curl);
            if (res == CURLE_OK) curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status_code);
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
        }

        free(body);
        free(timestamp);
        free(nonce);
        free(signature);

        if (response && status_code >= 200 && status_code < 300) {
            JsonMap* result = wsd_json_parse(response);
            free(response);
            return result;
        }

        if (status_code == 429 && attempt < max_retries) {
            sleep_ms(5000);
            free(response);
            continue;
        }
        if ((status_code == 500 || status_code == 502 || status_code == 503 || status_code == 504) && attempt < max_retries) {
            sleep_ms((attempt + 1) * 2000);
            free(response);
            continue;
        }

        JsonMap* err = wsd_json_map_new();
        wsd_json_set(err, "success", "false");
        if (response) {
            JsonMap* resp = wsd_json_parse(response);
            const char* msg = wsd_json_get(resp, "message");
            if (msg) wsd_json_set(err, "message", msg);
            else {
                msg = wsd_json_get(resp, "error");
                if (msg) wsd_json_set(err, "message", msg);
                else {
                    char em[64];
                    sprintf(em, "HTTP %ld", status_code);
                    wsd_json_set(err, "message", em);
                }
            }
            wsd_json_free(resp);
        } else {
            wsd_json_set(err, "message", "Request failed");
        }
        free(response);
        return err;
    }

    JsonMap* err = wsd_json_map_new();
    wsd_json_set(err, "success", "false");
    char msg[128];
    sprintf(msg, "Failed after %d retries", max_retries);
    wsd_json_set(err, "message", msg);
    return err;
}

JsonMap* wsd_validate_license(ApiClient* client, const char* license_key, const char* hardware_id) {
    if (!hardware_id || !*hardware_id) hardware_id = wsd_get_fingerprint(client->hardware);
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "action", "validate");
    wsd_json_set(payload, "license_key", license_key);
    wsd_json_set(payload, "hardware_id", hardware_id);
    if (client->cache && wsd_cache_is_valid(client->cache)) {
        JsonMap* cached = wsd_cache_get_license_status(client->cache);
        if (cached) { wsd_json_free(payload); return cached; }
    }
    JsonMap* result = wsd_request(client, "license", payload, -1);
    wsd_json_free(payload);
    return result;
}

JsonMap* wsd_activate_license(ApiClient* client, const char* license_key, const char* hardware_id) {
    if (!hardware_id || !*hardware_id) hardware_id = wsd_get_fingerprint(client->hardware);
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "action", "activate");
    wsd_json_set(payload, "license_key", license_key);
    wsd_json_set(payload, "hardware_id", hardware_id);
    JsonMap* result = wsd_request(client, "license", payload, -1);
    wsd_json_free(payload);
    if (client->cache) wsd_cache_invalidate_license_status(client->cache);
    return result;
}

JsonMap* wsd_deactivate_license(ApiClient* client, const char* license_key, const char* hardware_id) {
    if (!hardware_id || !*hardware_id) hardware_id = wsd_get_fingerprint(client->hardware);
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "action", "deactivate");
    wsd_json_set(payload, "license_key", license_key);
    wsd_json_set(payload, "hardware_id", hardware_id);
    JsonMap* result = wsd_request(client, "license", payload, -1);
    wsd_json_free(payload);
    if (client->cache) wsd_cache_invalidate_license_status(client->cache);
    return result;
}

JsonMap* wsd_renew_license(ApiClient* client, const char* license_key, int extra_days) {
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "action", "renew");
    wsd_json_set(payload, "license_key", license_key);
    if (extra_days > 0) {
        char days[16];
        sprintf(days, "%d", extra_days);
        wsd_json_set(payload, "extra_days", days);
    }
    JsonMap* result = wsd_request(client, "license", payload, -1);
    wsd_json_free(payload);
    if (client->cache) wsd_cache_invalidate_license_status(client->cache);
    return result;
}

JsonMap* wsd_start_trial(ApiClient* client, const char* email, const char* customer_name, JsonMap* customer_data) {
    const char* hw = wsd_get_fingerprint(client->hardware);
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "action", "start");
    wsd_json_set(payload, "customer_email", email);
    wsd_json_set(payload, "customer_name", customer_name ? customer_name : "");
    wsd_json_set(payload, "hardware_id", hw);
    (void)customer_data;
    JsonMap* result = wsd_request(client, "trial", payload, -1);
    wsd_json_free(payload);
    return result;
}

JsonMap* wsd_get_trial_status(ApiClient* client, const char* hardware_id) {
    if (!hardware_id || !*hardware_id) hardware_id = wsd_get_fingerprint(client->hardware);
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "action", "status");
    wsd_json_set(payload, "hardware_id", hardware_id);
    JsonMap* result = wsd_request(client, "trial", payload, -1);
    wsd_json_free(payload);
    return result;
}

JsonMap* wsd_convert_trial(ApiClient* client, const char* hardware_id, const char* plan, const char* customer_name, const char* customer_email) {
    if (!hardware_id || !*hardware_id) hardware_id = wsd_get_fingerprint(client->hardware);
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "action", "convert");
    wsd_json_set(payload, "hardware_id", hardware_id);
    if (plan && *plan) wsd_json_set(payload, "plan", plan);
    if (customer_name && *customer_name) wsd_json_set(payload, "customer_name", customer_name);
    if (customer_email && *customer_email) wsd_json_set(payload, "customer_email", customer_email);
    JsonMap* result = wsd_request(client, "trial", payload, -1);
    wsd_json_free(payload);
    if (client->cache) wsd_cache_invalidate_license_status(client->cache);
    return result;
}

JsonMap* wsd_bind_device(ApiClient* client, const char* license_key, const char* hardware_id, const char* device_name) {
    if (!hardware_id || !*hardware_id) hardware_id = wsd_get_fingerprint(client->hardware);
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "action", "bind");
    wsd_json_set(payload, "license_key", license_key);
    wsd_json_set(payload, "hardware_id", hardware_id);
    if (device_name && *device_name) wsd_json_set(payload, "device_name", device_name);
    JsonMap* result = wsd_request(client, "device", payload, -1);
    wsd_json_free(payload);
    return result;
}

JsonMap* wsd_replace_device(ApiClient* client, const char* license_key, const char* new_hardware_id, const char* old_hardware_id) {
    if (!new_hardware_id || !*new_hardware_id) new_hardware_id = wsd_get_fingerprint(client->hardware);
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "action", "replace");
    wsd_json_set(payload, "license_key", license_key);
    wsd_json_set(payload, "old_hardware_id", old_hardware_id);
    wsd_json_set(payload, "new_hardware_id", new_hardware_id);
    JsonMap* result = wsd_request(client, "device", payload, -1);
    wsd_json_free(payload);
    if (client->cache) wsd_cache_invalidate_license_status(client->cache);
    return result;
}

JsonMap* wsd_get_products(ApiClient* client) {
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "action", "list");
    JsonMap* result = wsd_request(client, "store/products", payload, -1);
    wsd_json_free(payload);
    return result;
}

JsonMap* wsd_update_customer(ApiClient* client, const char* name, const char* email, const char* phone, const char* hardware_id) {
    if (!hardware_id || !*hardware_id) hardware_id = wsd_get_fingerprint(client->hardware);
    JsonMap* payload = wsd_json_map_new();
    wsd_json_set(payload, "name", name);
    wsd_json_set(payload, "email", email);
    wsd_json_set(payload, "mobile", phone);
    wsd_json_set(payload, "hardware_id", hardware_id);
    JsonMap* result = wsd_request(client, "customer/register", payload, -1);
    wsd_json_free(payload);
    return result;
}

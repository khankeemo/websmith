#include "client.h"
#include <ctype.h>

static size_t write_callback(void* contents, size_t size, size_t nmemb, void* userp) {
    size_t realsize = size * nmemb;
    char** output = (char**)userp;
    size_t cur_len = *output ? strlen(*output) : 0;
    char* new_str = realloc(*output, cur_len + realsize + 1);
    if (!new_str) return 0;
    memcpy(new_str + cur_len, contents, realsize);
    new_str[cur_len + realsize] = '\0';
    *output = new_str;
    return realsize;
}

websmith_result_t websmith_result_ok(const char* data) {
    websmith_result_t r;
    r.success = 1;
    r.error = NULL;
    r.data = data ? strdup(data) : NULL;
    return r;
}

websmith_result_t websmith_result_err(const char* error) {
    websmith_result_t r;
    r.success = 0;
    r.error = error ? strdup(error) : NULL;
    r.data = NULL;
    return r;
}

void websmith_result_free(websmith_result_t* result) {
    if (result) {
        free(result->error);
        free(result->data);
        result->error = NULL;
        result->data = NULL;
    }
}

websmith_client_t* websmith_client_new(const char* api_key, const char* api_secret) {
    websmith_client_t* client = calloc(1, sizeof(websmith_client_t));
    if (!client) return NULL;
    client->api_key = api_key ? strdup(api_key) : NULL;
    client->api_secret = api_secret ? strdup(api_secret) : NULL;
    const char* env_url = getenv("WEBSMITH_API_URL");
    const char* base = env_url ? env_url : "";
    client->api_url = strdup(base);
    size_t len = strlen(client->api_url);
    if (len > 0 && client->api_url[len - 1] == '/')
        client->api_url[len - 1] = '\0';
    return client;
}

void websmith_client_free(websmith_client_t* client) {
    if (client) {
        free(client->api_key);
        free(client->api_secret);
        free(client->api_url);
        free(client);
    }
}

int websmith_hex_encode(const unsigned char* in, size_t len, char* out, size_t out_len) {
    if (out_len < len * 2 + 1) return -1;
    for (size_t i = 0; i < len; i++) {
        sprintf(out + i * 2, "%02x", in[i]);
    }
    out[len * 2] = '\0';
    return 0;
}

char* websmith_hmac_sign(const char* api_secret, const char* timestamp, const char* nonce, const char* body) {
    if (!api_secret || !timestamp || !nonce) return NULL;
    size_t msg_len = strlen(timestamp) + strlen(nonce) + (body ? strlen(body) : 0) + 3;
    char* message = malloc(msg_len);
    if (!message) return NULL;
    snprintf(message, msg_len, "%s:%s:%s", timestamp, nonce, body ? body : "");

    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int digest_len = 0;
    HMAC(EVP_sha256(), api_secret, (int)strlen(api_secret),
         (const unsigned char*)message, strlen(message),
         digest, &digest_len);

    char* hex = malloc(digest_len * 2 + 1);
    if (!hex) { free(message); return NULL; }
    websmith_hex_encode(digest, digest_len, hex, digest_len * 2 + 1);
    free(message);
    return hex;
}

static int64_t websmith_timestamp_ms(void) {
#ifdef _WIN32
    FILETIME ft;
    ULARGE_INTEGER ui;
    GetSystemTimeAsFileTime(&ft);
    ui.LowPart = ft.dwLowDateTime;
    ui.HighPart = ft.dwHighDateTime;
    return (int64_t)((ui.QuadPart - 116444736000000000ULL) / 10000);
#else
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return (int64_t)ts.tv_sec * 1000 + (int64_t)(ts.tv_nsec / 1000000);
#endif
}

static char* websmith_generate_nonce(void) {
    char* nonce = malloc(37);
    if (!nonce) return NULL;
    const char charset[] = "0123456789abcdef";
    srand((unsigned int)(time(NULL) ^ websmith_timestamp_ms()));
    for (int i = 0; i < 32; i++) {
        nonce[i] = charset[rand() % 16];
    }
    nonce[32] = '\0';
    return nonce;
}

static void websmith_sleep_ms(int ms) {
#ifdef _WIN32
    Sleep(ms);
#else
    usleep(ms * 1000);
#endif
}

websmith_result_t websmith_api_request(websmith_client_t* client, const char* endpoint, const char* json_body) {
    websmith_result_t result = {NULL, NULL};
    if (!client || !client->api_url || !endpoint) {
        return websmith_result_err("Invalid client or endpoint");
    }

    char url[2048];
    snprintf(url, sizeof(url), "%s%s", client->api_url, endpoint);

    int64_t timestamp = websmith_timestamp_ms();
    char ts_str[32];
    snprintf(ts_str, sizeof(ts_str), "%lld", (long long)timestamp);

    char* nonce = websmith_generate_nonce();

    char* signature = NULL;
    if (client->api_secret) {
        signature = websmith_hmac_sign(client->api_secret, ts_str, nonce, json_body);
    }

    CURL* curl = curl_easy_init();
    if (!curl) {
        free(nonce);
        free(signature);
        return websmith_result_err("Failed to initialize curl");
    }

    char* response = NULL;
    struct curl_slist* headers = NULL;

    if (client->api_key) {
        char auth_header[512];
        snprintf(auth_header, sizeof(auth_header), "X-API-Key: %s", client->api_key);
        headers = curl_slist_append(headers, auth_header);
    }

    char ts_header[64];
    snprintf(ts_header, sizeof(ts_header), "X-Timestamp: %s", ts_str);
    headers = curl_slist_append(headers, ts_header);

    char nonce_header[64];
    snprintf(nonce_header, sizeof(nonce_header), "X-Nonce: %s", nonce);
    headers = curl_slist_append(headers, nonce_header);

    if (signature) {
        char sig_header[1024];
        snprintf(sig_header, sizeof(sig_header), "X-Signature: %s", signature);
        headers = curl_slist_append(headers, sig_header);
    }

    headers = curl_slist_append(headers, "Content-Type: application/json");

    for (int attempt = 0; attempt < WEBSMITH_MAX_RETRIES; attempt++) {
        response = NULL;
        curl_easy_setopt(curl, CURLOPT_URL, url);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_body);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);

        CURLcode res = curl_easy_perform(curl);
        if (res == CURLE_OK) {
            long http_code = 0;
            curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
            if (http_code >= 200 && http_code < 300) {
                result.data = response;
                result.error = NULL;
                break;
            }
            if (http_code >= 400 && http_code < 500) {
                result.data = response;
                result.error = strdup("Client error");
                break;
            }
        }

        free(response);
        response = NULL;

        if (attempt < WEBSMITH_MAX_RETRIES - 1) {
            int delay = WEBSMITH_BACKOFF_MS * (1 << attempt);
            websmith_sleep_ms(delay);
        } else {
            result.error = strdup("Max retries exceeded");
        }
    }

    curl_easy_cleanup(curl);
    curl_slist_free_all(headers);
    free(nonce);
    free(signature);
    return result;
}

websmith_result_t websmith_validate_license(websmith_client_t* client, const char* license_key, const char* device_id) {
    char body[2048];
    snprintf(body, sizeof(body), "{\"action\":\"validate\",\"license_key\":\"%s\",\"hardware_id\":\"%s\"}", license_key, device_id ? device_id : "");
    return websmith_api_request(client, "/api/v1/license", body);
}

websmith_result_t websmith_activate_license(websmith_client_t* client, const char* license_key, const char* device_id) {
    char body[2048];
    snprintf(body, sizeof(body), "{\"action\":\"activate\",\"license_key\":\"%s\",\"hardware_id\":\"%s\"}", license_key, device_id ? device_id : "");
    return websmith_api_request(client, "/api/v1/license", body);
}

websmith_result_t websmith_deactivate_license(websmith_client_t* client, const char* license_key, const char* device_id) {
    char body[2048];
    snprintf(body, sizeof(body), "{\"action\":\"deactivate\",\"license_key\":\"%s\",\"hardware_id\":\"%s\"}", license_key, device_id ? device_id : "");
    return websmith_api_request(client, "/api/v1/license", body);
}

websmith_result_t websmith_renew_license(websmith_client_t* client, const char* license_key) {
    char body[1024];
    snprintf(body, sizeof(body), "{\"action\":\"renew\",\"license_key\":\"%s\"}", license_key);
    return websmith_api_request(client, "/api/v1/license", body);
}

websmith_result_t websmith_start_trial(websmith_client_t* client, const char* email, const char* customer_name, const char* plan) {
    char body[2048];
    snprintf(body, sizeof(body), "{\"action\":\"start\",\"customer_email\":\"%s\",\"customer_name\":\"%s\",\"plan\":\"%s\"}", email ? email : "", customer_name ? customer_name : "", plan ? plan : "");
    return websmith_api_request(client, "/api/v1/trial", body);
}

websmith_result_t websmith_check_trial(websmith_client_t* client, const char* hardware_id) {
    char body[1024];
    snprintf(body, sizeof(body), "{\"action\":\"status\",\"hardware_id\":\"%s\"}", hardware_id ? hardware_id : "");
    return websmith_api_request(client, "/api/v1/trial", body);
}

websmith_result_t websmith_convert_trial(websmith_client_t* client, const char* hardware_id, const char* plan, const char* name, const char* email) {
    char body[2048];
    snprintf(body, sizeof(body), "{\"action\":\"convert\",\"hardware_id\":\"%s\",\"plan\":\"%s\",\"customer_name\":\"%s\",\"customer_email\":\"%s\"}", hardware_id ? hardware_id : "", plan ? plan : "", name ? name : "", email ? email : "");
    return websmith_api_request(client, "/api/v1/trial", body);
}

websmith_result_t websmith_bind_device(websmith_client_t* client, const char* license_key, const char* device_id, const char* device_name) {
    char body[2048];
    snprintf(body, sizeof(body), "{\"action\":\"bind\",\"license_key\":\"%s\",\"hardware_id\":\"%s\",\"device_name\":\"%s\"}", license_key ? license_key : "", device_id ? device_id : "", device_name ? device_name : "");
    return websmith_api_request(client, "/api/v1/license", body);
}

websmith_result_t websmith_get_trial_status(websmith_client_t* client, const char* hardware_id) {
    char body[1024];
    snprintf(body, sizeof(body), "{\"action\":\"status\",\"hardware_id\":\"%s\"}", hardware_id ? hardware_id : "");
    return websmith_api_request(client, "/api/v1/trial", body);
}

websmith_result_t websmith_get_products(websmith_client_t* client) {
    return websmith_api_request(client, "/api/v1/store/products", "{\"action\":\"list\"}");
}

static char* websmith_read_file(const char* path) {
    FILE* f = fopen(path, "r");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    rewind(f);
    if (len <= 0) { fclose(f); return NULL; }
    char* content = malloc((size_t)len + 1);
    if (!content) { fclose(f); return NULL; }
    size_t nread = fread(content, 1, (size_t)len, f);
    content[nread] = '\0';
    fclose(f);
    return content;
}

websmith_hardware_t* websmith_hardware_new(void) {
    websmith_hardware_t* hw = calloc(1, sizeof(websmith_hardware_t));
    if (!hw) return NULL;

    char cpu_buf[4096] = {0};
#ifdef _WIN32
    HKEY hKey;
    if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, "HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
        DWORD type = 0;
        DWORD size = sizeof(cpu_buf);
        if (RegQueryValueExA(hKey, "ProcessorNameString", NULL, &type, (LPBYTE)cpu_buf, &size) == ERROR_SUCCESS) {
            hw->cpu_id = strdup(cpu_buf);
        }
        RegCloseKey(hKey);
    }
    if (!hw->cpu_id) hw->cpu_id = strdup("unknown_cpu");

    IP_ADAPTER_INFO adapter_info[16];
    DWORD buf_len = sizeof(adapter_info);
    if (GetAdaptersInfo(adapter_info, &buf_len) == NO_ERROR) {
        IP_ADAPTER_INFO* p = adapter_info;
        while (p) {
            if (p->AddressLength == 6) {
                char mac[18];
                snprintf(mac, sizeof(mac), "%02X:%02X:%02X:%02X:%02X:%02X",
                    p->Address[0], p->Address[1], p->Address[2],
                    p->Address[3], p->Address[4], p->Address[5]);
                hw->mac_address = strdup(mac);
                break;
            }
            p = p->Next;
        }
    }
    if (!hw->mac_address) hw->mac_address = strdup("00:00:00:00:00:00");

    char vol_buf[64];
    DWORD serial = 0;
    if (GetVolumeInformationA("C:\\", NULL, 0, &serial, NULL, NULL, NULL, 0)) {
        snprintf(vol_buf, sizeof(vol_buf), "%08lX", serial);
        hw->motherboard_id = strdup(vol_buf);
    } else {
        hw->motherboard_id = strdup("unknown_mobo");
    }
#else
    char* cpuinfo = websmith_read_file("/proc/cpuinfo");
    if (cpuinfo) {
        char* model = strstr(cpuinfo, "model name");
        if (model) {
            char* colon = strchr(model, ':');
            if (colon) {
                colon++;
                while (*colon == ' ') colon++;
                char* nl = strchr(colon, '\\n');
                if (nl) *nl = '\0';
                strncpy(cpu_buf, colon, sizeof(cpu_buf) - 1);
                hw->cpu_id = strdup(cpu_buf);
            }
        }
        free(cpuinfo);
    }
    if (!hw->cpu_id) hw->cpu_id = strdup("unknown_cpu");

    char* uuid = websmith_read_file("/sys/class/dmi/id/product_uuid");
    if (uuid) {
        char* nl = strchr(uuid, '\\n');
        if (nl) *nl = '\0';
        hw->motherboard_id = strdup(uuid);
        free(uuid);
    } else {
        hw->motherboard_id = strdup("unknown_mobo");
    }

    struct ifaddrs* ifaddr = NULL;
    if (getifaddrs(&ifaddr) == 0) {
        for (struct ifaddrs* ifa = ifaddr; ifa != NULL; ifa = ifa->ifa_next) {
            if (ifa->ifa_addr && ifa->ifa_addr->sa_family == AF_PACKET && (ifa->ifa_flags & IFF_LOOPBACK) == 0) {
                struct sockaddr_ll* s = (struct sockaddr_ll*)ifa->ifa_addr;
                if (s->sll_halen == 6) {
                    char mac[18];
                    snprintf(mac, sizeof(mac), "%02X:%02X:%02X:%02X:%02X:%02X",
                        s->sll_addr[0], s->sll_addr[1], s->sll_addr[2],
                        s->sll_addr[3], s->sll_addr[4], s->sll_addr[5]);
                    hw->mac_address = strdup(mac);
                    break;
                }
            }
        }
        freeifaddrs(ifaddr);
    }
    if (!hw->mac_address) hw->mac_address = strdup("00:00:00:00:00:00");
#endif

#ifdef _WIN32
    hw->os = strdup("Windows");
#elif __APPLE__
    hw->os = strdup("macOS");
#elif __linux__
    hw->os = strdup("Linux");
#else
    hw->os = strdup("Unknown");
#endif

    char* fp = websmith_hardware_fingerprint(hw);
    if (fp) {
        hw->fingerprint = fp;
    } else {
        hw->fingerprint = strdup("fingerprint_error");
    }
    return hw;
}

char* websmith_hardware_fingerprint(websmith_hardware_t* hw) {
    if (!hw) return NULL;
    char raw[4096];
    snprintf(raw, sizeof(raw), "%s|%s|%s",
        hw->cpu_id ? hw->cpu_id : "",
        hw->motherboard_id ? hw->motherboard_id : "",
        hw->mac_address ? hw->mac_address : "");

    unsigned char digest[SHA256_DIGEST_LENGTH];
    SHA256((const unsigned char*)raw, strlen(raw), digest);

    char* hex = malloc(SHA256_DIGEST_LENGTH * 2 + 1);
    if (!hex) return NULL;
    websmith_hex_encode(digest, SHA256_DIGEST_LENGTH, hex, SHA256_DIGEST_LENGTH * 2 + 1);
    return hex;
}

void websmith_hardware_free(websmith_hardware_t* hw) {
    if (hw) {
        free(hw->fingerprint);
        free(hw->cpu_id);
        free(hw->motherboard_id);
        free(hw->mac_address);
        free(hw->os);
        free(hw);
    }
}

websmith_cache_t* websmith_cache_new(const char* cache_dir) {
    websmith_cache_t* cache = calloc(1, sizeof(websmith_cache_t));
    if (!cache) return NULL;
    if (cache_dir) {
        strncpy(cache->cache_dir, cache_dir, sizeof(cache->cache_dir) - 1);
    } else {
#ifdef _WIN32
        const char* tmp = getenv("TEMP");
        snprintf(cache->cache_dir, sizeof(cache->cache_dir), "%s\\websmith_cache", tmp ? tmp : "C:\\Temp");
#else
        const char* tmp = getenv("TMPDIR");
        snprintf(cache->cache_dir, sizeof(cache->cache_dir), "%s/websmith_cache", tmp ? tmp : "/tmp");
#endif
    }
    return cache;
}

websmith_result_t websmith_cache_get(websmith_cache_t* cache, const char* key) {
    if (!cache || !key) return websmith_result_err("Invalid cache or key");
    for (int i = 0; i < cache->count; i++) {
        if (strcmp(cache->entries[i].key, key) == 0) {
            if (cache->entries[i].expires_at > 0 && time(NULL) >= cache->entries[i].expires_at) {
                return websmith_result_err("Cache entry expired");
            }
            return websmith_result_ok(cache->entries[i].value);
        }
    }
    char file_path[WEBSMITH_MAX_PATH];
    snprintf(file_path, sizeof(file_path), "%s/%s.json", cache->cache_dir, key);
    char* content = websmith_read_file(file_path);
    if (!content) return websmith_result_err("Cache miss");
    websmith_result_t result = websmith_result_ok(content);
    free(content);
    return result;
}

int websmith_cache_set(websmith_cache_t* cache, const char* key, const char* value, time_t ttl) {
    if (!cache || !key || !value) return -1;
    if (cache->count < WEBSMITH_CACHE_MAX_ENTRIES) {
        strncpy(cache->entries[cache->count].key, key, sizeof(cache->entries[cache->count].key) - 1);
        strncpy(cache->entries[cache->count].value, value, sizeof(cache->entries[cache->count].value) - 1);
        cache->entries[cache->count].expires_at = ttl > 0 ? time(NULL) + ttl : 0;
        cache->count++;
    }
#ifdef _WIN32
    _mkdir(cache->cache_dir);
#else
    mkdir(cache->cache_dir, 0700);
#endif
    char tmp_path[WEBSMITH_MAX_PATH];
    char final_path[WEBSMITH_MAX_PATH];
    snprintf(tmp_path, sizeof(tmp_path), "%s/%s.tmp", cache->cache_dir, key);
    snprintf(final_path, sizeof(final_path), "%s/%s.json", cache->cache_dir, key);
    FILE* f = fopen(tmp_path, "w");
    if (!f) return -1;
    fprintf(f, "%s", value);
    fclose(f);
    if (rename(tmp_path, final_path) != 0) {
        remove(tmp_path);
        return -1;
    }
    return 0;
}

void websmith_cache_clear(websmith_cache_t* cache) {
    if (!cache) return;
    cache->count = 0;
    char cmd[WEBSMITH_MAX_PATH + 64];
    snprintf(cmd, sizeof(cmd),
#ifdef _WIN32
        "if exist \"%s\" rmdir /s /q \"%s\"",
#else
        "rm -rf \"%s\"",
#endif
        cache->cache_dir, cache->cache_dir);
    system(cmd);
}

void websmith_cache_free(websmith_cache_t* cache) {
    if (cache) {
        websmith_cache_clear(cache);
        free(cache);
    }
}

websmith_license_engine_t* websmith_engine_new(websmith_client_t* client, websmith_cache_t* cache) {
    websmith_license_engine_t* engine = calloc(1, sizeof(websmith_license_engine_t));
    if (!engine) return NULL;
    engine->client = client;
    engine->cache = cache;
    engine->is_valid = 0;
    return engine;
}

int websmith_engine_load_license(websmith_license_engine_t* engine, const char* license_key) {
    if (!engine || !license_key) return -1;
    strncpy(engine->license_key, license_key, sizeof(engine->license_key) - 1);
    if (engine->cache) {
        websmith_result_t cached = websmith_cache_get(engine->cache, license_key);
        if (cached.data) {
            strncpy(engine->license_data, cached.data, sizeof(engine->license_data) - 1);
            cJSON* root = cJSON_Parse(cached.data);
            if (root) {
                cJSON* status_item = cJSON_GetObjectItem(root, "status");
                if (status_item && status_item->valuestring)
                    strncpy(engine->status, status_item->valuestring, sizeof(engine->status) - 1);
                cJSON* expires = cJSON_GetObjectItem(root, "expires_at");
                if (expires && expires->valuestring)
                    engine->expires_at = (time_t)atol(expires->valuestring);
                cJSON* valid_item = cJSON_GetObjectItem(root, "is_valid");
                if (valid_item) engine->is_valid = cJSON_IsTrue(valid_item);
                cJSON* reason = cJSON_GetObjectItem(root, "inactive_reason");
                if (reason && reason->valuestring)
                    strncpy(engine->inactive_reason, reason->valuestring, sizeof(engine->inactive_reason) - 1);
                cJSON_Delete(root);
            }
            websmith_result_free(&cached);
            return 0;
        }
        websmith_result_free(&cached);
    }
    return -1;
}

int websmith_engine_validate(websmith_license_engine_t* engine) {
    if (!engine || strlen(engine->license_key) == 0) return -1;
    websmith_hardware_t* hw = websmith_hardware_new();
    if (!hw) return -1;
    websmith_result_t res = websmith_validate_license(engine->client, engine->license_key, hw->fingerprint);
    websmith_hardware_free(hw);
    if (res.error) { websmith_result_free(&res); return -1; }
    if (res.data) {
        strncpy(engine->license_data, res.data, sizeof(engine->license_data) - 1);
        cJSON* root = cJSON_Parse(res.data);
        if (root) {
            cJSON* status_item = cJSON_GetObjectItem(root, "status");
            if (status_item && status_item->valuestring)
                strncpy(engine->status, status_item->valuestring, sizeof(engine->status) - 1);
            cJSON* valid_item = cJSON_GetObjectItem(root, "is_valid");
            if (valid_item) engine->is_valid = cJSON_IsTrue(valid_item);
            cJSON* expires = cJSON_GetObjectItem(root, "expires_at");
            if (expires && expires->valuestring)
                engine->expires_at = (time_t)atol(expires->valuestring);
            cJSON* reason = cJSON_GetObjectItem(root, "inactive_reason");
            if (reason && reason->valuestring)
                strncpy(engine->inactive_reason, reason->valuestring, sizeof(engine->inactive_reason) - 1);
            cJSON_Delete(root);
        }
        if (engine->cache)
            websmith_cache_set(engine->cache, engine->license_key, res.data, 0);
    }
    websmith_result_free(&res);
    return engine->is_valid ? 0 : -1;
}

int websmith_engine_activate(websmith_license_engine_t* engine, const char* device_id) {
    if (!engine || strlen(engine->license_key) == 0) return -1;
    websmith_result_t res = websmith_activate_license(engine->client, engine->license_key, device_id);
    if (res.error) { websmith_result_free(&res); return -1; }
    if (res.data) {
        strncpy(engine->license_data, res.data, sizeof(engine->license_data) - 1);
        cJSON* root = cJSON_Parse(res.data);
        if (root) {
            cJSON* status_item = cJSON_GetObjectItem(root, "status");
            if (status_item && status_item->valuestring) {
                strncpy(engine->status, status_item->valuestring, sizeof(engine->status) - 1);
                engine->is_valid = (strcmp(engine->status, "active") == 0 || strcmp(engine->status, "activated") == 0) ? 1 : 0;
            }
            cJSON_Delete(root);
        }
        if (engine->cache)
            websmith_cache_set(engine->cache, engine->license_key, res.data, 0);
    }
    websmith_result_free(&res);
    return engine->is_valid ? 0 : -1;
}

int websmith_engine_deactivate(websmith_license_engine_t* engine) {
    if (!engine || strlen(engine->license_key) == 0) return -1;
    websmith_hardware_t* hw = websmith_hardware_new();
    if (!hw) return -1;
    websmith_result_t res = websmith_deactivate_license(engine->client, engine->license_key, hw->fingerprint);
    websmith_hardware_free(hw);
    if (res.error) { websmith_result_free(&res); return -1; }
    if (res.data) {
        strncpy(engine->license_data, res.data, sizeof(engine->license_data) - 1);
        engine->is_valid = 0;
        strncpy(engine->status, "deactivated", sizeof(engine->status) - 1);
        if (engine->cache)
            websmith_cache_set(engine->cache, engine->license_key, res.data, 0);
    }
    websmith_result_free(&res);
    return 0;
}

int websmith_engine_renew(websmith_license_engine_t* engine) {
    if (!engine || strlen(engine->license_key) == 0) return -1;
    websmith_result_t res = websmith_renew_license(engine->client, engine->license_key);
    if (res.error) { websmith_result_free(&res); return -1; }
    if (res.data) {
        strncpy(engine->license_data, res.data, sizeof(engine->license_data) - 1);
        cJSON* root = cJSON_Parse(res.data);
        if (root) {
            cJSON* status_item = cJSON_GetObjectItem(root, "status");
            if (status_item && status_item->valuestring)
                strncpy(engine->status, status_item->valuestring, sizeof(engine->status) - 1);
            cJSON* valid_item = cJSON_GetObjectItem(root, "is_valid");
            if (valid_item) engine->is_valid = cJSON_IsTrue(valid_item);
            cJSON_Delete(root);
        }
        if (engine->cache)
            websmith_cache_set(engine->cache, engine->license_key, res.data, 0);
    }
    websmith_result_free(&res);
    return engine->is_valid ? 0 : -1;
}

int websmith_engine_start_trial(websmith_license_engine_t* engine, const char* email, const char* customer_name, const char* plan) {
    if (!engine) return -1;
    websmith_result_t res = websmith_start_trial(engine->client, email, customer_name, plan);
    if (res.error) { websmith_result_free(&res); return -1; }
    if (res.data) {
        strncpy(engine->license_data, res.data, sizeof(engine->license_data) - 1);
    }
    websmith_result_free(&res);
    return 0;
}

int websmith_engine_check_trial(websmith_license_engine_t* engine, const char* hardware_id) {
    if (!engine) return -1;
    websmith_result_t res = websmith_check_trial(engine->client, hardware_id);
    if (res.error) { websmith_result_free(&res); return -1; }
    if (res.data) {
        strncpy(engine->license_data, res.data, sizeof(engine->license_data) - 1);
    }
    websmith_result_free(&res);
    return 0;
}

int websmith_engine_convert_trial(websmith_license_engine_t* engine, const char* hardware_id, const char* plan, const char* name, const char* email) {
    if (!engine) return -1;
    websmith_result_t res = websmith_convert_trial(engine->client, hardware_id, plan, name, email);
    if (res.error) { websmith_result_free(&res); return -1; }
    if (res.data) {
        strncpy(engine->license_data, res.data, sizeof(engine->license_data) - 1);
    }
    websmith_result_free(&res);
    return 0;
}

int websmith_engine_bind_device(websmith_license_engine_t* engine, const char* license_key, const char* device_id, const char* device_name) {
    if (!engine) return -1;
    websmith_result_t res = websmith_bind_device(engine->client, license_key, device_id, device_name);
    if (res.error) { websmith_result_free(&res); return -1; }
    if (res.data) {
        strncpy(engine->license_data, res.data, sizeof(engine->license_data) - 1);
    }
    websmith_result_free(&res);
    return 0;
}

static const char* websmith_get_hardware_id(void) {
    static char id[128];
    websmith_hardware_t* hw = websmith_hardware_new();
    if (!hw) return NULL;
    char* fp = websmith_hardware_fingerprint(hw);
    if (fp) {
        strncpy(id, fp, sizeof(id) - 1);
        free(fp);
    } else {
        websmith_hardware_free(hw);
        return NULL;
    }
    websmith_hardware_free(hw);
    return id;
}

websmith_result_t websmith_engine_view_hardware_status(websmith_license_engine_t* engine) {
    websmith_result_t result;
    memset(&result, 0, sizeof(result));
    if (!engine) {
        result.success = 0;
        result.error = strdup("Engine not initialized");
        return result;
    }
    const char* current_hw = websmith_get_hardware_id();
    int ret = websmith_engine_validate(engine);
    if (ret != 0) {
        result.success = 0;
        result.error = strdup("Validation failed");
        return result;
    }
    int matched = 0;
    char* data = NULL;
    char* hw_start = strstr(engine->license_data, "\"hardware_id\"");
    if (hw_start) {
        data = strchr(hw_start, ':');
        if (data) {
            data++;
            while (*data == ' ' || *data == '"') data++;
            char* end = strchr(data, '"');
            if (end) *end = '\0';
            matched = (current_hw && strcmp(current_hw, data) == 0) ? 1 : 0;
        }
    }
    char buf[512];
    snprintf(buf, sizeof(buf), "{\"matched\":%s,\"current_hardware_id\":\"%s\",\"registered_hardware_id\":\"%s\"}",
        matched ? "true" : "false",
        current_hw ? current_hw : "",
        data ? data : "");
    result.success = 1;
    result.data = strdup(buf);
    return result;
}

int websmith_engine_is_valid(websmith_license_engine_t* engine) {
    if (!engine) return 0;
    if (engine->expires_at > 0 && time(NULL) >= engine->expires_at) {
        engine->is_valid = 0;
        strncpy(engine->status, "expired", sizeof(engine->status) - 1);
    }
    return engine->is_valid;
}

void websmith_engine_free(websmith_license_engine_t* engine) {
    if (engine) {
        free(engine);
    }
}

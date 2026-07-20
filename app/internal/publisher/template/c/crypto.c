#include "crypto.h"
#include <openssl/hmac.h>
#include <openssl/sha.h>
#include <openssl/evp.h>
#include <openssl/bio.h>
#include <openssl/buffer.h>
#include <time.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <ctype.h>

char* wsd_generate_timestamp(void) {
    time_t now = time(NULL);
    struct tm* gmt = gmtime(&now);
    if (!gmt) return strdup("1970-01-01T00:00:00.000Z");
    char* buf = malloc(32);
    if (!buf) return NULL;
    strftime(buf, 32, "%Y-%m-%dT%H:%M:%S.", gmt);
    char ms[8];
    sprintf(ms, "%03d", 0);
    strcat(buf, ms);
    strcat(buf, "Z");
    return buf;
}

char* wsd_generate_nonce(void) {
    static int seeded = 0;
    if (!seeded) { srand((unsigned)time(NULL)); seeded = 1; }
    char* buf = malloc(48);
    if (!buf) return NULL;
    sprintf(buf, "%08x%08x%08x", rand(), rand(), rand());
    return buf;
}

char* wsd_sha256_hex(const char* data) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256((const unsigned char*)data, strlen(data), hash);
    char* hex = malloc(SHA256_DIGEST_LENGTH * 2 + 1);
    if (!hex) return NULL;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i) {
        sprintf(hex + i * 2, "%02x", hash[i]);
    }
    hex[SHA256_DIGEST_LENGTH * 2] = '\0';
    return hex;
}

char* wsd_hmac_sha256(const char* key, const char* message) {
    unsigned char result[SHA256_DIGEST_LENGTH];
    unsigned int len = SHA256_DIGEST_LENGTH;
    HMAC(EVP_sha256(), key, (int)strlen(key),
         (const unsigned char*)message, strlen(message),
         result, &len);
    return wsd_base64_encode(result, len);
}

char* wsd_base64_encode(const unsigned char* data, size_t length) {
    if (length == 0) return strdup("");
    BIO* bio = BIO_new(BIO_s_mem());
    BIO* b64 = BIO_new(BIO_f_base64());
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    bio = BIO_push(b64, bio);
    BIO_write(bio, data, (int)length);
    (void)BIO_flush(bio);
    char* buf = NULL;
    long len = BIO_get_mem_data(bio, &buf);
    char* result = malloc(len + 1);
    if (result) { memcpy(result, buf, len); result[len] = '\0'; }
    BIO_free_all(bio);
    return result;
}

char* wsd_sign_request(const char* payload_json, const char* secret,
                        const char* timestamp, const char* nonce,
                        const char* method, const char* path,
                        const char* query) {
    if (!method) method = "POST";
    if (!path) path = "";
    if (!query) query = "";
    char* body_hash = wsd_sha256_hex(payload_json);
    size_t msg_len = strlen(method) + 1 + strlen(path) + 1 +
                     strlen(query) + 1 + strlen(body_hash) + 1 +
                     strlen(timestamp) + 1 + strlen(nonce);
    char* message = malloc(msg_len + 1);
    if (!message) { free(body_hash); return NULL; }
    sprintf(message, "%s\n%s\n%s\n%s\n%s\n%s",
            method, path, query, body_hash, timestamp, nonce);
    free(body_hash);
    char* signature = wsd_hmac_sha256(secret, message);
    free(message);
    return signature;
}

char* wsd_json_escape(const char* s) {
    size_t len = strlen(s);
    size_t cap = len * 2 + 3;
    char* out = malloc(cap);
    if (!out) return NULL;
    size_t j = 0;
    for (size_t i = 0; i < len && j < cap - 6; ++i) {
        switch (s[i]) {
            case '"':  out[j++] = '\\'; out[j++] = '"';  break;
            case '\\': out[j++] = '\\'; out[j++] = '\\'; break;
            case '\n': out[j++] = '\\'; out[j++] = 'n';  break;
            case '\r': out[j++] = '\\'; out[j++] = 'r';  break;
            case '\t': out[j++] = '\\'; out[j++] = 't';  break;
            default:   out[j++] = s[i]; break;
        }
    }
    out[j] = '\0';
    return out;
}

char* wsd_json_stringify(const char* const* keys, const char* const* values, int count) {
    size_t cap = 256;
    char* result = malloc(cap);
    if (!result) return NULL;
    result[0] = '{';
    size_t pos = 1;
    for (int i = 0; i < count; ++i) {
        if (i > 0) { result[pos++] = ','; if (pos >= cap - 64) { cap *= 2; result = realloc(result, cap); if (!result) return NULL; } }
        char* ek = wsd_json_escape(keys[i] ? keys[i] : "");
        char* ev = wsd_json_escape(values[i] ? values[i] : "");
        size_t needed = pos + strlen(ek) + strlen(ev) + 6;
        if (needed >= cap) {
            cap = needed * 2;
            result = realloc(result, cap);
            if (!result) { free(ek); free(ev); return NULL; }
        }
        result[pos++] = '"';
        memcpy(result + pos, ek, strlen(ek));
        pos += strlen(ek);
        free(ek);
        result[pos++] = '"';
        result[pos++] = ':';
        result[pos++] = '"';
        memcpy(result + pos, ev, strlen(ev));
        pos += strlen(ev);
        free(ev);
        result[pos++] = '"';
    }
    result[pos++] = '}';
    result[pos] = '\0';
    return result;
}

JsonMap* wsd_json_map_new(void) {
    JsonMap* map = calloc(1, sizeof(JsonMap));
    if (map) { map->capacity = 16; map->keys = calloc(map->capacity, sizeof(char*));
               map->values = calloc(map->capacity, sizeof(char*)); }
    return map;
}

void wsd_json_set(JsonMap* map, const char* key, const char* value) {
    if (!map || !key) return;
    for (int i = 0; i < map->count; ++i) {
        if (strcmp(map->keys[i], key) == 0) {
            free(map->values[i]);
            map->values[i] = value ? strdup(value) : NULL;
            return;
        }
    }
    if (map->count >= map->capacity) {
        map->capacity *= 2;
        map->keys = realloc(map->keys, map->capacity * sizeof(char*));
        map->values = realloc(map->values, map->capacity * sizeof(char*));
    }
    map->keys[map->count] = strdup(key);
    map->values[map->count] = value ? strdup(value) : NULL;
    map->count++;
}

const char* wsd_json_get(const JsonMap* map, const char* key) {
    if (!map || !key) return NULL;
    for (int i = 0; i < map->count; ++i) {
        if (map->keys[i] && strcmp(map->keys[i], key) == 0)
            return map->values[i];
    }
    return NULL;
}

void wsd_json_free(JsonMap* map) {
    if (!map) return;
    for (int i = 0; i < map->count; ++i) {
        free(map->keys[i]);
        free(map->values[i]);
    }
    free(map->keys);
    free(map->values);
    free(map);
}

static char* json_read_string(const char* json, size_t* pos) {
    if (json[*pos] != '"') return NULL;
    (*pos)++;
    size_t cap = 64, len = 0;
    char* result = malloc(cap);
    if (!result) return NULL;
    while (json[*pos] && json[*pos] != '"') {
        if (json[*pos] == '\\' && json[*pos + 1]) {
            (*pos)++;
            if (len + 1 >= cap) { cap *= 2; result = realloc(result, cap); }
            result[len++] = json[*pos]; (*pos)++;
        } else {
            if (len + 1 >= cap) { cap *= 2; result = realloc(result, cap); }
            result[len++] = json[*pos]; (*pos)++;
        }
    }
    if (json[*pos] == '"') (*pos)++;
    result[len] = '\0';
    return result;
}

static void json_skip_ws(const char* json, size_t* pos) {
    while (json[*pos] && (json[*pos] == ' ' || json[*pos] == '\t' ||
           json[*pos] == '\n' || json[*pos] == '\r')) (*pos)++;
}

JsonMap* wsd_json_parse(const char* json) {
    JsonMap* map = wsd_json_map_new();
    if (!map) return NULL;
    size_t pos = 0;
    json_skip_ws(json, &pos);
    if (json[pos] != '{') { return map; }
    pos++;
    while (json[pos]) {
        json_skip_ws(json, &pos);
        if (json[pos] == '}' || json[pos] == '\0') break;
        char* key = json_read_string(json, &pos);
        if (!key) { pos++; continue; }
        json_skip_ws(json, &pos);
        if (json[pos] == ':') pos++;
        json_skip_ws(json, &pos);
        char* val = NULL;
        if (json[pos] == '"') {
            val = json_read_string(json, &pos);
        } else if (json[pos] == '{') {
            int depth = 1;
            size_t start = pos;
            pos++;
            while (json[pos] && depth > 0) {
                if (json[pos] == '{') depth++;
                else if (json[pos] == '}') depth--;
                pos++;
            }
            size_t len = pos - start;
            val = malloc(len + 1);
            if (val) { memcpy(val, json + start, len); val[len] = '\0'; }
        } else {
            size_t start = pos;
            while (json[pos] && json[pos] != ',' && json[pos] != '}' &&
                   json[pos] != ' ' && json[pos] != '\n' && json[pos] != '\r' && json[pos] != '\t')
                pos++;
            size_t len = pos - start;
            val = malloc(len + 1);
            if (val) { memcpy(val, json + start, len); val[len] = '\0'; }
        }
        if (val) {
            char* trimmed_val = val;
            while (*trimmed_val == ' ') trimmed_val++;
            char* end = trimmed_val + strlen(trimmed_val) - 1;
            while (end > trimmed_val && (*end == ' ' || *end == '\n' || *end == '\r' || *end == '\t')) end--;
            *(end + 1) = '\0';
            wsd_json_set(map, key, trimmed_val);
            if (trimmed_val != val) free(val);
        }
        free(key);
        json_skip_ws(json, &pos);
        if (json[pos] == ',') pos++;
    }
    return map;
}

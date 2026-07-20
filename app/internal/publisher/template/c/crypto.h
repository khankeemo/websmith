#ifndef WSD_CRYPTO_H
#define WSD_CRYPTO_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

char* wsd_generate_timestamp(void);
char* wsd_generate_nonce(void);
char* wsd_sha256_hex(const char* data);
char* wsd_hmac_sha256(const char* key, const char* message);
char* wsd_base64_encode(const unsigned char* data, size_t length);
char* wsd_sign_request(const char* payload_json, const char* secret,
                        const char* timestamp, const char* nonce,
                        const char* method, const char* path,
                        const char* query);
char* wsd_json_stringify(const char* const* keys, const char* const* values, int count);
char* wsd_json_escape(const char* s);

typedef struct {
    char** keys;
    char** values;
    int count;
    int capacity;
} JsonMap;

JsonMap* wsd_json_parse(const char* json);
const char* wsd_json_get(const JsonMap* map, const char* key);
void wsd_json_set(JsonMap* map, const char* key, const char* value);
void wsd_json_free(JsonMap* map);
JsonMap* wsd_json_map_new(void);

#ifdef __cplusplus
}
#endif

#endif

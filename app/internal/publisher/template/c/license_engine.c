#include "license_engine.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

LicenseEngine* wsd_engine_new(const char* config_path) {
    LicenseEngine* engine = calloc(1, sizeof(LicenseEngine));
    if (!engine) return NULL;
    engine->config = wsd_json_map_new();
    engine->client = wsd_client_new(config_path);
    engine->hardware = engine->client ? engine->client->hardware : wsd_hardware_new();
    engine->cache = calloc(1, sizeof(CacheManager));
    if (engine->cache) {
        snprintf(engine->cache->cache_dir, sizeof(engine->cache->cache_dir), "%s",
                 config_path ? config_path : "unknown");
    }
    return engine;
}

void wsd_engine_free(LicenseEngine* engine) {
    if (!engine) return;
    wsd_client_free(engine->client);
    wsd_hardware_free(engine->hardware);
    wsd_cache_free(engine->cache);
    wsd_json_free(engine->config);
    free(engine);
}

LicenseStatus* wsd_initialize(LicenseEngine* engine) {
    if (!engine) return NULL;
    engine->has_status = 1;
    const char* hw_id = wsd_get_fingerprint(engine->hardware);
    strncpy(engine->status.hardware_id, hw_id ? hw_id : "", sizeof(engine->status.hardware_id) - 1);

    // Priority 1: Validate active paid license from server
    if (engine->license_key[0]) {
        JsonMap* result = wsd_validate_license(engine->client, engine->license_key, hw_id);
        if (result) {
            const char* data_json = wsd_json_get(result, "data");
            JsonMap* data = data_json ? wsd_json_parse(data_json) : result;
            const char* valid = wsd_json_get(data, "valid");
            if (valid && strcmp(valid, "true") == 0) {
                const char* st = wsd_json_get(data, "status");
                engine->status.valid = 1;
                strncpy(engine->status.status, st ? st : "active", sizeof(engine->status.status) - 1);
                const char* exp = wsd_json_get(data, "expiry_date");
                if (exp) strncpy(engine->status.expires_at, exp, sizeof(engine->status.expires_at) - 1);
                const char* dl = wsd_json_get(data, "days_left");
                engine->status.days_remaining = dl ? atoi(dl) : 0;
                const char* plan = wsd_json_get(data, "plan");
                if (plan) strncpy(engine->status.plan, plan, sizeof(engine->status.plan) - 1);
                strncpy(engine->status.license_key, engine->license_key, sizeof(engine->status.license_key) - 1);
                strcpy(engine->status.message, "License active");
                if (engine->status.valid) {
                    wsd_cache_set_license_status(engine->cache, wsd_json_map_new());
                    wsd_cache_mark_has_ever_activated_paid_license(engine->cache);
                }
                if (data != result) wsd_json_free(data);
                wsd_json_free(result);
                return &engine->status;
            } else {
                // Paid license is invalid/inactive - check if user ever had one
                if (wsd_cache_has_ever_activated_paid_license(engine->cache)) {
                    engine->status.valid = 0;
                    strcpy(engine->status.status, "force_reactivation");
                    strncpy(engine->status.license_key, engine->license_key, sizeof(engine->status.license_key) - 1);
                    strcpy(engine->status.message, "License inactive. Please reactivate.");
                    if (data != result) wsd_json_free(data);
                    wsd_json_free(result);
                    return &engine->status;
                }
            }
            if (data != result) wsd_json_free(data);
            wsd_json_free(result);
        } else {
            // Server error - check if user ever had a paid license
            if (wsd_cache_has_ever_activated_paid_license(engine->cache)) {
                engine->status.valid = 0;
                strcpy(engine->status.status, "force_reactivation");
                strncpy(engine->status.license_key, engine->license_key, sizeof(engine->status.license_key) - 1);
                strcpy(engine->status.message, "License validation failed. Please reactivate.");
                return &engine->status;
            }
        }
    } else {
        // No license key but check if user ever had one
        if (wsd_cache_has_ever_activated_paid_license(engine->cache)) {
            engine->status.valid = 0;
            strcpy(engine->status.status, "force_reactivation");
            strcpy(engine->status.message, "License inactive. Please reactivate.");
            return &engine->status;
        }
    }

    // Priority 2: Check for active trial (only if user never had a paid license)
    if (!wsd_cache_has_ever_activated_paid_license(engine->cache)) {
        JsonMap* trial = wsd_get_trial_status(engine->client, hw_id);
        if (trial) {
            const char* data_json = wsd_json_get(trial, "data");
            if (data_json) {
                JsonMap* td = wsd_json_parse(data_json);
                if (td) {
                    const char* has_trial = wsd_json_get(td, "has_trial");
                    if (has_trial && strcmp(has_trial, "true") == 0) {
                        const char* st = wsd_json_get(td, "status");
                        engine->status.valid = (st && strcmp(st, "active") == 0) ? 1 : 0;
                        strncpy(engine->status.status, st ? st : "trial", sizeof(engine->status.status) - 1);
                        const char* exp = wsd_json_get(td, "expiry_date");
                        if (exp) strncpy(engine->status.expires_at, exp, sizeof(engine->status.expires_at) - 1);
                        const char* dl = wsd_json_get(td, "days_left");
                        engine->status.days_remaining = dl ? atoi(dl) : 0;
                        const char* plan = wsd_json_get(td, "plan");
                        if (plan) strncpy(engine->status.plan, plan, sizeof(engine->status.plan) - 1);
                        snprintf(engine->status.message, sizeof(engine->status.message), "Trial is %s", st ? st : "unknown");
                        engine->status.trial_active = 1;
                        wsd_json_free(td);
                        wsd_json_free(trial);
                        return &engine->status;
                    }
                    wsd_json_free(td);
                }
            }
            wsd_json_free(trial);
        }
    }

    engine->status.valid = 0;
    strcpy(engine->status.status, "unlicensed");
    strcpy(engine->status.message, "No license or trial found");
    return &engine->status;
}

const char* wsd_get_hardware_id_c(LicenseEngine* engine) {
    return engine ? wsd_get_fingerprint(engine->hardware) : "";
}

LicenseStatus* wsd_get_status(LicenseEngine* engine) {
    return (engine && engine->has_status) ? &engine->status : NULL;
}

const char* wsd_get_license_key_c(LicenseEngine* engine) {
    return engine ? engine->license_key : "";
}

int wsd_has_license_key(LicenseEngine* engine) {
    return engine && engine->license_key[0] != '\0';
}

JsonMap* wsd_validate(LicenseEngine* engine, const char* license_key) {
    if (!license_key || !*license_key) license_key = engine->license_key;
    if (!license_key || !*license_key) {
        JsonMap* err = wsd_json_map_new();
        wsd_json_set(err, "success", "false");
        wsd_json_set(err, "message", "License key unavailable. Please activate first.");
        return err;
    }
    const char* hw_id = wsd_get_fingerprint(engine->hardware);
    JsonMap* result = wsd_validate_license(engine->client, license_key, hw_id);
    const char* data_json = wsd_json_get(result, "data");
    if (data_json) {
        JsonMap* data = wsd_json_parse(data_json);
        if (data) {
            const char* valid = wsd_json_get(data, "valid");
            if (valid && strcmp(valid, "true") == 0) {
                const char* lk = wsd_json_get(data, "license_key");
                if (lk && *lk) strncpy(engine->license_key, lk, sizeof(engine->license_key) - 1);
                wsd_initialize(engine);
                wsd_cache_mark_has_ever_activated_paid_license(engine->cache);
            }
            wsd_json_free(data);
        }
    }
    return result;
}

JsonMap* wsd_activate(LicenseEngine* engine, const char* license_key) {
    JsonMap* result = wsd_activate_license(engine->client, license_key, NULL);
    const char* success = wsd_json_get(result, "success");
    if (success && strcmp(success, "true") == 0) {
        strncpy(engine->license_key, license_key, sizeof(engine->license_key) - 1);
        wsd_initialize(engine);
        wsd_cache_mark_has_ever_activated_paid_license(engine->cache);
    }
    return result;
}

JsonMap* wsd_start_trial_c(LicenseEngine* engine, const char* email, const char* customer_name) {
    JsonMap* result = wsd_start_trial(engine->client, email, customer_name, NULL);
    const char* success = wsd_json_get(result, "success");
    if (success && strcmp(success, "true") == 0) wsd_initialize(engine);
    return result;
}

JsonMap* wsd_convert_trial_c(LicenseEngine* engine, const char* plan, const char* customer_name, const char* customer_email) {
    if (engine->has_status && strcmp(engine->status.status, "trial") != 0) {
        JsonMap* err = wsd_json_map_new();
        wsd_json_set(err, "success", "false");
        wsd_json_set(err, "message", "No active trial to convert.");
        return err;
    }
    const char* hw_id = wsd_get_fingerprint(engine->hardware);
    JsonMap* result = wsd_convert_trial(engine->client, hw_id, plan, customer_name, customer_email);
    const char* success = wsd_json_get(result, "success");
    if (success && strcmp(success, "true") == 0) {
        const char* lk = wsd_json_get(result, "license_key");
        if (lk && *lk) strncpy(engine->license_key, lk, sizeof(engine->license_key) - 1);
        wsd_initialize(engine);
        wsd_cache_mark_has_ever_activated_paid_license(engine->cache);
    }
    return result;
}

JsonMap* wsd_renew(LicenseEngine* engine, int extra_days) {
    if (!engine->license_key[0]) {
        JsonMap* err = wsd_json_map_new();
        wsd_json_set(err, "success", "false");
        wsd_json_set(err, "message", "License key unavailable.");
        return err;
    }
    JsonMap* result = wsd_renew_license(engine->client, engine->license_key, extra_days);
    const char* success = wsd_json_get(result, "success");
    if (success && strcmp(success, "true") == 0) {
        wsd_initialize(engine);
        wsd_cache_mark_has_ever_activated_paid_license(engine->cache);
    }
    return result;
}

JsonMap* wsd_deactivate(LicenseEngine* engine, const char* license_key) {
    if (!license_key || !*license_key) license_key = engine->license_key;
    if (!license_key || !*license_key) {
        JsonMap* err = wsd_json_map_new();
        wsd_json_set(err, "success", "false");
        wsd_json_set(err, "message", "License key unavailable.");
        return err;
    }
    JsonMap* result = wsd_deactivate_license(engine->client, license_key, NULL);
    const char* success = wsd_json_get(result, "success");
    if (success && strcmp(success, "true") == 0) {
        if (engine->cache) wsd_cache_invalidate_license_status(engine->cache);
        engine->has_status = 0;
        if (license_key == engine->license_key || strcmp(license_key, engine->license_key) == 0)
            engine->license_key[0] = '\0';
    }
    return result;
}

JsonMap* wsd_replace_hardware(LicenseEngine* engine) {
    if (!engine->license_key[0]) {
        JsonMap* err = wsd_json_map_new();
        wsd_json_set(err, "success", "false");
        wsd_json_set(err, "message", "License key unavailable.");
        return err;
    }
    const char* new_hw = wsd_get_fingerprint(engine->hardware);
    const char* old_hw = engine->status.hardware_id;
    if (!old_hw || !*old_hw) {
        old_hw = "";
    }
    if (!old_hw || !*old_hw) {
        JsonMap* err = wsd_json_map_new();
        wsd_json_set(err, "success", "false");
        wsd_json_set(err, "message", "Current hardware_id unavailable.");
        return err;
    }
    if (strcmp(old_hw, new_hw) == 0) {
        JsonMap* err = wsd_json_map_new();
        wsd_json_set(err, "success", "false");
        wsd_json_set(err, "message", "Old and new hardware IDs are identical.");
        return err;
    }
    JsonMap* result = wsd_replace_device(engine->client, engine->license_key, new_hw, old_hw);
    const char* success = wsd_json_get(result, "success");
    if (success && strcmp(success, "true") == 0) {
        if (engine->cache) wsd_cache_invalidate_license_status(engine->cache);
        engine->has_status = 0;
        wsd_initialize(engine);
        wsd_cache_mark_has_ever_activated_paid_license(engine->cache);
    }
    return result;
}

JsonMap* wsd_bind_device_c(LicenseEngine* engine, const char* license_key, const char* device_name) {
    if (!license_key || !*license_key) license_key = engine->license_key;
    if (!license_key || !*license_key) {
        JsonMap* err = wsd_json_map_new();
        wsd_json_set(err, "success", "false");
        wsd_json_set(err, "message", "License key unavailable.");
        return err;
    }
    JsonMap* result = wsd_bind_device(engine->client, license_key, NULL, device_name);
    const char* success = wsd_json_get(result, "success");
    if (success && strcmp(success, "true") == 0) {
        wsd_initialize(engine);
        wsd_cache_mark_has_ever_activated_paid_license(engine->cache);
    }
    return result;
}

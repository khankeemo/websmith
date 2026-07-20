#include "widgets.h"
#include "activation.h"
#include "renewal.h"
#include "device_replace.h"
#include "welcome.h"
#include <stdio.h>
#include <string.h>

void wsd_dashboard_show(LicenseEngine* engine) {
    if (!engine) return;
    LicenseStatus* s = wsd_get_status(engine);
    if (!s) s = wsd_initialize(engine);
    printf("\n=== License Status ===\n");
    if (s && s->valid) {
        const char* label = s->trial_active ? "Trial Active" : "Licensed";
        printf("  Status: %s\n", label);
        printf("  Remaining days: %d\n", s->days_remaining);
        printf("  Expiry: %s\n", s->expires_at[0] ? s->expires_at : "N/A");
        printf("  Plan: %s\n", s->plan[0] ? s->plan : "N/A");
    } else {
        printf("  Status: Unlicensed\n");
        printf("  %s\n", s ? s->message : "No active license or trial");
    }
}

void wsd_settings_show(LicenseEngine* engine) {
    if (!engine) return;
    LicenseStatus* s = wsd_get_status(engine);
    if (!s) s = wsd_initialize(engine);
    printf("\n=== License Information ===\n");
    if (s) {
        printf("  Status: %s\n", s->status);
        printf("  Expiry: %s\n", s->expires_at[0] ? s->expires_at : "N/A");
        printf("  Plan: %s\n", s->plan[0] ? s->plan : "N/A");
        printf("  Hardware ID: %s\n", s->hardware_id[0] ? s->hardware_id : "--");
    }
    printf("\nActions:\n");
    printf("  1. Activate\n");
    printf("  2. Renew\n");
    printf("  3. Replace Device\n");
    printf("  4. Refresh\n");
    printf("  5. Open Welcome\n");
    printf("  Select (1-5): ");
    char input[8] = "";
    fgets(input, sizeof(input), stdin);
    if (input[0] == '1') {
        ActivationResult ar = wsd_activation_show(NULL, NULL);
        (void)ar;
        wsd_settings_show(engine);
    } else if (input[0] == '2') {
        if (engine->license_key[0]) {
            JsonMap* r = wsd_renewal_show(engine, engine->license_key);
            wsd_json_free(r);
        }
        wsd_settings_show(engine);
    } else if (input[0] == '3') {
        if (engine->license_key[0]) {
            JsonMap* r = wsd_device_replace_show(engine, engine->license_key);
            wsd_json_free(r);
        }
        wsd_settings_show(engine);
    } else if (input[0] == '4') {
        wsd_settings_show(engine);
    } else if (input[0] == '5') {
        CacheManager* cache = engine->cache;
        if (!cache) {
            cache = calloc(1, sizeof(CacheManager));
            snprintf(cache->cache_dir, sizeof(cache->cache_dir), "unknown");
        }
        WelcomeResult wr = wsd_welcome_show(engine->client, "", cache);
        (void)wr;
        if (!engine->cache) wsd_cache_free(cache);
        wsd_settings_show(engine);
    }
}

void wsd_status_show(LicenseEngine* engine) {
    if (!engine) return;
    LicenseStatus* s = wsd_get_status(engine);
    if (!s) s = wsd_initialize(engine);
    if (s && s->valid) {
        if (s->trial_active) {
            printf("  \xe2\x97\x8f Trial: %dd\n", s->days_remaining);
        } else {
            printf("  \xe2\x97\x8f Licensed: %dd\n", s->days_remaining);
        }
    } else {
        printf("  \xe2\x97\x8f %s\n", s ? s->message : "No license");
    }
}

void wsd_activation_button_show(LicenseEngine* engine) {
    if (!engine) return;
    printf("\n[Activate License]\n");
    printf("  Press Enter to activate or 'q' to quit: ");
    char input[8] = "";
    fgets(input, sizeof(input), stdin);
    if (input[0] != 'q' && input[0] != 'Q') {
        ActivationResult ar = wsd_activation_show(engine->client, NULL);
        if (ar.activated) {
            printf("  Status: Licensed\n");
        }
    }
}

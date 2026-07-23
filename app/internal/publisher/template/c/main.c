/*
 * WSD SDK C Example Application
 * 
 * This example demonstrates the complete lifecycle:
 * Application Start → Splash → wsd_initialize() → Internal API validates →
 * Final state (ACTIVE/TRIAL_ACTIVE) → Build Dashboard → Unlock UI → Start Services
 * 
 * Build: gcc -std=c11 -o wsd_example main.c -lwsd_sdk -lssl -lcrypto -lcurl
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "license_engine.h"
#include "activation.h"
#include "renewal.h"
#include "device_replace.h"
#include "welcome.h"
#include "widgets.h"

static void print_usage(const char* program) {
    printf("Usage: %s [config_path]\n", program);
    printf("  config_path - path to api-config.json (default: config/api-config.json)\n");
}

static void print_menu(void) {
    printf("\n--- SDK Actions ---\n");
    printf("  1. Initialize & Show Status\n");
    printf("  2. Activate License\n");
    printf("  3. Renew License\n");
    printf("  4. Replace Device\n");
    printf("  5. Start Trial (Welcome)\n");
    printf("  6. Show Dashboard Widget\n");
    printf("  7. Show Settings Widget\n");
    printf("  8. Show Status Widget\n");
    printf("  9. Exit\n");
    printf("  Choice: ");
}

int main(int argc, char* argv[]) {
    const char* config_path = "config/api-config.json";
    if (argc > 1) {
        if (strcmp(argv[1], "-h") == 0 || strcmp(argv[1], "--help") == 0) {
            print_usage(argv[0]);
            return 0;
        }
        config_path = argv[1];
    }

    printf("WSD SDK C Example ${kit_version}\n");
    printf("Config: %s\n", config_path);

    LicenseEngine* engine = wsd_engine_new(config_path);
    if (!engine) {
        fprintf(stderr, "ERROR: Failed to create LicenseEngine.\n");
        fprintf(stderr, "Make sure %s exists and is valid JSON.\n", config_path);
        return 1;
    }

    printf("SDK Engine created successfully.\n");

    int running = 1;
    while (running) {
        print_menu();
        char choice[8] = "";
        fgets(choice, sizeof(choice), stdin);

        switch (choice[0]) {
            case '1': {
                printf("\nInitializing...\n");
                LicenseStatus* status = wsd_initialize(engine);
                if (status) {
                    printf("  Status: %s\n", status->status);
                    printf("  Valid: %s\n", status->valid ? "yes" : "no");
                    printf("  Expires: %s\n", status->expires_at[0] ? status->expires_at : "N/A");
                    printf("  Days remaining: %d\n", status->days_remaining);
                    printf("  Plan: %s\n", status->plan[0] ? status->plan : "N/A");
                    printf("  Hardware ID: %s\n", status->hardware_id[0] ? status->hardware_id : "N/A");
                    printf("  Message: %s\n", status->message);
                }
                break;
            }
            case '2': {
                ActivationResult ar = wsd_activation_show(engine->client, NULL);
                printf("  Result: activated=%d, cancelled=%d\n",
                       ar.activated, ar.cancelled);
                break;
            }
            case '3': {
                const char* lk = wsd_get_license_key_c(engine);
                if (lk && *lk) {
                    JsonMap* r = wsd_renewal_show(engine, lk);
                    if (r) { wsd_json_free(r); }
                } else {
                    printf("  No license key found. Activate first.\n");
                }
                break;
            }
            case '4': {
                const char* lk = wsd_get_license_key_c(engine);
                if (lk && *lk) {
                    JsonMap* r = wsd_device_replace_show(engine, lk);
                    if (r) { wsd_json_free(r); }
                } else {
                    printf("  No license key found. Activate first.\n");
                }
                break;
            }
            case '5': {
                CacheManager* cache = engine->cache;
                WelcomeResult wr = wsd_welcome_show(engine->client, NULL, cache);
                printf("  Result: skipped=%d, onboarding=%d\n",
                       wr.skipped, wr.onboarding_complete);
                break;
            }
            case '6':
                wsd_dashboard_show(engine);
                break;
            case '7':
                wsd_settings_show(engine);
                break;
            case '8':
                wsd_status_show(engine);
                break;
            case '9':
                running = 0;
                break;
            default:
                printf("  Invalid choice. Try 1-9.\n");
                break;
        }
    }

    printf("\nCleaning up...\n");
    wsd_engine_free(engine);
    printf("Done.\n");
    return 0;
}

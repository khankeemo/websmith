#include "renewal.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
#else
#include <unistd.h>
#endif

static void print_separator(void) {
    printf("========================================\n");
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

static void print_label(const char* label, const char* value) {
    printf("  %s: %s\n", label, value ? value : "--");
}

static int read_selection(const char* prompt_text, int min_val, int max_val, int default_val) {
    char input[16] = "";
    printf("  %s (%d-%d) [%d]: ", prompt_text, min_val, max_val, default_val);
    fgets(input, sizeof(input), stdin);
    size_t len = strlen(input);
    if (len > 0 && input[len - 1] == '\n') input[len - 1] = '\0';
    if (input[0] == '\0') return default_val;
    int val = atoi(input);
    if (val < min_val || val > max_val) return default_val;
    return val;
}

static int confirm_renewal(void) {
    char confirm[16] = "";
    printf("  You are about to renew your license.\n");
    printf("  Type YES to confirm renewal: ");
    fgets(confirm, sizeof(confirm), stdin);
    size_t len = strlen(confirm);
    if (len > 0 && confirm[len - 1] == '\n') confirm[len - 1] = '\0';
    return (strcmp(confirm, "YES") == 0);
}

JsonMap* wsd_renewal_show(LicenseEngine* engine, const char* license_key) {
    JsonMap* result = NULL;
    print_separator();
    printf("  Renew License\n");
    print_separator();

    printf("\n--- Current License ---\n");
    if (engine) {
        print_label("Plan", engine->status.plan[0] ? engine->status.plan : "N/A");
        print_label("Expiry", engine->status.expires_at[0] ? engine->status.expires_at : "N/A");

        int days_left = engine->status.days_remaining;
        if (days_left > 0) {
            printf("  Days Remaining: %d\n", days_left);
            if (days_left <= 7) {
                printf("  Warning: License expires soon. Renew now to avoid interruption.\n");
            }
        } else if (days_left == 0 && engine->status.valid) {
            printf("  License expires today.\n");
        } else if (!engine->status.valid) {
            printf("  License has expired or is invalid.\n");
        }
    } else {
        print_label("Plan", "N/A");
        print_label("Expiry", "N/A");
    }

    printf("\n--- Renewal ---\n");

    if (!confirm_renewal()) {
        result = wsd_json_map_new();
        wsd_json_set(result, "success", "false");
        wsd_json_set(result, "message", "Renewal cancelled by user.");
        return result;
    }

    printf("\n  Processing renewal...\n");
    fflush(stdout);
    sleep_ms(500);

    if (engine && license_key && *license_key) {
        result = wsd_renew(engine, -1);
        if (result) {
            const char* success = wsd_json_get(result, "success");
            if (success && strcmp(success, "true") == 0) {
                printf("  License renewed successfully!\n");
                printf("  New expiry: +%d days from original expiry date.\n", extra_days);
            } else {
                const char* msg = wsd_json_get(result, "message");
                printf("  Renewal failed: %s\n", msg ? msg : "Unknown error");
            }
        }
    } else {
        result = wsd_json_map_new();
        wsd_json_set(result, "success", "false");
        wsd_json_set(result, "message", "No license key available for renewal.");
    }

    printf("\n  Thank you for renewing with us.\n");
    return result;
}

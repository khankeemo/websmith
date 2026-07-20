#include "device_replace.h"
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

static void print_loading_animation(const char* message, int steps) {
    printf("  %s", message);
    for (int i = 0; i < steps; ++i) {
        printf(".");
        fflush(stdout);
#ifdef _WIN32
        Sleep(200);
#else
        usleep(200000);
#endif
    }
    printf("\n");
}

static int get_device_name(char* buf, size_t buf_size) {
    printf("  Device Name [New Device]: ");
    if (!fgets(buf, (int)buf_size, stdin)) return 0;
    size_t len = strlen(buf);
    if (len > 0 && buf[len - 1] == '\n') buf[len - 1] = '\0';
    if (buf[0] == '\0') strncpy(buf, "New Device", buf_size);
    return 1;
}

static int confirm_replacement(void) {
    char confirm[16] = "";
    printf("  WARNING: This action cannot be undone.\n");
    printf("  Type YES to confirm replacement: ");
    fgets(confirm, sizeof(confirm), stdin);
    size_t len = strlen(confirm);
    if (len > 0 && confirm[len - 1] == '\n') confirm[len - 1] = '\0';
    return (strcmp(confirm, "YES") == 0);
}

JsonMap* wsd_device_replace_show(LicenseEngine* engine, const char* license_key) {
    JsonMap* result = NULL;
    print_separator();
    printf("  Replace Device\n");
    print_separator();

    printf("\n--- Device Replacement ---\n");
    printf("  Move your license from old device to this one.\n\n");

    const char* old_hw = "Unknown";
    if (engine && engine->status.hardware_id[0])
        old_hw = engine->status.hardware_id;

    const char* new_hw = "Unknown";
    if (engine && engine->hardware)
        new_hw = wsd_get_fingerprint(engine->hardware);

    printf("  Old Hardware ID: ");
    if (strlen(old_hw) > 48) {
        printf("%.48s...\n", old_hw);
    } else {
        printf("%s\n", old_hw);
    }

    printf("  New Hardware ID: ");
    if (strlen(new_hw) > 48) {
        printf("%.48s...\n", new_hw);
    } else {
        printf("%s\n", new_hw);
    }

    if (old_hw && new_hw && strcmp(old_hw, new_hw) == 0) {
        printf("\n  Warning: Old and new hardware IDs appear identical.\n");
        printf("  Replacement may not be necessary.\n");
    }

    char dev_name[128] = "New Device";
    get_device_name(dev_name, sizeof(dev_name));

    if (!confirm_replacement()) {
        result = wsd_json_map_new();
        wsd_json_set(result, "success", "false");
        wsd_json_set(result, "message", "Device replacement cancelled by user.");
        return result;
    }

    print_loading_animation("  Replacing device", 3);

    if (engine) {
        result = wsd_replace_hardware(engine);
        if (result) {
            const char* success = wsd_json_get(result, "success");
            if (success && strcmp(success, "true") == 0) {
                printf("\n  Device replaced successfully!\n");
                printf("  License is now bound to this device.\n");
            } else {
                const char* msg = wsd_json_get(result, "message");
                printf("\n  Device replacement failed: %s\n", msg ? msg : "Unknown error");
            }
        }
    } else {
        result = wsd_json_map_new();
        wsd_json_set(result, "success", "false");
        wsd_json_set(result, "message", "Engine is null.");
    }

    printf("\n  For assistance, contact: support@websmithdigital.com\n");
    return result;
}

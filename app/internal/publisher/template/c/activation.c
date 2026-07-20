#include "activation.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
#else
#include <unistd.h>
#endif

static char* prompt_line(const char* label) {
    printf("%s: ", label);
    char* input = malloc(512);
    if (!input) return NULL;
    if (!fgets(input, 512, stdin)) { free(input); return NULL; }
    size_t len = strlen(input);
    if (len > 0 && input[len - 1] == '\n') input[len - 1] = '\0';
    return input;
}

ActivationResult wsd_activation_show(ApiClient* client, const char* product_name) {
    ActivationResult result = {0, 0, ""};
    HardwareDetector* hw = client ? client->hardware : NULL;
    if (!hw) hw = wsd_hardware_new();

    printf("\n========================================\n");
    printf("  UNIVERSAL LICENSE ACTIVATION\n");
    printf("  Activate your license on this device\n");
    printf("========================================\n");

    printf("\n--- Hardware ---\n");
    const char* hw_id = wsd_get_fingerprint(hw);
    if (!hw_id || !*hw_id) {
        printf("  Unable to detect hardware.\n");
        result.cancelled = 1;
        if (!client) wsd_hardware_free(hw);
        return result;
    }
    printf("  Hardware ID: %s\n", hw_id);
    printf("  Device Bound: Verified\n");

    printf("\n--- Customer ---\n");
    char* name = prompt_line("  Customer Name");
    char* email = prompt_line("  Email");
    char* phone = prompt_line("  Mobile Number");

    if (!name || !email || !*name || !*email) {
        printf("  Name and email are required.\n");
        result.cancelled = 1;
        free(name); free(email); free(phone);
        if (!client) wsd_hardware_free(hw);
        return result;
    }

    printf("\n--- License ---\n");
    char* lk = prompt_line("  License Key");
    if (lk && *lk) strncpy(result.license_key, lk, sizeof(result.license_key) - 1);
    free(lk);

    char* action = prompt_line("  [A]ctivate  [C]ancel");
    if (action && (action[0] == 'A' || action[0] == 'a') && result.license_key[0]) {
        printf("  Syncing customer...\n");
        if (client) {
            JsonMap* cr = wsd_update_customer(client, name, email, phone ? phone : "", hw_id);
            if (cr) { wsd_json_free(cr); }
            printf("  Activating license...\n");
            JsonMap* act = wsd_activate_license(client, result.license_key, hw_id);
            if (act) {
                const char* success = wsd_json_get(act, "success");
                if (success && strcmp(success, "true") == 0) {
                    result.activated = 1;
                    printf("  License activated successfully!\n");
                } else {
                    const char* msg = wsd_json_get(act, "message");
                    printf("  Activation failed: %s\n", msg ? msg : "Unknown error");
                }
                wsd_json_free(act);
            } else {
                printf("  Activation error: No response.\n");
            }
        }
    } else {
        result.cancelled = 1;
    }

    printf("\nDevice Binding Notice:\n");
    printf("  This device will be permanently linked.\n");
    printf("  Contact support@websmithdigital.com for device replacement.\n");

    free(name); free(email); free(phone); free(action);
    if (!client) wsd_hardware_free(hw);
    return result;
}

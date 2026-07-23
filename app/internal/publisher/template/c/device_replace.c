#include "device_replace.h"
#include <stdio.h>
#include <string.h>

JsonMap* wsd_device_replace_show(LicenseEngine* engine, const char* license_key) {
    (void)license_key;

    const char* support_email = "support@websmithdigital.com";
    if (engine && engine->config) {
        const char* branding_str = wsd_json_get(engine->config, "branding_json");
        if (branding_str) {
            JsonMap* branding = wsd_json_parse(branding_str);
            if (branding) {
                const char* email = wsd_json_get(branding, "support_email");
                if (email) support_email = email;
                wsd_json_free(branding);
            }
        }
    }

    printf("========================================\n");
    printf("  Replace Device\n");
    printf("========================================\n");
    printf("\n");
    printf("  Device reactivation requires Websmith Support approval.\n");
    printf("\n");
    printf("  Please contact support at: %s\n", support_email);
    printf("  The application will remain locked until reactivation is approved.\n");
    printf("\n");

    JsonMap* result = wsd_json_map_new();
    wsd_json_set(result, "action", "contact_support");
    wsd_json_set(result, "support_email", support_email);
    return result;
}

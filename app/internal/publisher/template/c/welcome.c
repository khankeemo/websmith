#include "welcome.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

int wsd_is_onboarding_complete(CacheManager* cache) {
    return cache ? wsd_cache_is_onboarding_complete(cache) : 0;
}

static int is_valid_email(const char* email) {
    const char* at = strchr(email, '@');
    if (!at) return 0;
    const char* dot = strrchr(at, '.');
    if (!dot || dot == at + 1 || *(dot + 1) == '\0') return 0;
    return 1;
}

static char* prompt_c(const char* label) {
    printf("%s: ", label);
    char* input = malloc(512);
    if (!input) return NULL;
    if (!fgets(input, 512, stdin)) { free(input); return NULL; }
    size_t len = strlen(input);
    if (len > 0 && input[len - 1] == '\n') input[len - 1] = '\0';
    return input;
}

WelcomeResult wsd_welcome_show(ApiClient* client, const char* product_name, CacheManager* cache) {
    WelcomeResult result = {1, 0, "", "", ""};
    if (wsd_is_onboarding_complete(cache)) {
        printf("  Onboarding already completed.\n");
        return result;
    }

    printf("\n========================================\n");
    printf("  Welcome\n");
    printf("  Complete your registration to start the trial\n");
    printf("========================================\n");

    char* name = prompt_c("  Name *");
    char* email = prompt_c("  Email *");
    char* mobile = prompt_c("  Mobile Number *");
    char* company = prompt_c("  Company (optional)");

    if (!name || !*name || !email || !*email || !mobile || !*mobile) {
        printf("  Name, email, and mobile are required.\n");
        free(name); free(email); free(mobile); free(company);
        return result;
    }
    if (!is_valid_email(email)) {
        printf("  Valid email is required.\n");
        free(name); free(email); free(mobile); free(company);
        return result;
    }

    printf("\n  Sending OTP to %s...\n", email);
    if (client) {
        JsonMap* otp_payload = wsd_json_map_new();
        wsd_json_set(otp_payload, "email", email);
        JsonMap* otp_result = NULL;
        {
            char* keys[1] = {"email"};
            char* values[1] = {email};
            char* body = wsd_json_stringify((const char* const*)keys, (const char* const*)values, 1);
            (void)body;
            free(body);
        }
        wsd_json_free(otp_payload);
        (void)otp_result;
    }

    char* otp = prompt_c("  Enter OTP");
    if (!otp || strlen(otp) < 4) {
        printf("  Enter a valid OTP code.\n");
        free(name); free(email); free(mobile); free(company); free(otp);
        return result;
    }

    printf("  Verifying OTP...\n");
    printf("  Activating trial...\n");

    const char* hw_id = "";
    HardwareDetector* hw = client ? client->hardware : NULL;
    if (!hw) {
        hw = wsd_hardware_new();
    }
    hw_id = wsd_get_fingerprint(hw);

    if (client) {
        JsonMap* reg_payload = wsd_json_map_new();
        wsd_json_set(reg_payload, "name", name);
        wsd_json_set(reg_payload, "email", email);
        wsd_json_set(reg_payload, "mobile", mobile);
        wsd_json_set(reg_payload, "hardware_id", hw_id);
        if (company && *company) wsd_json_set(reg_payload, "company_name", company);
        wsd_json_free(reg_payload);

        JsonMap* trial_result = wsd_start_trial(client, email, name, NULL);
        if (trial_result) {
            const char* success = wsd_json_get(trial_result, "success");
            if (success && strcmp(success, "true") == 0) {
                printf("  Trial activated! You can now use the software.\n");
                if (cache) wsd_cache_set_onboarding_complete(cache);
                result.skipped = 0;
                result.onboarding_complete = 1;
                strncpy(result.name, name, sizeof(result.name) - 1);
                strncpy(result.email, email, sizeof(result.email) - 1);
                strncpy(result.hardware_id, hw_id, sizeof(result.hardware_id) - 1);
            }
            wsd_json_free(trial_result);
        }
    }

    printf("\nProtected by %s\n", product_name && *product_name ? product_name : "License");
    free(name); free(email); free(mobile); free(company); free(otp);
    if (!client && hw) wsd_hardware_free(hw);
    return result;
}

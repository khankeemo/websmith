#pragma once
#include <string>
#include <map>
#include <vector>

struct ProductConfig {
    std::string id;
    std::string name;
    std::string version;
    std::string description;
};

struct ApiConfig {
    std::string url;
    std::string version;
    std::string public_key;
    std::string secret;
    double timeout = 30.0;
    int retry_count = 3;
};

struct BrandingColors {
    std::string primary;
    std::string secondary;
    std::string accent;
    std::string success = "#16a34a";
    std::string warning = "#f59e0b";
    std::string error = "#dc2626";
    std::string info = "#10b981";
    std::string gray = "#6b7280";
    std::string bg_page = "#f8f9fa";
    std::string bg_card = "#ffffff";
    std::string bg_button = "#e5e7eb";
    std::string text_primary = "#333333";
    std::string text_secondary = "#555555";
    std::string text_muted = "#888888";
    std::string text_dark = "#666666";
};

struct SdkConfig {
    ProductConfig product;
    ApiConfig api;
    std::string trial_message;
    bool trial_enabled = true;
    int trial_days = 14;
    bool require_email = true;
    bool require_company = false;
    bool auto_convert = false;
    bool hardware_binding = true;
    int max_devices = 1;
    int offline_days = 0;
    int renewal_reminder_days = 7;
    bool include_cpu = true;
    bool include_motherboard = true;
    bool include_mac = true;
    bool include_os = true;
    std::string hash_algorithm = "sha256";
    bool replacement_enabled = true;
    bool require_approval = false;
    int max_replacements_per_year = 2;
    bool offline_enabled = true;
    int cache_days = 30;
    std::string encryption = "AES-256-GCM";
    bool validate_on_reconnect = true;
    std::string hmac_algorithm = "SHA256";
    int timestamp_window = 300;
    bool require_nonce = true;
    int rate_limit_per_minute = 100;
    int rate_limit_per_hour = 1000;
    std::string company_name;
    std::string logo_url = "/assets/logo.svg";
    std::string primary_color;
    std::string secondary_color;
    std::string accent_color;
    std::string support_email = "support@websmithdigital.com";
    std::string support_url;
    BrandingColors colors;
    std::map<std::string, std::string> labels;
    std::string theme = "auto";
    std::string language = "en";
    bool ui_modal = true;
    bool ui_animations = true;
    bool dialog_trial = true;
    bool dialog_activation = true;
    bool dialog_renewal = true;
    bool dialog_expired = true;
    bool dialog_offline = true;
    bool dialog_hardware_change = true;
    bool feature_trial = true;
    bool feature_license = true;
    bool feature_hardware_binding = true;
    bool feature_offline_mode = true;
    bool feature_renewals = true;
    bool feature_analytics = true;
    bool feature_audit_logs = true;

    std::string get_label(const std::string& key, const std::string& fallback) const;
    static SdkConfig load(const std::string& path);
    static SdkConfig default_config();
};

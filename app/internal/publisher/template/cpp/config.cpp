#include "config.h"
#include "crypto.h"
#include <fstream>
#include <sstream>
#include <algorithm>
#include <cctype>

std::string SdkConfig::get_label(const std::string& key, const std::string& fallback) const {
    auto it = labels.find(key);
    if (it != labels.end() && !it->second.empty()) return it->second;
    return fallback;
}

static std::string trim_str(const std::string& s) {
    size_t start = s.find_first_not_of(" \t\r\n\"");
    if (start == std::string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n\"");
    return s.substr(start, end - start + 1);
}

static std::string read_file(const std::string& path) {
    std::ifstream f(path);
    if (!f.is_open()) return "";
    return std::string((std::istreambuf_iterator<char>(f)),
                        std::istreambuf_iterator<char>());
}

static std::map<std::string, std::string> parse_json_map(const std::string& json) {
    std::map<std::string, std::string> result;
    size_t pos = 0;
    auto skip = [&]() {
        while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t' ||
               json[pos] == '\n' || json[pos] == '\r')) ++pos;
    };
    skip();
    if (pos >= json.size() || json[pos] != '{') return result;
    ++pos;
    while (pos < json.size()) {
        skip();
        if (pos >= json.size() || json[pos] == '}') break;
        std::string key;
        if (json[pos] == '"') {
            ++pos;
            while (pos < json.size() && json[pos] != '"') {
                if (json[pos] == '\\' && pos + 1 < json.size()) { key += json[pos + 1]; pos += 2; }
                else { key += json[pos]; ++pos; }
            }
            if (pos < json.size()) ++pos;
        }
        skip();
        if (pos < json.size() && json[pos] == ':') ++pos;
        skip();
        std::string val;
        if (pos < json.size() && json[pos] == '"') {
            ++pos;
            while (pos < json.size() && json[pos] != '"') {
                if (json[pos] == '\\' && pos + 1 < json.size()) { val += json[pos + 1]; pos += 2; }
                else { val += json[pos]; ++pos; }
            }
            if (pos < json.size()) ++pos;
        } else if (pos < json.size() && json[pos] == '{') {
            int depth = 1; val += json[pos]; ++pos;
            while (pos < json.size() && depth > 0) {
                if (json[pos] == '{') ++depth;
                else if (json[pos] == '}') --depth;
                val += json[pos]; ++pos;
            }
        } else {
            while (pos < json.size() && json[pos] != ',' && json[pos] != '}' && json[pos] != '\n') {
                val += json[pos]; ++pos;
            }
        }
        result[trim_str(key)] = trim_str(val);
        skip();
        if (pos < json.size() && json[pos] == ',') ++pos;
    }
    return result;
}

SdkConfig SdkConfig::load(const std::string& path) {
    SdkConfig cfg = default_config();
    std::string content = read_file(path);
    if (content.empty()) return cfg;
    auto root = parse_json_map(content);

    auto product_map = parse_json_map(root["product"]);
    cfg.product.id = product_map["id"];
    cfg.product.name = product_map["name"];
    cfg.product.version = product_map["version"];
    cfg.product.description = product_map["description"];

    auto api_map = parse_json_map(root["api"]);
    cfg.api.url = api_map["url"];
    cfg.api.version = api_map["version"] != "" ? api_map["version"] : "v1";
    cfg.api.public_key = api_map["public_key"];
    cfg.api.secret = api_map["secret"];
    if (!api_map["timeout"].empty()) cfg.api.timeout = std::stod(api_map["timeout"]) / 1000.0;
    if (!api_map["retry_count"].empty()) cfg.api.retry_count = std::stoi(api_map["retry_count"]);

    auto trial_map = parse_json_map(root["trial"]);
    cfg.trial_enabled = trial_map["enabled"] != "false";
    if (!trial_map["days"].empty()) cfg.trial_days = std::stoi(trial_map["days"]);
    cfg.require_email = trial_map["require_email"] != "false";
    cfg.require_company = trial_map["require_company"] == "true";
    cfg.auto_convert = trial_map["auto_convert"] == "true";
    cfg.trial_message = trial_map["message"];

    auto lic_map = parse_json_map(root["license"]);
    cfg.hardware_binding = lic_map["hardware_binding"] != "false";
    if (!lic_map["max_devices"].empty()) cfg.max_devices = std::stoi(lic_map["max_devices"]);
    if (!lic_map["offline_days"].empty()) cfg.offline_days = std::stoi(lic_map["offline_days"]);
    if (!lic_map["renewal_reminder_days"].empty()) cfg.renewal_reminder_days = std::stoi(lic_map["renewal_reminder_days"]);

    auto hw_map = parse_json_map(root["fingerprint"]);
    auto fp = parse_json_map(hw_map["fingerprint"]);
    cfg.include_cpu = fp["include_cpu"] != "false";
    cfg.include_motherboard = fp["include_motherboard"] != "false";
    cfg.include_mac = fp["include_mac"] != "false";
    cfg.include_os = fp["include_os"] != "false";
    cfg.hash_algorithm = fp["hash_algorithm"] != "" ? fp["hash_algorithm"] : "sha256";

    auto repl = parse_json_map(root["replacement"]);
    cfg.replacement_enabled = repl["enabled"] != "false";
    cfg.require_approval = repl["require_approval"] == "true";
    if (!repl["max_replacements_per_year"].empty()) cfg.max_replacements_per_year = std::stoi(repl["max_replacements_per_year"]);

    auto off = parse_json_map(root["offline"]);
    cfg.offline_enabled = off["enabled"] != "false";
    if (!off["cache_days"].empty()) cfg.cache_days = std::stoi(off["cache_days"]);
    cfg.encryption = off["encryption"] != "" ? off["encryption"] : "AES-256-GCM";
    cfg.validate_on_reconnect = off["validate_on_reconnect"] != "false";

    auto sec = parse_json_map(root["security"]);
    cfg.hmac_algorithm = sec["hmac_algorithm"] != "" ? sec["hmac_algorithm"] : "SHA256";
    if (!sec["timestamp_window"].empty()) cfg.timestamp_window = std::stoi(sec["timestamp_window"]);
    cfg.require_nonce = sec["require_nonce"] != "false";

    auto brand = parse_json_map(root["branding"]);
    cfg.company_name = brand["company_name"];
    cfg.logo_url = brand["logo_url"] != "" ? brand["logo_url"] : "/assets/logo.svg";
    cfg.primary_color = brand["primary_color"];
    cfg.secondary_color = brand["secondary_color"];
    cfg.accent_color = brand["accent_color"];
    cfg.support_email = brand["support_email"] != "" ? brand["support_email"] : "support@websmithdigital.com";
    cfg.support_url = brand["support_url"];

    auto lbls = parse_json_map(brand["labels"]);
    for (const auto& [k, v] : lbls) cfg.labels[k] = v;

    return cfg;
}

SdkConfig SdkConfig::default_config() {
    SdkConfig cfg;
    cfg.trial_days = 14;
    cfg.max_devices = 1;
    cfg.offline_days = 0;
    cfg.cache_days = 30;
    cfg.api.url = "${api_url}";
    cfg.api.version = "v1";
    cfg.api.timeout = 30.0;
    cfg.api.retry_count = 3;
    cfg.support_email = "support@websmithdigital.com";
    return cfg;
}

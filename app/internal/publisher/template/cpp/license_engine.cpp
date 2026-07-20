#include "license_engine.h"
#include "client.h"
#include "hardware.h"
#include "cache.h"
#include "config.h"
#include <fstream>
#include <filesystem>
#include <stdexcept>

namespace fs = std::filesystem;

LicenseStatus LicenseStatus::from_dict(const std::map<std::string, std::string>& data) {
    LicenseStatus s;
    s.valid = data.count("valid") && data.at("valid") == "true";
    auto it = data.find("status");
    s.status = (it != data.end()) ? it->second : "unlicensed";
    it = data.find("expires_at");
    if (it != data.end()) s.expires_at = it->second;
    it = data.find("days_remaining");
    if (it != data.end()) s.days_remaining = std::stoi(it->second);
    it = data.find("plan");
    if (it != data.end()) s.plan = it->second;
    it = data.find("hardware_id");
    if (it != data.end()) s.hardware_id = it->second;
    it = data.find("message");
    if (it != data.end()) s.message = it->second;
    it = data.find("license_key");
    if (it != data.end()) s.license_key = it->second;
    it = data.find("trial_active");
    s.trial_active = (it != data.end()) ? (it->second == "true") : (s.status == "trial");
    return s;
}

std::map<std::string, std::string> LicenseStatus::to_dict() const {
    std::map<std::string, std::string> d;
    d["valid"] = valid ? "true" : "false";
    d["status"] = status;
    if (!expires_at.empty()) d["expires_at"] = expires_at;
    d["days_remaining"] = std::to_string(days_remaining);
    if (!plan.empty()) d["plan"] = plan;
    if (!hardware_id.empty()) d["hardware_id"] = hardware_id;
    if (!message.empty()) d["message"] = message;
    if (!license_key.empty()) d["license_key"] = license_key;
    d["trial_active"] = trial_active ? "true" : "false";
    return d;
}

LicenseEngine::LicenseEngine(const std::string& config_path) {
    config = load_config(config_path.empty() ? find_config_path("") : config_path);
    hardware_ = std::make_shared<HardwareDetector>();
    cache_ = std::make_shared<CacheManager>(config);
    client_ = std::make_shared<ApiClient>(config, hardware_, cache_);
}

LicenseEngine::~LicenseEngine() {}

std::string LicenseEngine::find_config_path(const std::string& config_path) {
    if (!config_path.empty() && fs::exists(config_path)) return config_path;
    std::vector<std::string> candidates = {
        "config/api-config.json",
        "../config/api-config.json",
    };
    for (const auto& p : candidates) {
        if (fs::exists(p)) return fs::absolute(p).string();
    }
    return config_path;
}

std::map<std::string, std::string> LicenseEngine::load_config(const std::string& config_path) {
    std::map<std::string, std::string> cfg;
    if (!fs::exists(config_path)) {
        cfg["product_json"] = "{}";
        cfg["api_json"] = "{}";
        cfg["offline_json"] = "{}";
        cfg["branding_json"] = "{}";
        cfg["trial_json"] = "{}";
        cfg["license_json"] = "{}";
        cfg["hardware_json"] = "{}";
        cfg["security_json"] = "{}";
        cfg["features_json"] = "{}";
        return cfg;
    }
    std::ifstream f(config_path);
    std::string content((std::istreambuf_iterator<char>(f)),
                         std::istreambuf_iterator<char>());
    f.close();
    auto root = json_parse(content);
    for (const auto& [k, v] : root) {
        cfg[k + "_json"] = v;
    }
    auto prod = json_parse(root["product"]);
    for (const auto& [k, v] : prod) cfg["product_" + k] = v;
    auto api = json_parse(root["api"]);
    for (const auto& [k, v] : api) cfg["api_" + k] = v;
    auto lic = json_parse(root["license"]);
    for (const auto& [k, v] : lic) cfg["license_" + k] = v;
    auto trial = json_parse(root["trial"]);
    for (const auto& [k, v] : trial) cfg["trial_" + k] = v;
    return cfg;
}

LicenseStatus LicenseEngine::initialize() {
    if (cache_->is_valid()) {
        auto cached = cache_->get_license_status();
        if (cached) {
            status_ = LicenseStatus::from_dict(*cached);
            has_status_ = true;
            return status_;
        }
    }
    try {
        std::string hardware_id = hardware_->get_fingerprint();
        auto trial_response = client_->get_trial_status(hardware_id);
        std::string data_json = trial_response["data_json"];
        auto trial_data = json_parse(data_json);
        if (trial_data["has_trial"] == "true") {
            std::string status_str = trial_data["status"];
            if (status_str.empty()) status_str = "trial";
            status_.valid = (status_str == "active");
            status_.status = status_str;
            status_.expires_at = trial_data["expiry_date"];
            auto dl = trial_data.find("days_left");
            status_.days_remaining = (dl != trial_data.end() && !dl->second.empty())
                ? std::stoi(dl->second) : 0;
            status_.plan = trial_data["plan"];
            status_.hardware_id = hardware_id;
            status_.message = "Trial is " + status_str;
            status_.trial_active = true;
            has_status_ = true;
            if (status_.valid) cache_->set_license_status(status_.to_dict());
            return status_;
        }
        status_.valid = false;
        status_.status = "unlicensed";
        status_.hardware_id = hardware_id;
        status_.message = "No license or trial found";
        has_status_ = true;
        return status_;
    } catch (const std::exception& e) {
        auto cached = cache_->get_license_status();
        if (cached) {
            status_ = LicenseStatus::from_dict(*cached);
            has_status_ = true;
            return status_;
        }
        status_.valid = false;
        status_.status = "error";
        status_.message = std::string("Unexpected error: ") + e.what();
        has_status_ = true;
        return status_;
    }
}

std::string LicenseEngine::get_hardware_id() {
    return hardware_->get_fingerprint();
}

LicenseStatus* LicenseEngine::get_status() {
    return has_status_ ? &status_ : nullptr;
}

std::string LicenseEngine::get_license_key() {
    return license_key_;
}

bool LicenseEngine::has_license_key() {
    return !license_key_.empty();
}

std::map<std::string, std::string> LicenseEngine::validate(const std::string& license_key) {
    std::string key = license_key.empty() ? license_key_ : license_key;
    if (key.empty()) {
        std::map<std::string, std::string> err;
        err["success"] = "false";
        err["message"] = "License key unavailable. Please activate first.";
        return err;
    }
    std::string hardware_id = hardware_->get_fingerprint();
    auto result = client_->validate_license(key, hardware_id);
    auto data = json_parse(result["data_json"]);
    if (data["valid"] == "true") {
        if (!data["license_key"].empty()) license_key_ = data["license_key"];
        initialize();
    }
    return result;
}

std::map<std::string, std::string> LicenseEngine::activate(const std::string& license_key) {
    auto result = client_->activate_license(license_key);
    if (result["success"] == "true") {
        license_key_ = license_key;
        initialize();
    }
    return result;
}

std::map<std::string, std::string> LicenseEngine::start_trial(
    const std::string& email, const std::string& customer_name,
    const std::map<std::string, std::string>& customer_data) {
    auto result = client_->start_trial(email, customer_name, customer_data);
    if (result["success"] == "true") initialize();
    return result;
}

std::map<std::string, std::string> LicenseEngine::convert_trial(
    const std::string& plan, const std::string& customer_name,
    const std::string& customer_email) {
    auto status = initialize();
    if (status.status != "trial") {
        std::map<std::string, std::string> err;
        err["success"] = "false";
        err["message"] = "No active trial to convert.";
        return err;
    }
    std::string hardware_id = hardware_->get_fingerprint();
    auto result = client_->convert_trial(hardware_id, plan, customer_name, customer_email);
    if (result["success"] == "true") {
        if (result.count("license_key")) license_key_ = result["license_key"];
        initialize();
    }
    return result;
}

std::map<std::string, std::string> LicenseEngine::renew(int extra_days) {
    if (license_key_.empty()) {
        std::map<std::string, std::string> err;
        err["success"] = "false";
        err["message"] = "License key unavailable. Please activate first.";
        return err;
    }
    auto result = client_->renew_license(license_key_, extra_days);
    if (result["success"] == "true") initialize();
    return result;
}

std::map<std::string, std::string> LicenseEngine::deactivate(const std::string& license_key) {
    std::string key = license_key.empty() ? license_key_ : license_key;
    if (key.empty()) {
        std::map<std::string, std::string> err;
        err["success"] = "false";
        err["message"] = "License key unavailable. Please provide a key.";
        return err;
    }
    auto result = client_->deactivate_license(key);
    if (result["success"] == "true") {
        cache_->invalidate_license_status();
        has_status_ = false;
        if (license_key.empty()) license_key_.clear();
    }
    return result;
}

std::map<std::string, std::string> LicenseEngine::replace_hardware() {
    if (license_key_.empty()) {
        std::map<std::string, std::string> err;
        err["success"] = "false";
        err["message"] = "License key unavailable. Please activate first.";
        return err;
    }
    std::string new_hardware_id = hardware_->get_fingerprint();
    std::string old_hardware_id;
    if (has_status_ && !status_.hardware_id.empty())
        old_hardware_id = status_.hardware_id;
    if (old_hardware_id.empty()) {
        auto cached = cache_->get_license_status();
        if (cached) old_hardware_id = (*cached)["hardware_id"];
    }
    if (old_hardware_id.empty()) {
        std::map<std::string, std::string> err;
        err["success"] = "false";
        err["message"] = "Current hardware_id unavailable. Cannot replace device.";
        return err;
    }
    if (old_hardware_id == new_hardware_id) {
        std::map<std::string, std::string> err;
        err["success"] = "false";
        err["message"] = "Old and new hardware IDs are identical.";
        return err;
    }
    auto result = client_->replace_device(license_key_, new_hardware_id, old_hardware_id);
    if (result["success"] == "true") {
        cache_->invalidate_license_status();
        has_status_ = false;
        initialize();
    }
    return result;
}

std::map<std::string, std::string> LicenseEngine::bind_device(
    const std::string& license_key, const std::string& device_name) {
    std::string key = license_key.empty() ? license_key_ : license_key;
    if (key.empty()) {
        std::map<std::string, std::string> err;
        err["success"] = "false";
        err["message"] = "License key unavailable.";
        return err;
    }
    auto result = client_->bind_device(key, "", device_name);
    if (result["success"] == "true") initialize();
    return result;
}

std::map<std::string, std::string> LicenseEngine::get_plans() {
    return client_->get_products();
}

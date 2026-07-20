#pragma once
#include <string>
#include <map>
#include <memory>
#include <optional>

class ApiClient;
class HardwareDetector;
class CacheManager;

struct LicenseStatus {
    bool valid = false;
    std::string status;
    std::string expires_at;
    int days_remaining = 0;
    std::string plan;
    std::string hardware_id;
    std::string message;
    std::string license_key;
    bool trial_active = false;

    std::map<std::string, std::string> to_dict() const;
    static LicenseStatus from_dict(const std::map<std::string, std::string>& data);
};

class LicenseEngine {
public:
    LicenseEngine(const std::string& config_path = "");
    ~LicenseEngine();

    LicenseStatus initialize();
    std::string get_hardware_id();
    LicenseStatus* get_status();
    std::string get_license_key();
    bool has_license_key();
    std::map<std::string, std::string> validate(const std::string& license_key = "");
    std::map<std::string, std::string> activate(const std::string& license_key);
    std::map<std::string, std::string> start_trial(
        const std::string& email,
        const std::string& customer_name = "",
        const std::map<std::string, std::string>& customer_data = {});
    std::map<std::string, std::string> convert_trial(
        const std::string& plan = "",
        const std::string& customer_name = "",
        const std::string& customer_email = "");
    std::map<std::string, std::string> renew(int extra_days = -1);
    std::map<std::string, std::string> deactivate(const std::string& license_key = "");
    std::map<std::string, std::string> replace_hardware();
    std::map<std::string, std::string> bind_device(
        const std::string& license_key = "",
        const std::string& device_name = "");
    std::map<std::string, std::string> get_plans();

    std::map<std::string, std::string> config;

private:
    std::shared_ptr<HardwareDetector> hardware_;
    std::shared_ptr<CacheManager> cache_;
    std::shared_ptr<ApiClient> client_;
    LicenseStatus status_;
    std::string license_key_;
    bool has_status_ = false;

    std::map<std::string, std::string> load_config(const std::string& config_path);
    std::string find_config_path(const std::string& config_path);
};

#pragma once
#include <string>
#include <map>
#include <memory>
#include <functional>

class HardwareDetector;
class CacheManager;

struct ApiError {
    int status_code = 0;
    std::string message;
    std::map<std::string, std::string> data;
};

class ApiClient {
public:
    ApiClient(const std::map<std::string, std::string>& config,
              std::shared_ptr<HardwareDetector> hardware = nullptr,
              std::shared_ptr<CacheManager> cache = nullptr);
    ~ApiClient();

    std::map<std::string, std::string> validate_license(
        const std::string& license_key, const std::string& hardware_id = "");
    std::map<std::string, std::string> activate_license(
        const std::string& license_key, const std::string& hardware_id = "");
    std::map<std::string, std::string> deactivate_license(
        const std::string& license_key, const std::string& hardware_id = "");
    std::map<std::string, std::string> renew_license(
        const std::string& license_key, int extra_days = -1);
    std::map<std::string, std::string> start_trial(
        const std::string& email, const std::string& customer_name = "",
        const std::map<std::string, std::string>& customer_data = {});
    std::map<std::string, std::string> get_trial_status(
        const std::string& hardware_id = "");
    std::map<std::string, std::string> convert_trial(
        const std::string& hardware_id = "", const std::string& plan = "",
        const std::string& customer_name = "", const std::string& customer_email = "");
    std::map<std::string, std::string> bind_device(
        const std::string& license_key, const std::string& hardware_id = "",
        const std::string& device_name = "");
    std::map<std::string, std::string> replace_device(
        const std::string& license_key, const std::string& new_hardware_id = "",
        const std::string& old_hardware_id = "");
    std::map<std::string, std::string> get_products();
    std::map<std::string, std::string> update_customer(
        const std::string& name, const std::string& email,
        const std::string& phone, const std::string& hardware_id = "");

private:
    std::map<std::string, std::string> config_;
    std::map<std::string, std::string> api_config_;
    std::string base_url_;
    std::string api_version_;
    std::string api_key_;
    std::string api_secret_;
    double timeout_;
    int retry_count_;
    std::string product_id_;
    std::shared_ptr<HardwareDetector> hardware_;
    std::shared_ptr<CacheManager> cache_;

    std::string get_hardware_id();
    std::map<std::string, std::string> sign_request(
        const std::map<std::string, std::string>& payload,
        const std::string& method = "POST",
        const std::string& path = "",
        const std::string& query = "");
    std::map<std::string, std::string> request(
        const std::string& endpoint,
        const std::map<std::string, std::string>& payload,
        int retries = -1);
    std::string http_post(const std::string& url,
                          const std::string& body,
                          const std::map<std::string, std::string>& headers,
                          int& status_code);
    std::string http_get(const std::string& url,
                         const std::map<std::string, std::string>& headers,
                         int& status_code);
};

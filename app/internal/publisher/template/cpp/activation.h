#pragma once
#include <string>
#include <map>
#include <memory>
#include <vector>
#include <functional>

class LicenseEngine;
class ApiClient;
class HardwareDetector;
class CacheManager;

struct ActivationResult {
    bool activated = false;
    bool cancelled = false;
    std::string license_key;
};

class ActivationDialog {
public:
    ActivationDialog(std::shared_ptr<ApiClient> client,
                     const std::string& product_name = "",
                     std::shared_ptr<CacheManager> cache = nullptr);
    ActivationResult show();

private:
    std::map<std::string, std::string> config_;
    std::shared_ptr<ApiClient> client_;
    std::string product_name_;
    std::shared_ptr<CacheManager> cache_;
    std::shared_ptr<HardwareDetector> hardware_;
    std::string hardware_id_;
    std::string device_name_;
    std::string platform_;
    std::string license_key_;
    bool activated_ = false;
    bool cancelled_ = false;
    std::string customer_name_;
    std::string customer_email_;
    std::string customer_phone_;
    bool hardware_ok_ = false;
    bool initialized_ = false;
    ActivationResult result_;
    std::string primary_color_;
    std::string error_color_ = "#dc2626";
    std::string success_color_ = "#16a34a";

    void detect_hardware();
    void on_activate();
    void on_refresh();
    void sync_customer();
    void update_ui(const std::map<std::string, std::string>& data);
    void fetch_trial_status();
    std::map<std::string, std::string> load_api_config();
    void print_status(const std::string& msg, const std::string& color);
    void print_banner();
    void print_hardware_section();
    void print_customer_form();
    void print_product_selection();
    std::string prompt(const std::string& label, const std::string& def = "");
};

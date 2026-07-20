#include "activation.h"
#include "client.h"
#include "hardware.h"
#include "cache.h"
#include "crypto.h"
#include <iostream>
#include <sstream>
#include <thread>
#include <chrono>
#include <algorithm>
#include <cctype>

ActivationDialog::ActivationDialog(std::shared_ptr<ApiClient> client,
                                     const std::string& product_name,
                                     std::shared_ptr<CacheManager> cache)
    : client_(client), product_name_(product_name), cache_(cache) {
    hardware_ = std::make_shared<HardwareDetector>();
    config_ = load_api_config();
    if (product_name_.empty()) {
        auto prod = json_parse(config_["product_json"]);
        product_name_ = prod["name"];
    }
    auto brand = json_parse(config_["branding_json"]);
    primary_color_ = brand["primary_color"];
}

std::map<std::string, std::string> ActivationDialog::load_api_config() {
    std::map<std::string, std::string> cfg;
    std::vector<std::string> paths = {"config/api-config.json", "../config/api-config.json"};
    for (const auto& p : paths) {
        std::ifstream f(p);
        if (f.is_open()) {
            std::string content((std::istreambuf_iterator<char>(f)),
                                 std::istreambuf_iterator<char>());
            f.close();
            auto root = json_parse(content);
            for (const auto& [k, v] : root) cfg[k + "_json"] = v;
            auto prod = json_parse(root["product"]);
            for (const auto& [k, v] : prod) cfg["product_" + k] = v;
            auto api = json_parse(root["api"]);
            for (const auto& [k, v] : api) cfg["api_" + k] = v;
            break;
        }
    }
    return cfg;
}

void ActivationDialog::print_status(const std::string& msg, const std::string& color) {
    std::cout << "  [" << color << "] " << msg << "\033[0m" << std::endl;
}

void ActivationDialog::print_banner() {
    std::cout << "\n========================================" << std::endl;
    std::cout << "  UNIVERSAL LICENSE ACTIVATION" << std::endl;
    std::cout << "  Activate your license on this device" << std::endl;
    std::cout << "========================================" << std::endl;
}

void ActivationDialog::print_hardware_section() {
    std::cout << "\n--- Hardware ---" << std::endl;
    if (hardware_id_.empty()) {
        std::cout << "  Unable to detect hardware." << std::endl;
    } else {
        std::cout << "  Hardware ID: " << hardware_id_ << std::endl;
        std::cout << "  Device: " << device_name_ << std::endl;
        std::cout << "  Platform: " << platform_ << std::endl;
        std::cout << "  Device Bound: " << (hardware_ok_ ? "Verified" : "Not Bound") << std::endl;
    }
}

void ActivationDialog::print_customer_form() {
    std::cout << "\n--- Customer ---" << std::endl;
    customer_name_ = prompt("  Customer Name", customer_name_);
    customer_email_ = prompt("  Email", customer_email_);
    customer_phone_ = prompt("  Mobile Number", customer_phone_);
}

void ActivationDialog::print_product_selection() {
    std::cout << "\n--- License ---" << std::endl;
    std::string lk = prompt("  License Key", "");
    if (!lk.empty()) license_key_ = lk;
}

std::string ActivationDialog::prompt(const std::string& label, const std::string& def) {
    std::cout << label;
    if (!def.empty()) std::cout << " [" << def << "]";
    std::cout << ": ";
    std::string input;
    std::getline(std::cin, input);
    if (input.empty()) return def;
    return input;
}

ActivationResult ActivationDialog::show() {
    print_banner();
    std::cout << "\nDetecting hardware..." << std::endl;
    detect_hardware();
    print_hardware_section();
    if (!hardware_ok_) {
        std::cout << "\nInitialization failed: hardware detection failed." << std::endl;
        cancelled_ = true;
        return {false, true, ""};
    }
    initialized_ = true;
    std::cout << "\nInitialization complete." << std::endl;
    fetch_trial_status();
    print_customer_form();
    print_product_selection();
    std::string action = prompt("\n  [A]ctivate License  [R]efresh  [C]ancel", "A");
    if (action == "C" || action == "c") {
        cancelled_ = true;
        return {false, true, ""};
    }
    if (action == "A" || action == "a") {
        if (!license_key_.empty()) on_activate();
    } else if (action == "R" || action == "r") {
        on_refresh();
    }
    std::cout << "\nDevice Binding Notice:" << std::endl;
    std::cout << "  This device will be permanently linked to this license." << std::endl;
    std::cout << "  For device replacement, contact: " << config_["branding_support_email"] << std::endl;
    std::cout << "\nProtected by " << product_name_ << std::endl;
    return {activated_, cancelled_, license_key_};
}

void ActivationDialog::detect_hardware() {
    try {
#ifdef _WIN32
        char buf[256];
        DWORD sz = sizeof(buf);
        GetComputerNameA(buf, &sz);
        device_name_ = buf;
#else
        char buf[256];
        gethostname(buf, sizeof(buf));
        device_name_ = buf;
#endif
#ifdef _WIN32
        platform_ = "Windows";
#elif defined(__APPLE__)
        platform_ = "macOS";
#else
        platform_ = "Linux";
#endif
        hardware_id_ = hardware_->get_fingerprint();
        if (hardware_id_.empty()) {
            std::cout << "  Unable to detect hardware. Please retry." << std::endl;
            hardware_ok_ = false;
            return;
        }
        std::cout << "  Hardware verified. Activation available." << std::endl;
        hardware_ok_ = true;
    } catch (const std::exception& e) {
        std::cout << "  Unable to detect hardware: " << e.what() << std::endl;
        hardware_ok_ = false;
    }
}

void ActivationDialog::on_refresh() {
    std::string lk = license_key_;
    try {
        if (!lk.empty()) {
            std::cout << "  Validating license..." << std::endl;
            auto result = client_->validate_license(lk, hardware_id_);
            auto data = json_parse(result["data_json"]);
            if (data["valid"] == "true") {
                update_ui(data);
                std::cout << "  License validated successfully." << std::endl;
                fetch_trial_status();
                return;
            }
            std::cout << "  Validation failed." << std::endl;
        }
        auto trial_result = client_->get_trial_status(hardware_id_);
        auto trial_data = json_parse(trial_result["data_json"]);
        if (trial_data["has_trial"] == "true") {
            update_ui(trial_data);
            std::cout << "  Trial active - " << trial_data["days_left"]
                      << " day(s) remaining." << std::endl;
        } else {
            std::cout << "  No license key and no active trial found." << std::endl;
        }
    } catch (const std::exception& e) {
        std::cout << "  Refresh error: " << e.what() << std::endl;
    }
}

void ActivationDialog::fetch_trial_status() {
    try {
        auto trial_result = client_->get_trial_status(hardware_id_);
        auto trial_data = json_parse(trial_result["data_json"]);
        if (trial_data["has_trial"] == "true") {
            std::cout << "  Trial: Started " << trial_data["started_at"]
                      << ", Ends " << trial_data["expiry_date"]
                      << ", Days Remaining: " << trial_data["days_left"] << std::endl;
        }
    } catch (...) {}
}

void ActivationDialog::update_ui(const std::map<std::string, std::string>& data) {
    auto it = data.find("customer_name");
    if (it != data.end()) customer_name_ = it->second;
    it = data.find("customer_email");
    if (it != data.end()) customer_email_ = it->second;
    it = data.find("customer_phone");
    if (it != data.end()) customer_phone_ = it->second;
    it = data.find("expiry_date");
    if (it != data.end() && !it->second.empty()) {
        std::cout << "  Expiry: " << it->second << std::endl;
    }
    it = data.find("days_left");
    if (it != data.end() && !it->second.empty()) {
        std::cout << "  Days remaining: " << it->second << std::endl;
    }
    it = data.find("max_devices");
    std::string max_dev = it != data.end() ? it->second : "--";
    it = data.find("device_count");
    std::string dev_count = it != data.end() ? it->second : "0";
    if (max_dev != "--") std::cout << "  Device Limit: " << dev_count << " / " << max_dev << std::endl;
}

void ActivationDialog::sync_customer() {
    if (customer_name_.empty() || customer_email_.empty()) {
        std::cout << "  Customer name and email are required." << std::endl;
        return;
    }
    try {
        auto result = client_->update_customer(customer_name_, customer_email_,
                                                customer_phone_, hardware_id_);
        if (result["success"] == "true") {
            std::cout << "  Customer synced." << std::endl;
        } else {
            std::cout << "  Customer sync failed: " << result["error"] << std::endl;
        }
    } catch (const std::exception& e) {
        std::cout << "  Customer sync error: " << e.what() << std::endl;
    }
}

void ActivationDialog::on_activate() {
    if (license_key_.empty()) {
        std::cout << "  Please enter a license key." << std::endl;
        return;
    }
    if (hardware_id_.empty()) {
        std::cout << "  Hardware not detected." << std::endl;
        return;
    }
    std::cout << "  Syncing customer data..." << std::endl;
    sync_customer();
    std::cout << "  Activating license..." << std::endl;
    try {
        auto result = client_->activate_license(license_key_, hardware_id_);
        auto data = json_parse(result["data_json"]);
        if (result["success"] == "true" || data["success"] == "true") {
            activated_ = true;
            std::cout << "  License activated successfully!" << std::endl;
            if (data["already_activated"] == "true") {
                std::cout << "  License already activated on this device." << std::endl;
            }
            if (cache_) cache_->invalidate_license_status();
        } else {
            std::cout << "  Activation failed: " << result["message"] << std::endl;
        }
    } catch (const std::exception& e) {
        std::cout << "  Activation error: " << e.what() << std::endl;
    }
}

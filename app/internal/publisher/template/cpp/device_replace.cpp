#include "device_replace.h"
#include "license_engine.h"
#include "crypto.h"
#include <iostream>
#include <fstream>
#include <thread>
#include <chrono>

DeviceReplaceDialog::DeviceReplaceDialog(std::shared_ptr<LicenseEngine> engine,
                                           const std::string& license_key)
    : engine_(engine), license_key_(license_key) {
    config_ = engine_->config;
}

void DeviceReplaceDialog::print_banner() {
    auto brand = json_parse(config_["branding_json"]);
    auto labels = json_parse(brand["labels_json"]);
    std::string title = labels["replace_title"];
    if (title.empty()) title = "Replace Device";
    std::cout << "\n========================================" << std::endl;
    std::cout << "  " << title << std::endl;
    std::cout << "========================================" << std::endl;
}

void DeviceReplaceDialog::print_device_info() {
    auto brand = json_parse(config_["branding_json"]);
    auto labels = json_parse(brand["labels_json"]);
    std::string unknown = labels["unknown_device"];
    if (unknown.empty()) unknown = "Unknown";

    std::string old_hw = unknown;
    auto s = engine_->get_status();
    if (s && !s->hardware_id.empty()) old_hw = s->hardware_id;
    if (old_hw == unknown) {
        auto cached = std::make_shared<CacheManager>(config_);
        auto ls = cached->get_license_status();
        if (ls) old_hw = (*ls)["hardware_id"];
    }
    std::string new_hw = engine_->get_hardware_id();

    std::cout << "\n--- Device Replacement ---" << std::endl;
    std::cout << "  Move your license from old device to this one." << std::endl;
    std::cout << "  Old Hardware: " << old_hw.substr(0, 48) << std::endl;
    std::cout << "  New Hardware: " << new_hw.substr(0, 48) << std::endl;
}

std::string DeviceReplaceDialog::prompt(const std::string& label, const std::string& def) {
    std::cout << label;
    if (!def.empty()) std::cout << " [" << def << "]";
    std::cout << ": ";
    std::string input;
    std::getline(std::cin, input);
    return input.empty() ? def : input;
}

std::map<std::string, std::string> DeviceReplaceDialog::show() {
    print_banner();
    print_device_info();

    std::string dev_name = prompt("  Device Name", "New Device");
    std::string confirm = prompt("  Type 'YES' to confirm replacement", "");
    if (confirm != "YES") {
        std::map<std::string, std::string> r;
        r["success"] = "false";
        r["message"] = "Replacement cancelled.";
        return r;
    }

    std::cout << "  Replacing device..." << std::endl;
    try {
        auto result = engine_->replace_hardware();
        if (result["success"] == "true") {
            std::cout << "  Device replaced successfully!" << std::endl;
        } else {
            std::cout << "  Failed: " << result["message"] << std::endl;
        }
        return result;
    } catch (const std::exception& e) {
        std::map<std::string, std::string> r;
        r["success"] = "false";
        r["message"] = std::string("Error: ") + e.what();
        return r;
    }
}

#pragma once
#include <string>
#include <map>
#include <memory>

class LicenseEngine;

class DeviceReplaceDialog {
public:
    DeviceReplaceDialog(std::shared_ptr<LicenseEngine> engine,
                         const std::string& license_key);
    std::map<std::string, std::string> show();

private:
    std::shared_ptr<LicenseEngine> engine_;
    std::string license_key_;
    std::map<std::string, std::string> config_;

    void print_banner();
    void print_device_info();
    std::string prompt(const std::string& label, const std::string& def = "");
};

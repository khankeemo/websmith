#pragma once
#include <string>
#include <map>
#include <memory>
#include <vector>

class LicenseEngine;

class RenewalDialog {
public:
    RenewalDialog(std::shared_ptr<LicenseEngine> engine,
                   const std::string& license_key);
    std::map<std::string, std::string> show();

private:
    std::shared_ptr<LicenseEngine> engine_;
    std::string license_key_;
    std::map<std::string, std::string> config_;
    std::vector<std::map<std::string, std::string>> plans_;
    int selected_plan_ = -1;

    void print_banner();
    void print_current_license();
    void load_plans();
    void print_plans();
    std::string prompt(const std::string& label, const std::string& def = "");
};

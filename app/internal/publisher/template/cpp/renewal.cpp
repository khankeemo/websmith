#include "renewal.h"
#include "license_engine.h"
#include "crypto.h"
#include <iostream>
#include <thread>
#include <chrono>

RenewalDialog::RenewalDialog(std::shared_ptr<LicenseEngine> engine,
                               const std::string& license_key)
    : engine_(engine), license_key_(license_key) {
    config_ = engine_->config;
}

void RenewalDialog::print_banner() {
    auto brand = json_parse(config_["branding_json"]);
    auto labels = json_parse(brand["labels_json"]);
    std::string title = labels["renew_title"];
    if (title.empty()) title = "Renew License";
    std::cout << "\n========================================" << std::endl;
    std::cout << "  " << title << std::endl;
    std::cout << "========================================" << std::endl;
}

void RenewalDialog::print_current_license() {
    auto brand = json_parse(config_["branding_json"]);
    auto labels = json_parse(brand["labels_json"]);
    std::string plan_lbl = labels["plan_label"];
    if (plan_lbl.empty()) plan_lbl = "Plan";
    std::string expiry_lbl = labels["expiry_label"];
    if (expiry_lbl.empty()) expiry_lbl = "Expiry";

    auto s = engine_->get_status();
    std::cout << "\n--- Current License ---" << std::endl;
    std::cout << "  " << plan_lbl << ": " << (s ? s->plan : "--") << std::endl;
    std::cout << "  " << expiry_lbl << ": " << (s ? s->expires_at : "N/A") << std::endl;
}

void RenewalDialog::load_plans() {
    std::cout << "\n  Loading plans..." << std::endl;
    try {
        auto result = engine_->get_plans();
        if (result["success"] == "true") {
            std::cout << "  Plans loaded." << std::endl;
        }
    } catch (const std::exception& e) {
        std::cout << "  Error loading plans: " << e.what() << std::endl;
    }
}

void RenewalDialog::print_plans() {
    std::cout << "\n--- Renewal ---" << std::endl;
}

std::string RenewalDialog::prompt(const std::string& label, const std::string& def) {
    std::cout << label;
    if (!def.empty()) std::cout << " [" << def << "]";
    std::cout << ": ";
    std::string input;
    std::getline(std::cin, input);
    return input.empty() ? def : input;
}

std::map<std::string, std::string> RenewalDialog::show() {
    print_banner();
    print_current_license();
    print_plans();

    std::string confirm = prompt("  Type 'YES' to confirm renewal", "");
    if (confirm != "YES") {
        std::map<std::string, std::string> r;
        r["success"] = "false";
        r["message"] = "Renewal cancelled.";
        return r;
    }

    std::cout << "  Processing renewal..." << std::endl;
    try {
        auto result = engine_->renew();
        if (result["success"] == "true") {
            std::cout << "  License renewed successfully!" << std::endl;
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

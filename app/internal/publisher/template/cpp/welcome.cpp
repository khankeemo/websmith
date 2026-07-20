#include "welcome.h"
#include "client.h"
#include "hardware.h"
#include "cache.h"
#include "crypto.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <thread>
#include <chrono>
#include <regex>

WelcomeDialog::WelcomeDialog(std::shared_ptr<ApiClient> client,
                               const std::string& product_name,
                               std::shared_ptr<CacheManager> cache)
    : client_(client), product_name_(product_name), cache_(cache) {
    hardware_ = std::make_shared<HardwareDetector>();
    config_ = load_api_config();
    if (product_name_.empty()) {
        auto prod = json_parse(config_["product_json"]);
        product_name_ = prod["name"];
    }
    auto trial = json_parse(config_["trial_json"]);
    trial_enabled_ = trial["enabled"] != "false";
    auto brand = json_parse(config_["branding_json"]);
    branding_ = brand;
    primary_color_ = brand["primary_color"];
}

std::map<std::string, std::string> WelcomeDialog::load_api_config() {
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

bool WelcomeDialog::is_onboarding_complete() {
    return cache_ && cache_->is_onboarding_complete();
}

bool WelcomeDialog::verify_email(const std::string& email) {
    std::regex pattern(R"(^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$)");
    return std::regex_match(email, pattern);
}

void WelcomeDialog::print_banner() {
    auto labels = json_parse(branding_["labels_json"]);
    std::string title = labels["welcome_title"];
    if (title.empty()) title = "Welcome";
    std::cout << "\n========================================" << std::endl;
    std::cout << "  " << title << std::endl;
    std::cout << "  Complete your registration to start the trial" << std::endl;
    std::cout << "========================================" << std::endl;
}

std::string WelcomeDialog::prompt(const std::string& label, const std::string& def) {
    std::cout << label;
    if (!def.empty()) std::cout << " [" << def << "]";
    std::cout << ": ";
    std::string input;
    std::getline(std::cin, input);
    return input.empty() ? def : input;
}

WelcomeResult WelcomeDialog::show() {
    if (!trial_enabled_) {
        std::cout << "  Trial onboarding is not enabled." << std::endl;
        return {true, false, "", "", ""};
    }
    if (is_onboarding_complete()) {
        std::cout << "  Onboarding already completed." << std::endl;
        return {true, false, "", "", ""};
    }

    print_banner();

    std::string name = prompt("  Name *");
    std::string email = prompt("  Email *");
    std::string mobile = prompt("  Mobile Number *");
    std::string company = prompt("  Company (optional)");

    if (name.empty() || email.empty() || mobile.empty()) {
        std::cout << "  Name, email, and mobile are required." << std::endl;
        return {true, false, "", "", ""};
    }
    if (!verify_email(email)) {
        std::cout << "  Valid email is required." << std::endl;
        return {true, false, "", "", ""};
    }

    std::cout << "\n  Sending OTP to " << email << "..." << std::endl;
    try {
        std::map<std::string, std::string> otp_payload;
        otp_payload["email"] = email;
        auto otp_result = client_->request("auth/otp/send", otp_payload);
        if (otp_result["success"] == "true") {
            std::cout << "  OTP sent to your email." << std::endl;
        } else {
            std::cout << "  Failed to send OTP: " << otp_result["message"] << std::endl;
        }
    } catch (const std::exception& e) {
        std::cout << "  OTP send error: " << e.what() << std::endl;
    }

    std::string otp = prompt("\n  Enter OTP");
    if (otp.size() < 4) {
        std::cout << "  Enter a valid OTP code." << std::endl;
        return {true, false, "", "", ""};
    }

    std::cout << "  Verifying OTP..." << std::endl;
    try {
        std::map<std::string, std::string> verify_payload;
        verify_payload["email"] = email;
        verify_payload["otp"] = otp;
        auto verify_result = client_->request("auth/otp/verify", verify_payload);
        if (verify_result["success"] != "true") {
            std::cout << "  Invalid OTP: " << verify_result["message"] << std::endl;
            return {true, false, "", "", ""};
        }
    } catch (const std::exception& e) {
        std::cout << "  OTP verify error: " << e.what() << std::endl;
        return {true, false, "", "", ""};
    }

    complete_onboarding(name, email, mobile, company);

    auto brand = json_parse(config_["branding_json"]);
    std::string company_name = brand["company_name"];
    if (company_name.empty()) company_name = product_name_;
    if (company_name.empty()) company_name = "License";
    std::cout << "\nProtected by " << company_name << std::endl;
    return {false, true, name, email, hardware_->get_fingerprint()};
}

void WelcomeDialog::complete_onboarding(const std::string& name, const std::string& email,
                                          const std::string& mobile, const std::string& company) {
    std::string hardware_id = hardware_->get_fingerprint();
    std::cout << "  Activating trial..." << std::endl;
    try {
        std::map<std::string, std::string> reg_payload;
        reg_payload["name"] = name;
        reg_payload["email"] = email;
        reg_payload["mobile"] = mobile;
        reg_payload["hardware_id"] = hardware_id;
        if (!company.empty()) reg_payload["company_name"] = company;
        client_->request("customer/register", reg_payload);

        std::map<std::string, std::string> customer_data;
        customer_data["mobile"] = mobile;
        customer_data["hardware_id"] = hardware_id;
        if (!company.empty()) customer_data["company_name"] = company;
        auto trial_result = client_->start_trial(email, name, customer_data);
        if (trial_result["success"] == "true") {
            std::cout << "  Trial activated! You can now use the software." << std::endl;
            if (cache_) cache_->set_onboarding_complete();
        } else {
            std::cout << "  Trial activation issue: " << trial_result["message"] << std::endl;
        }
    } catch (const std::exception& e) {
        std::cout << "  Onboarding error: " << e.what() << std::endl;
    }
}

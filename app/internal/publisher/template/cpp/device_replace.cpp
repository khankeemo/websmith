#include "device_replace.h"
#include "license_engine.h"
#include "crypto.h"
#include <iostream>

DeviceReplaceDialog::DeviceReplaceDialog(std::shared_ptr<LicenseEngine> engine,
                                           const std::string& license_key)
    : engine_(engine), license_key_(license_key) {
    config_ = engine_->config;
}

std::map<std::string, std::string> DeviceReplaceDialog::show() {
    auto brand = json_parse(config_["branding_json"]);
    std::string support_email = brand["support_email"];
    if (support_email.empty()) support_email = "support@websmithdigital.com";

    std::cout << "\n========================================" << std::endl;
    std::cout << "  Replace Device" << std::endl;
    std::cout << "========================================" << std::endl;
    std::cout << std::endl;
    std::cout << "  Device reactivation requires Websmith Support approval." << std::endl;
    std::cout << std::endl;
    std::cout << "  Please contact support at: " << support_email << std::endl;
    std::cout << "  The application will remain locked until reactivation is approved." << std::endl;
    std::cout << std::endl;

    std::map<std::string, std::string> r;
    r["action"] = "contact_support";
    r["support_email"] = support_email;
    return r;
}

#include "widgets.h"
#include "license_engine.h"
#include "activation.h"
#include "renewal.h"
#include "device_replace.h"
#include "welcome.h"
#include "crypto.h"
#include <iostream>
#include <iomanip>

DashboardWidget::DashboardWidget(std::shared_ptr<LicenseEngine> engine)
    : engine_(engine) {}

void DashboardWidget::build() {
    std::cout << "\n=== License Status ===" << std::endl;
    refresh();
}

void DashboardWidget::refresh() {
    auto s = engine_->get_status();
    if (!s) s = &const_cast<LicenseEngine*>(engine_.get())->initialize();
    auto brand = json_parse(engine_->config["branding_json"]);
    auto labels = json_parse(brand["labels_json"]);
    std::string status_lbl = labels["status_label"];
    if (status_lbl.empty()) status_lbl = "Status";
    std::string days_lbl = labels["remaining_days_label"];
    if (days_lbl.empty()) days_lbl = "Remaining days";
    std::string expiry_lbl = labels["expiry_label"];
    if (expiry_lbl.empty()) expiry_lbl = "Expiry";
    std::string plan_lbl = labels["plan_label"];
    if (plan_lbl.empty()) plan_lbl = "Plan";

    if (s && s->valid && (s->status == "active" || s->status == "trial" || s->status == "trial_active")) {
        std::string label = s->trial_active ? "Trial Active" : "Licensed";
        std::string color = s->trial_active ? "warning" : "success";
        std::cout << "  " << status_lbl << ": " << label << std::endl;
        std::cout << "  " << days_lbl << ": " << s->days_remaining << std::endl;
        std::cout << "  " << expiry_lbl << ": "
                  << (s->expires_at.empty() ? "N/A" : s->expires_at) << std::endl;
        std::cout << "  " << plan_lbl << ": "
                  << (s->plan.empty() ? "N/A" : s->plan) << std::endl;
    } else {
        std::cout << "  " << status_lbl << ": Unlicensed" << std::endl;
        std::string msg = s ? s->message : "No active license or trial";
        std::cout << "  " << msg << std::endl;
    }
}

SettingsWidget::SettingsWidget(std::shared_ptr<LicenseEngine> engine)
    : engine_(engine) {}

void SettingsWidget::build() {
    std::cout << "\n=== License Information ===" << std::endl;
    refresh();
    std::cout << "\nActions:" << std::endl;
    std::cout << "  1. Activate" << std::endl;
    std::cout << "  2. Renew" << std::endl;
    std::cout << "  3. Replace Device" << std::endl;
    std::cout << "  4. Refresh" << std::endl;
    std::cout << "  5. Open Welcome" << std::endl;
    std::cout << "\nSelect action (1-5): ";
    std::string input;
    std::getline(std::cin, input);
    if (input == "1") show_activation();
    else if (input == "2") show_renewal();
    else if (input == "3") show_replace();
    else if (input == "4") refresh();
    else if (input == "5") show_welcome();
}

void SettingsWidget::refresh() {
    auto s = engine_->get_status();
    if (!s) s = &const_cast<LicenseEngine*>(engine_.get())->initialize();
    auto brand = json_parse(engine_->config["branding_json"]);
    auto labels = json_parse(brand["labels_json"]);
    std::string status_lbl = labels["status_label"];
    if (status_lbl.empty()) status_lbl = "Status";
    std::string prod_lbl = labels["product_label"];
    if (prod_lbl.empty()) prod_lbl = "Product";
    std::string expiry_lbl = labels["expiry_label"];
    if (expiry_lbl.empty()) expiry_lbl = "Expiry";
    std::string plan_lbl = labels["plan_label"];
    if (plan_lbl.empty()) plan_lbl = "Plan";
    std::string hw_lbl = labels["hardware_id_label"];
    if (hw_lbl.empty()) hw_lbl = "Hardware ID";

    if (s) {
        std::cout << "  " << status_lbl << ": " << s->status << std::endl;
        std::cout << "  " << prod_lbl << ": "
                  << engine_->config["product_name"] << std::endl;
        std::cout << "  " << expiry_lbl << ": "
                  << (s->expires_at.empty() ? "N/A" : s->expires_at) << std::endl;
        std::cout << "  " << plan_lbl << ": "
                  << (s->plan.empty() ? "N/A" : s->plan) << std::endl;
        std::cout << "  " << hw_lbl << ": "
                  << (s->hardware_id.empty() ? "--" : s->hardware_id) << std::endl;
    }
    auto prod = json_parse(engine_->config["product_json"]);
    std::cout << "  SDK Version: " << prod["version"] << std::endl;
}

void SettingsWidget::show_activation() {
    auto client = std::make_shared<ApiClient>(
        engine_->config,
        std::make_shared<HardwareDetector>(),
        std::make_shared<CacheManager>(engine_->config));
    auto cache = std::make_shared<CacheManager>(engine_->config);
    ActivationDialog(client, engine_->config["product_name"], cache).show();
    refresh();
}

void SettingsWidget::show_renewal() {
    std::string key = engine_->get_license_key();
    if (!key.empty()) {
        RenewalDialog(engine_, key).show();
        refresh();
    }
}

void SettingsWidget::show_replace() {
    std::string key = engine_->get_license_key();
    if (!key.empty()) {
        DeviceReplaceDialog(engine_, key).show();
        refresh();
    }
}

void SettingsWidget::show_welcome() {
    auto client = std::make_shared<ApiClient>(
        engine_->config,
        std::make_shared<HardwareDetector>(),
        std::make_shared<CacheManager>(engine_->config));
    auto cache = std::make_shared<CacheManager>(engine_->config);
    WelcomeDialog(client, engine_->config["product_name"], cache).show();
    refresh();
}

StatusWidget::StatusWidget(std::shared_ptr<LicenseEngine> engine)
    : engine_(engine) {}

void StatusWidget::build() {
    refresh();
}

void StatusWidget::refresh() {
    auto s = engine_->get_status();
    if (!s) s = &const_cast<LicenseEngine*>(engine_.get())->initialize();
    auto brand = json_parse(engine_->config["branding_json"]);
    auto labels = json_parse(brand["labels_json"]);

    if (s && s->valid) {
        std::string text;
        std::string color;
        if (s->trial_active) {
            text = "Trial: " + std::to_string(s->days_remaining) + "d";
            color = "warning";
        } else {
            text = "Licensed: " + std::to_string(s->days_remaining) + "d";
            color = "success";
        }
        std::cout << "  \u25CF " << text << std::endl;
    } else {
        std::string msg = s ? s->message : "No license";
        std::cout << "  \u25CF " << msg << std::endl;
    }
}

ActivationButton::ActivationButton(std::shared_ptr<LicenseEngine> engine)
    : engine_(engine) {}

void ActivationButton::build() {
    auto brand = json_parse(engine_->config["branding_json"]);
    auto labels = json_parse(brand["labels_json"]);
    button_text_ = labels["activate_license_btn"];
    if (button_text_.empty()) button_text_ = "Activate License";
    std::cout << "\n[" << button_text_ << "]" << std::endl;
}

void ActivationButton::click() {
    auto client = std::make_shared<ApiClient>(
        engine_->config,
        std::make_shared<HardwareDetector>(),
        std::make_shared<CacheManager>(engine_->config));
    auto cache = std::make_shared<CacheManager>(engine_->config);
    auto result = ActivationDialog(client, engine_->config["product_name"], cache).show();
    if (result.activated) {
        button_text_ = "Licensed";
        auto brand = json_parse(engine_->config["branding_json"]);
        auto labels = json_parse(brand["labels_json"]);
        std::string licensed = labels["licensed_text"];
        std::cout << "  Status: " << (licensed.empty() ? "Licensed" : licensed) << std::endl;
    }
}

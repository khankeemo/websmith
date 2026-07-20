#ifndef WSD_WIDGETS_H
#define WSD_WIDGETS_H

#include <string>
#include <memory>
#include <functional>

class LicenseEngine;

class DashboardWidget {
public:
    DashboardWidget(std::shared_ptr<LicenseEngine> engine);
    void build();
    void refresh();

private:
    std::shared_ptr<LicenseEngine> engine_;
    std::string status_text_;
    std::string detail_text_;
    int days_remaining_ = 0;
    std::string plan_;
    std::string expiry_;
};

class SettingsWidget {
public:
    SettingsWidget(std::shared_ptr<LicenseEngine> engine);
    void build();
    void refresh();

private:
    std::shared_ptr<LicenseEngine> engine_;
    void show_activation();
    void show_renewal();
    void show_replace();
    void show_welcome();
};

class StatusWidget {
public:
    StatusWidget(std::shared_ptr<LicenseEngine> engine);
    void build();
    void refresh();

private:
    std::shared_ptr<LicenseEngine> engine_;
    std::string label_;
    std::string color_;
};

class ActivationButton {
public:
    ActivationButton(std::shared_ptr<LicenseEngine> engine);
    void build();
    void click();

private:
    std::shared_ptr<LicenseEngine> engine_;
    std::string button_text_;
};

// Standalone widget factory functions
void show_dashboard_widget(std::shared_ptr<LicenseEngine> engine);
void show_settings_widget(std::shared_ptr<LicenseEngine> engine);
void show_status_widget(std::shared_ptr<LicenseEngine> engine);
void show_activation_button(std::shared_ptr<LicenseEngine> engine);

#endif

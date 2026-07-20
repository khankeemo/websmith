#pragma once
#include <string>
#include <map>
#include <memory>
#include <vector>

class ApiClient;
class HardwareDetector;
class CacheManager;

struct WelcomeResult {
    bool skipped = false;
    bool onboarding_complete = false;
    std::string name;
    std::string email;
    std::string hardware_id;
};

class WelcomeDialog {
public:
    WelcomeDialog(std::shared_ptr<ApiClient> client,
                   const std::string& product_name = "",
                   std::shared_ptr<CacheManager> cache = nullptr);
    bool is_onboarding_complete();
    WelcomeResult show();

private:
    std::map<std::string, std::string> config_;
    std::shared_ptr<ApiClient> client_;
    std::string product_name_;
    std::shared_ptr<CacheManager> cache_;
    std::shared_ptr<HardwareDetector> hardware_;
    bool trial_enabled_ = true;
    std::string primary_color_;
    std::string success_color_;
    std::string error_color_;
    std::map<std::string, std::string> branding_;

    std::map<std::string, std::string> load_api_config();
    bool verify_email(const std::string& email);
    void send_otp(const std::string& email);
    void verify_otp(const std::string& email, const std::string& otp);
    void complete_onboarding(const std::string& name, const std::string& email,
                             const std::string& mobile, const std::string& company,
                             const std::string& country_code);
    void print_banner();
    std::string prompt(const std::string& label, const std::string& def = "");
};

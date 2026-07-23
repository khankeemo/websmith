// Example application using the C++ SDK
// Demonstrates the complete license lifecycle:
//   Application Start → Splash → LicenseEngine.initialize() → Internal API validates →
//   Final state (ACTIVE/TRIAL_ACTIVE) → Build Dashboard → Unlock UI → Start Services
//
// Build with: g++ -std=c++17 -o wsd_example main.cpp -lwsd_sdk -lssl -lcrypto -lcurl
// Or via CMake: see CMakeLists.txt

#include <iostream>
#include <memory>
#include <string>
#include <vector>

#include "license_engine.h"
#include "activation.h"
#include "renewal.h"
#include "device_replace.h"
#include "welcome.h"
#include "widgets.h"

static void print_usage(const char* program) {
    std::cout << "Usage: " << program << " [config_path]" << std::endl;
    std::cout << "  config_path - path to api-config.json" << std::endl;
    std::cout << "                (default: config/api-config.json)" << std::endl;
}

static void print_menu() {
    std::cout << "\n--- SDK Actions ---\n";
    std::cout << "  1. Initialize & Show Status\n";
    std::cout << "  2. Activate License\n";
    std::cout << "  3. Renew License\n";
    std::cout << "  4. Replace Device\n";
    std::cout << "  5. Start Trial (Welcome)\n";
    std::cout << "  6. Show Dashboard Widget\n";
    std::cout << "  7. Show Settings Widget\n";
    std::cout << "  8. Show Status Widget\n";
    std::cout << "  9. Exit\n";
    std::cout << "  Choice: ";
}

int main(int argc, char* argv[]) {
    std::string config_path = "config/api-config.json";
    if (argc > 1) {
        std::string arg = argv[1];
        if (arg == "-h" || arg == "--help") {
            print_usage(argv[0]);
            return 0;
        }
        config_path = arg;
    }

    std::cout << "WSD SDK C++ Example ${kit_version}" << std::endl;
    std::cout << "Config: " << config_path << std::endl;

    try {
        LicenseEngine engine(config_path);
        std::cout << "SDK Engine created successfully." << std::endl;

        bool running = true;
        while (running) {
            print_menu();
            std::string choice;
            std::getline(std::cin, choice);

            switch (choice[0]) {
                case '1': {
                    std::cout << "\nInitializing..." << std::endl;
                    LicenseStatus status = engine.initialize();
                    std::cout << "  Status: " << status.status << std::endl;
                    std::cout << "  Valid: " << (status.valid ? "yes" : "no") << std::endl;
                    std::cout << "  Expires: " << (status.expires_at.empty() ? "N/A" : status.expires_at) << std::endl;
                    std::cout << "  Days remaining: " << status.days_remaining << std::endl;
                    std::cout << "  Plan: " << (status.plan.empty() ? "N/A" : status.plan) << std::endl;
                    std::cout << "  Hardware ID: " << (status.hardware_id.empty() ? "N/A" : status.hardware_id) << std::endl;
                    std::cout << "  Message: " << status.message << std::endl;
                    break;
                }
                case '2': {
                    auto client = std::make_shared<ApiClient>(engine.config,
                        std::make_shared<HardwareDetector>(),
                        std::make_shared<CacheManager>(engine.config));
                    auto cache = std::make_shared<CacheManager>(engine.config);
                    ActivationResult ar = ActivationDialog(client, engine.config["product_name"], cache).show();
                    std::cout << "  Result: activated=" << ar.activated
                              << ", cancelled=" << ar.cancelled << std::endl;
                    break;
                }
                case '3': {
                    if (engine.has_license_key()) {
                        RenewalDialog dlg(std::make_shared<LicenseEngine>(engine),
                                          engine.get_license_key());
                        dlg.show();
                    } else {
                        std::cout << "  No license key found. Activate first." << std::endl;
                    }
                    break;
                }
                case '4': {
                    if (engine.has_license_key()) {
                        DeviceReplaceDialog dlg(std::make_shared<LicenseEngine>(engine),
                                                engine.get_license_key());
                        dlg.show();
                    } else {
                        std::cout << "  No license key found. Activate first." << std::endl;
                    }
                    break;
                }
                case '5': {
                    auto client = std::make_shared<ApiClient>(engine.config,
                        std::make_shared<HardwareDetector>(),
                        std::make_shared<CacheManager>(engine.config));
                    auto cache = std::make_shared<CacheManager>(engine.config);
                    WelcomeResult wr = WelcomeDialog(client, "", cache).show();
                    std::cout << "  Result: skipped=" << wr.skipped
                              << ", onboarding=" << wr.onboarding_complete << std::endl;
                    break;
                }
                case '6': {
                    DashboardWidget dw(std::make_shared<LicenseEngine>(engine));
                    dw.build();
                    break;
                }
                case '7': {
                    SettingsWidget sw(std::make_shared<LicenseEngine>(engine));
                    sw.build();
                    break;
                }
                case '8': {
                    StatusWidget sw(std::make_shared<LicenseEngine>(engine));
                    sw.build();
                    break;
                }
                case '9':
                    running = false;
                    break;
                default:
                    std::cout << "  Invalid choice. Try 1-9." << std::endl;
                    break;
            }
        }

        std::cout << "\nCleaning up..." << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }

    std::cout << "Done." << std::endl;
    return 0;
}

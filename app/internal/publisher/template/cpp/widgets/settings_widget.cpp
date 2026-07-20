// Settings Widget - standalone component
// Provides a full license information view with an action menu.
// Displays all license fields (status, product, expiry, plan, hardware ID,
// SDK version) and offers buttons to activate, renew, replace device,
// refresh status, and open the welcome dialog.
//
// Actions:
//   1. Activate - opens ActivationDialog for license key entry
//   2. Renew - opens RenewalDialog for license extension
//   3. Replace Device - opens DeviceReplaceDialog for hardware migration
//   4. Refresh - re-fetches and displays updated license status
//   5. Open Welcome - opens WelcomeDialog for trial onboarding

#include "../widgets.h"
#include "../license_engine.h"
#include <iostream>
#include <memory>

// Factory function to create and display settings widget
void show_settings_widget(std::shared_ptr<LicenseEngine> engine) {
    SettingsWidget widget(engine);
    widget.build();
}

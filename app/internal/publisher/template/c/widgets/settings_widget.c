// Settings Widget - standalone component for C SDK
// Provides a full license information view with an action menu.
// Displays all license fields and offers actions to activate, renew,
// replace device, refresh status, and open the welcome dialog.
//
// Actions:
//   1. Activate - opens ActivationDialog
//   2. Renew - opens RenewalDialog
//   3. Replace Device - opens DeviceReplaceDialog
//   4. Refresh - re-fetches and displays updated status
//   5. Open Welcome - opens WelcomeDialog

#include "../widgets.h"
#include "../license_engine.h"
#include <stdio.h>

void c_show_settings_widget(LicenseEngine* engine) {
    wsd_settings_show(engine);
}

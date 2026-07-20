// Activation Button Widget - standalone component for C SDK
// Provides a single-button interface for launching the activation dialog.
// When activated, it opens the ActivationDialog which guides the user
// through hardware detection, customer info entry, and license activation.
// On success, displays "Licensed" status to reflect the new state.
//
// This widget reads branding labels and colors from the engine config.
// The only hardcoded value is support@websmithdigital.com.

#include "../widgets.h"
#include "../license_engine.h"
#include "../activation.h"
#include <stdio.h>

void c_show_activation_button(LicenseEngine* engine) {
    if (!engine) return;
    wsd_activation_button_show(engine);
}

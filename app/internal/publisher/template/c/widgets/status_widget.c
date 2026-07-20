// Status Widget - standalone component for C SDK
// Displays a compact one-line status indicator.
// Shows a bullet character followed by current license state.
// For trial: shows "Trial: Nd" with warning color.
// For active: shows "Licensed: Nd" with success color.
// For unlicensed: shows error message.

#include "../widgets.h"
#include "../license_engine.h"
#include <stdio.h>

void c_show_status_widget(LicenseEngine* engine) {
    wsd_status_show(engine);
}

// Dashboard Widget - standalone component for C SDK
// Displays a high-level overview of the current license status.
// Shows the status label, days remaining, expiry date, and plan name.
// Uses the engine's cached status or triggers initialization if needed.
//
// Layout:
//   === License Status ===
//   Status: <label>
//   Remaining days: <N>
//   Expiry: <date>
//   Plan: <name>

#include "../widgets.h"
#include "../license_engine.h"
#include <stdio.h>

void c_show_dashboard_widget(LicenseEngine* engine) {
    wsd_dashboard_show(engine);
}

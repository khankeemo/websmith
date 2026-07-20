// Dashboard Widget - standalone component
// Displays a high-level overview of the current license status.
// Shows the status label, days remaining, expiry date, and plan name.
// Reads branding labels from the SDK config for localization support.
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
#include <iostream>
#include <memory>

// Factory function to create and display dashboard widget
void show_dashboard_widget(std::shared_ptr<LicenseEngine> engine) {
    DashboardWidget widget(engine);
    widget.build();
}

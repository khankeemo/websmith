// Status Widget - standalone component
// Displays a compact one-line status indicator.
// Shows a colored circle indicator followed by the current license state.
// For trial licenses: shows "Trial: Nd" with warning color.
// For active licenses: shows "Licensed: Nd" with success color.
// For unlicensed state: shows the error message in red.
// Suitable for embedding in status bars, headers, or notifications.
//
// Example output:
//   \xE2\x97\x8F Trial: 14d
//   \xE2\x97\x8F Licensed: 365d
//   \xE2\x97\x8F No license or trial found

#include "../widgets.h"
#include "../license_engine.h"
#include <iostream>
#include <memory>

// Factory function to create and display status widget
void show_status_widget(std::shared_ptr<LicenseEngine> engine) {
    StatusWidget widget(engine);
    widget.build();
}

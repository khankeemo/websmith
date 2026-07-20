// Widgets module for C SDK
// This module provides console-based widget implementations for license
// management in the C runtime. Each widget provides a specific view into
// the license state and allows user interaction for common operations.
//
// Available widgets:
//   - DashboardWidget: overview of current license status
//   - SettingsWidget: full license information and action menu
//   - StatusWidget: compact one-line status display
//   - ActivationButton: one-click activation entry point
//
// All widgets use printf/scanf for console I/O since the C SDK does not
// bundle any GUI framework. Widget text is read from branding labels
// in the SDK config when available, with sensible hardcoded defaults.
// The only hardcoded contact is support@websmithdigital.com.

#include "../widgets.h"

// Widgets module for C++ SDK
// This module provides console-based widget implementations for license
// management. Each widget provides a specific view into the license state
// and allows user interaction for common operations.
//
// Available widgets:
//   - DashboardWidget: overview of current license status
//   - SettingsWidget: full license information and action menu
//   - StatusWidget: compact one-line status display
//   - ActivationButton: one-click activation entry point
//
// All widgets follow the console I/O pattern using std::cout/std::cin
// since GUI frameworks (tkinter, Qt) are not available in C++ SDK context.
// Widgets read branding/labels from the SDK config for customization.

#include "../widgets.h"

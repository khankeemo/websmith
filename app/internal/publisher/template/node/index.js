const { LicenseEngine, LicenseStatus } = require('./license_engine');
const { ApiClient, ApiError } = require('./client');
const { HardwareDetector } = require('./hardware');
const { CacheManager } = require('./cache');
const { WelcomeDialog } = require('./welcome');
const { ActivationDialog } = require('./activation');
const { RenewalDialog } = require('./renewal');
const { DeviceReplaceDialog } = require('./device_replace');
const { DashboardWidget } = require('./widgets/dashboard_widget');
const { SettingsWidget } = require('./widgets/settings_widget');
const { StatusWidget } = require('./widgets/status_widget');
const { ActivationButton } = require('./widgets/activation_button');

module.exports = {
  LicenseEngine,
  LicenseStatus,
  ApiClient,
  ApiError,
  HardwareDetector,
  CacheManager,
  WelcomeDialog,
  ActivationDialog,
  RenewalDialog,
  DeviceReplaceDialog,
  DashboardWidget,
  SettingsWidget,
  StatusWidget,
  ActivationButton,
};

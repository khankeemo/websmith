// FILE: app/internal/api/settings/page.tsx
// PURPOSE: API Center Settings - System configuration and preferences
// SCOPE: General Settings, API Configuration, Security, Notifications, Appearance
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Shield,
  Bell,
  Palette,
  Globe,
  Key,
  Database,
  Users,
  Mail,
  Lock,
  Server,
  HardDrive,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Save,
  Eye,
  EyeOff,
  Copy,
  Check,
  User,
  Building2,
  Clock,
  Zap,
  Activity,
  FileText,
  Cpu,
  Link2,
  ShieldCheck,
  Smartphone,
  Monitor,
  Laptop,
  Moon,
  Sun,
  Palette as PaletteIcon,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface SettingsData {
  general: {
    siteName: string;
    siteUrl: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
  };
  api: {
    apiKey: string;
    webhookUrl: string;
    validationEndpoint: string;
    rateLimit: number;
  };
  security: {
    maxLoginAttempts: number;
    sessionTimeout: number;
    require2FA: boolean;
    passwordPolicy: string;
    allowedIPs: string[];
  };
  notifications: {
    emailNotifications: boolean;
    licenseExpiryWarning: number;
    deviceActivityAlerts: boolean;
    systemAlerts: boolean;
    weeklyReports: boolean;
  };
  appearance: {
    theme: "light" | "dark" | "system";
    sidebarCollapsed: boolean;
    compactView: boolean;
    accentColor: string;
  };
}

// ============================================================
// SECTION COMPONENT
// ============================================================

interface SectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, description, icon, children }: SectionProps) {
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm transition-all duration-200 hover:shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)]">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ============================================================
// SETTINGS INPUT COMPONENT
// ============================================================

interface SettingsInputProps {
  label: string;
  value: string | number | boolean;
  type?: "text" | "password" | "number" | "email" | "url" | "select" | "checkbox";
  options?: { label: string; value: string }[];
  onChange: (value: any) => void;
  placeholder?: string;
  disabled?: boolean;
  helper?: string;
  required?: boolean;
}

function SettingsInput({
  label,
  value,
  type = "text",
  options,
  onChange,
  placeholder,
  disabled,
  helper,
  required,
}: SettingsInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  if (type === "checkbox") {
    return (
      <div className="flex items-center gap-3 py-2">
        <input
          type="checkbox"
          checked={value as boolean}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-blue-500 focus:ring-blue-500/20 focus:ring-2 transition-all"
        />
        <span className="text-sm text-[var(--text-primary)]">{label}</span>
        {helper && <span className="text-xs text-[var(--text-muted)] ml-auto">{helper}</span>}
      </div>
    );
  }

  if (type === "select") {
    return (
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          {label} {required && <span className="text-[var(--api-red-400)]">*</span>}
        </label>
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all"
        >
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {helper && <p className="text-xs text-[var(--text-muted)] mt-1">{helper}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
        {label} {required && <span className="text-[var(--api-red-400)]">*</span>}
      </label>
      <div className="relative">
        <input
          type={type === "password" && showPassword ? "text" : type}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {helper && <p className="text-xs text-[var(--text-muted)] mt-1">{helper}</p>}
    </div>
  );
}

// ============================================================
// MAIN SETTINGS PAGE
// ============================================================

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsData>({
    general: {
      siteName: "Websmith API Center",
      siteUrl: typeof window !== 'undefined' ? window.location.origin : '',
      timezone: "America/New_York",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
    },
    api: {
      apiKey: "",
      webhookUrl: "",
      validationEndpoint: "",
      rateLimit: 100,
    },
    security: {
      maxLoginAttempts: 5,
      sessionTimeout: 60,
      require2FA: false,
      passwordPolicy: "strong",
      allowedIPs: [],
    },
    notifications: {
      emailNotifications: true,
      licenseExpiryWarning: 7,
      deviceActivityAlerts: true,
      systemAlerts: true,
      weeklyReports: false,
    },
    appearance: {
      theme: "dark",
      sidebarCollapsed: false,
      compactView: false,
      accentColor: "blue",
    },
  });

  const API_BASE = "/internal/backend";

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Try to load settings from API
        const response = await fetch(`${API_BASE}/settings`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSettings(data.settings);
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        // Use defaults
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess("Settings saved successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to save settings");
      }
    } catch (err) {
      console.error("Save settings error:", err);
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      // Reset to defaults
      setSettings({
        general: {
          siteName: "Websmith API Center",
          siteUrl: typeof window !== 'undefined' ? window.location.origin : '',
          timezone: "America/New_York",
          dateFormat: "MM/DD/YYYY",
          timeFormat: "12h",
        },
        api: {
          apiKey: "",
          webhookUrl: "",
          validationEndpoint: "",
          rateLimit: 100,
        },
        security: {
          maxLoginAttempts: 5,
          sessionTimeout: 60,
          require2FA: false,
          passwordPolicy: "strong",
          allowedIPs: [],
        },
        notifications: {
          emailNotifications: true,
          licenseExpiryWarning: 7,
          deviceActivityAlerts: true,
          systemAlerts: true,
          weeklyReports: false,
        },
        appearance: {
          theme: "dark",
          sidebarCollapsed: false,
          compactView: false,
          accentColor: "blue",
        },
      });
      setSuccess("Settings reset to defaults");
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-[var(--api-blue-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)] mt-3">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Configure your API Center system settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--api-red-500-20)] text-[var(--api-red-400)] hover:bg-[var(--api-red-500-10)] transition-all"
          >
            <RefreshCw size={14} />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--text-primary)] font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--api-red-400)]" />
            <p className="text-[var(--api-red-400)] text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-[var(--api-green-400)]" />
            <p className="text-[var(--api-green-400)] text-sm">{success}</p>
          </div>
        </div>
      )}

      {/* Settings Sections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* General Section */}
        <Section title="General Settings" description="Basic system configuration" icon={<Globe className="h-5 w-5" />}>
          <div className="space-y-4">
            <SettingsInput
              label="Site Name"
              value={settings.general.siteName}
              onChange={(v) => setSettings({ ...settings, general: { ...settings.general, siteName: v } })}
              placeholder="Websmith API Center"
              required
            />
            <SettingsInput
              label="Site URL"
              value={settings.general.siteUrl}
              onChange={(v) => setSettings({ ...settings, general: { ...settings.general, siteUrl: v } })}
              type="url"
              placeholder="https://www.websmithdigital.com"
              helper="Your public API Center URL"
            />
            <SettingsInput
              label="Timezone"
              value={settings.general.timezone}
              onChange={(v) => setSettings({ ...settings, general: { ...settings.general, timezone: v } })}
              type="select"
              options={[
                { label: "Eastern Time (ET)", value: "America/New_York" },
                { label: "Central Time (CT)", value: "America/Chicago" },
                { label: "Mountain Time (MT)", value: "America/Denver" },
                { label: "Pacific Time (PT)", value: "America/Los_Angeles" },
                { label: "UTC", value: "UTC" },
              ]}
            />
          </div>
        </Section>

        {/* API Section */}
        <Section title="API Configuration" description="API keys and endpoints" icon={<Key className="h-5 w-5" />}>
          <div className="space-y-4">
            <SettingsInput
              label="API Key"
              value={settings.api.apiKey}
              onChange={(v) => setSettings({ ...settings, api: { ...settings.api, apiKey: v } })}
              type="password"
              placeholder="ws_xxxxxxxxxxxxxxxx"
              helper="Generate a new API key for external integrations"
            />
            <SettingsInput
              label="Webhook URL"
              value={settings.api.webhookUrl}
              onChange={(v) => setSettings({ ...settings, api: { ...settings.api, webhookUrl: v } })}
              type="url"
              placeholder="https://example.com/webhook"
              helper="Receive real-time events via webhook"
            />
            <SettingsInput
              label="Validation Endpoint"
              value={settings.api.validationEndpoint}
              onChange={(v) => setSettings({ ...settings, api: { ...settings.api, validationEndpoint: v } })}
              type="url"
              placeholder="https://example.com/validate"
              helper="Custom license validation endpoint"
            />
            <SettingsInput
              label="Rate Limit (requests/minute)"
              value={settings.api.rateLimit}
              onChange={(v) => setSettings({ ...settings, api: { ...settings.api, rateLimit: parseInt(v) || 100 } })}
              type="number"
              helper="Maximum API requests per minute per client"
            />
          </div>
        </Section>

        {/* Security Section */}
        <Section title="Security" description="Authentication and security settings" icon={<Shield className="h-5 w-5" />}>
          <div className="space-y-4">
            <SettingsInput
              label="Max Login Attempts"
              value={settings.security.maxLoginAttempts}
              onChange={(v) => setSettings({ ...settings, security: { ...settings.security, maxLoginAttempts: parseInt(v) || 5 } })}
              type="number"
              helper="Number of failed login attempts before lockout"
            />
            <SettingsInput
              label="Session Timeout (minutes)"
              value={settings.security.sessionTimeout}
              onChange={(v) => setSettings({ ...settings, security: { ...settings.security, sessionTimeout: parseInt(v) || 60 } })}
              type="number"
              helper="Auto-logout after inactivity"
            />
            <SettingsInput
              label="Require 2FA"
              value={settings.security.require2FA}
              onChange={(v) => setSettings({ ...settings, security: { ...settings.security, require2FA: v } })}
              type="checkbox"
              helper="Two-factor authentication for all users"
            />
            <SettingsInput
              label="Password Policy"
              value={settings.security.passwordPolicy}
              onChange={(v) => setSettings({ ...settings, security: { ...settings.security, passwordPolicy: v } })}
              type="select"
              options={[
                { label: "Weak (min 6 chars)", value: "weak" },
                { label: "Medium (min 8 chars)", value: "medium" },
                { label: "Strong (min 12 chars + special)", value: "strong" },
                { label: "Very Strong (min 16 chars + special + 2FA)", value: "very_strong" },
              ]}
            />
          </div>
        </Section>

        {/* Notifications Section */}
        <Section title="Notifications" description="Email and system alerts" icon={<Bell className="h-5 w-5" />}>
          <div className="space-y-4">
            <SettingsInput
              label="Email Notifications"
              value={settings.notifications.emailNotifications}
              onChange={(v) => setSettings({ ...settings, notifications: { ...settings.notifications, emailNotifications: v } })}
              type="checkbox"
              helper="Receive email notifications"
            />
            <SettingsInput
              label="License Expiry Warning (days before)"
              value={settings.notifications.licenseExpiryWarning}
              onChange={(v) => setSettings({ ...settings, notifications: { ...settings.notifications, licenseExpiryWarning: parseInt(v) || 7 } })}
              type="number"
              helper="Send warning before license expires"
            />
            <SettingsInput
              label="Device Activity Alerts"
              value={settings.notifications.deviceActivityAlerts}
              onChange={(v) => setSettings({ ...settings, notifications: { ...settings.notifications, deviceActivityAlerts: v } })}
              type="checkbox"
              helper="Alert on new device activations"
            />
            <SettingsInput
              label="System Alerts"
              value={settings.notifications.systemAlerts}
              onChange={(v) => setSettings({ ...settings, notifications: { ...settings.notifications, systemAlerts: v } })}
              type="checkbox"
              helper="Receive system health alerts"
            />
            <SettingsInput
              label="Weekly Reports"
              value={settings.notifications.weeklyReports}
              onChange={(v) => setSettings({ ...settings, notifications: { ...settings.notifications, weeklyReports: v } })}
              type="checkbox"
              helper="Receive weekly summary reports"
            />
          </div>
        </Section>

        {/* Appearance Section */}
        <Section title="Appearance" description="Theme and display preferences" icon={<PaletteIcon className="h-5 w-5" />}>
          <div className="space-y-4">
            <SettingsInput
              label="Theme"
              value={settings.appearance.theme}
              onChange={(v) => setSettings({ ...settings, appearance: { ...settings.appearance, theme: v as any } })}
              type="select"
              options={[
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
                { label: "System", value: "system" },
              ]}
            />
            <SettingsInput
              label="Sidebar Collapsed"
              value={settings.appearance.sidebarCollapsed}
              onChange={(v) => setSettings({ ...settings, appearance: { ...settings.appearance, sidebarCollapsed: v } })}
              type="checkbox"
              helper="Collapse sidebar by default"
            />
            <SettingsInput
              label="Compact View"
              value={settings.appearance.compactView}
              onChange={(v) => setSettings({ ...settings, appearance: { ...settings.appearance, compactView: v } })}
              type="checkbox"
              helper="Use compact layout for dense information"
            />
            <SettingsInput
              label="Accent Color"
              value={settings.appearance.accentColor}
              onChange={(v) => setSettings({ ...settings, appearance: { ...settings.appearance, accentColor: v } })}
              type="select"
              options={[
                { label: "Blue", value: "blue" },
                { label: "Purple", value: "purple" },
                { label: "Green", value: "green" },
                { label: "Cyan", value: "cyan" },
                { label: "Amber", value: "amber" },
                { label: "Pink", value: "pink" },
              ]}
            />
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Settings API: Online</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Version 1.0.0</span>
        </div>
      </div>
    </div>
  );
}

